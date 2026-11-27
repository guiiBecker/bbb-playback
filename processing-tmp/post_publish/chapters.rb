# frozen_string_literal: true

# Publishes what the presentation area showed, for the new playback's chapters
# and timeline, next to the video format's recording, from the raw files, so
# the presentation format is not needed for it:
#
#   slides.json  [{ "timestamp": s, "src": "presentation/<id>/thumbnails/thumb-3.png",
#                   "alt": "the slide's text", "width": px, "height": px },
#                 { "timestamp": s, "src": "screenshare" }, ...]
#   presentation/<id>/thumbnails/thumb-N.png  the pictures of the slides shown
#
# The sequence is the presentation format's (publish/presentation.rb,
# process_presentation): a new entry whenever the presentation, its slide or
# whether a screen sharing is the content changes. Times are seconds of the
# published recording, as the presentation format translates them: what
# happens before the recording starts is at its start.
#
# Runs after each publish (post_publish), or by hand for one already published:
#
#   cd /usr/local/bigbluebutton/core/scripts/post_publish
#   sudo -u bigbluebutton ruby chapters.rb -m <record id> -f video

require 'fileutils'
require 'json'
require 'optimist'
require File.expand_path('../../../lib/recordandplayback', __FILE__)

opts = Optimist.options do
  opt :meeting_id, 'Meeting id', type: String
  opt :format, 'Playback format name', type: String
end
meeting_id = opts[:meeting_id]
exit 0 unless %w[video presentation].include?(opts[:format])

props = BigBlueButton.read_props
logger = Logger.new("#{props['log_dir']}/post_publish.log", 'weekly')
logger.level = Logger::INFO
BigBlueButton.logger = logger

raw_dir = "#{props['recording_dir']}/raw/#{meeting_id}"
published_dir = "#{props['published_dir']}/#{opts[:format]}/#{meeting_id}"
unless File.exist?("#{raw_dir}/events.xml") && File.directory?(published_dir)
  logger.info("chapters: nothing to do for #{meeting_id}")
  exit 0
end

events = Nokogiri::XML(File.read("#{raw_dir}/events.xml"))

# The recording periods, and the presentation format's translation of an
# event's time to the published recording
periods = BigBlueButton::Events.match_start_and_stop_rec_events(
  BigBlueButton::Events.get_start_and_stop_rec_events(events)
)
accumulated = 0
periods.each do |period|
  period[:offset] = period[:start_timestamp] - accumulated
  period[:duration] = period[:stop_timestamp] - period[:start_timestamp]
  accumulated += period[:duration]
end
translate = lambda do |timestamp|
  periods.each do |period|
    return (period[:start_timestamp] - period[:offset]).to_f if timestamp <= period[:start_timestamp]
    return (timestamp - period[:offset]).to_f if timestamp <= period[:stop_timestamp]
  end
  last = periods.last
  (timestamp - last[:offset] + last[:duration]).to_f
end

# The size of a PNG, from its header
png_size = lambda do |path|
  header = File.binread(path, 24)
  header[12, 4] == 'IHDR' ? header[16, 8].unpack('NN') : [nil, nil]
rescue StandardError
  [nil, nil]
end

slide_presentation = {}
presentation = ''
slide = 0
deskshare = false
screenshare_active = false
screenshare_as_content = true
entries = []

events.xpath('/recording/event').each do |event|
  changed = false
  case event['eventname']
  when 'SharePresentationEvent'
    presentation = event.at_xpath('presentationName').text
    slide = slide_presentation[presentation].to_i
    changed = true
  when 'GotoSlideEvent'
    slide = event.at_xpath('slide').text.to_i
    slide_presentation[presentation] = slide
    changed = true
  when 'DeskshareStartedEvent', 'StartWebRTCDesktopShareEvent'
    screenshare_active = true
    deskshare = screenshare_active && screenshare_as_content
    changed = true
  when 'DeskshareStoppedEvent', 'StopWebRTCDesktopShareEvent'
    screenshare_active = false
    deskshare = false
    changed = true
  when 'SetScreenshareAsContentEvent'
    value = event.at_xpath('screenshareAsContent')
    screenshare_as_content = value.text == 'true' if value
    deskshare = screenshare_active && screenshare_as_content
    changed = true
  end
  next unless changed

  last = entries.last
  next if last && last[:presentation] == presentation && last[:slide] == slide && last[:deskshare] == deskshare

  entries << {
    deskshare: deskshare,
    presentation: presentation,
    slide: slide,
    timestamp: (translate.call(event['timestamp'].to_i) / 1000.0).round(1),
  }
end

# Several changes at the same moment: the last one is what was shown
entries = entries.reverse.uniq { |entry| entry[:timestamp] }.reverse

slides = []
entries.each do |entry|
  if entry[:deskshare]
    slides << { timestamp: entry[:timestamp], src: 'screenshare' }
    next
  end
  # Before any presentation is shared there is nothing to show
  next if entry[:presentation].empty?

  number = entry[:slide] + 1
  folder = "presentation/#{entry[:presentation]}"
  thumbnail = "#{folder}/thumbnails/thumb-#{number}.png"
  source = "#{raw_dir}/#{thumbnail}"
  item = { timestamp: entry[:timestamp], src: thumbnail }
  if File.exist?(source)
    FileUtils.mkdir_p("#{published_dir}/#{folder}/thumbnails")
    FileUtils.cp(source, "#{published_dir}/#{thumbnail}")
    item[:width], item[:height] = png_size.call(source)
  else
    logger.warn("chapters: no #{thumbnail} in the raw files")
  end
  text = "#{raw_dir}/#{folder}/textfiles/slide-#{number}.txt"
  item[:alt] = File.read(text, encoding: 'UTF-8').strip if File.exist?(text)
  slides << item.compact
end

# The same picture twice in a row is one entry
slides = slides.each_with_object([]) do |item, kept|
  kept << item unless kept.last && kept.last[:src] == item[:src]
end

File.write("#{published_dir}/slides.json", JSON.generate(slides))
logger.info("chapters: wrote #{slides.length} entries to #{published_dir}/slides.json")

exit 0
