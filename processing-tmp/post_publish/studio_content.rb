# frozen_string_literal: true

# Publishes, next to a recording of the video format, what the meeting had
# besides its video. The presentation format published this; the video format
# does not, and the new playback reads the video format's directory only.
#
#   notes.html   the shared notes as they were when the meeting ended (the
#                archive step's export of the pad), for the Notes tab. Not
#                written for a meeting without shared notes.
#   polls.json   the polls whose results were published while recording, as
#                the presentation format's polls.json, for the Polls app and
#                the timeline:
#                [{ "timestamp": s, "type": "YN", "question": "...",
#                   "answers": [{ "id": 0, "key": "Yes", "numVotes": 3 }],
#                   "respondents": 5, "responders": 4,
#                   "showCorrectAnswer": false, "isQuiz": false }]
#   slides.json  what the presentation area showed, in order, for the Chapters
#                tab and the timeline: each slide from when it came up, and
#                screen sharing:
#                [{ "time": s, "type": "slide", "presentation": "<id>",
#                   "slide": 3, "title": "its first line of text",
#                   "image": "slides/<id>/thumb-3.png", "width": 160, "height": 90 },
#                 { "time": s, "type": "screenshare" }]
#                The images are the slides' thumbnails, copied to slides/.
#
# Times are seconds of the published recording (recording periods joined,
# what is outside them is dropped), as the playback's clock.
#
# Everyone who can open the recording can read these files, as with the
# presentation format's. Polls carry the number of votes per answer, not who
# voted.
#
# Runs after each publish (post_publish), or by hand for one already published:
#
#   cd /usr/local/bigbluebutton/core/scripts/post_publish
#   sudo -u bigbluebutton ruby studio_content.rb -m <record id> -f video

require 'fileutils'
require 'json'
require 'optimist'
require File.expand_path('../../../lib/recordandplayback', __FILE__)

opts = Optimist.options do
  opt :meeting_id, 'Meeting id', type: String
  opt :format, 'Playback format name', type: String
end
meeting_id = opts[:meeting_id]
# The presentation format publishes these files itself
exit 0 unless opts[:format] == 'video'

props = BigBlueButton.read_props
logger = Logger.new("#{props['log_dir']}/post_publish.log", 'weekly')
logger.level = Logger::INFO
BigBlueButton.logger = logger

raw_dir = "#{props['recording_dir']}/raw/#{meeting_id}"
published_dir = "#{props['published_dir']}/video/#{meeting_id}"
unless File.directory?(raw_dir) && File.directory?(published_dir)
  logger.info("studio_content: nothing to do for #{meeting_id}")
  exit 0
end

# notes.html: the pad's export, as it is
notes = "#{raw_dir}/notes/notes.html"
if File.exist?(notes)
  FileUtils.cp(notes, "#{published_dir}/notes.html")
  logger.info("studio_content: copied the shared notes to #{published_dir}/notes.html")
else
  logger.info("studio_content: no shared notes for #{meeting_id}")
end

events_xml = "#{raw_dir}/events.xml"
unless File.exist?(events_xml)
  logger.info("studio_content: no events for #{meeting_id}")
  exit 0
end
events = Nokogiri::XML(File.read(events_xml))

# Recording periods, absolute ms, each with where it starts in the published
# recording
periods = BigBlueButton::Events.match_start_and_stop_rec_events(
  BigBlueButton::Events.get_start_and_stop_rec_events(events)
)
offset = 0
periods.each do |period|
  period[:offset] = offset
  offset += period[:stop_timestamp] - period[:start_timestamp]
end

# Absolute ms -> seconds of the published recording; nil outside the periods
to_recording = lambda do |timestamp|
  period = periods.find { |p| timestamp >= p[:start_timestamp] && timestamp <= p[:stop_timestamp] }
  period && ((timestamp - period[:start_timestamp] + period[:offset]) / 1000.0).round(3)
end

# The same for what stays as it is until it changes again: a change before
# the recording or while it is paused shows from where the recording goes on;
# nil after its end
to_recording_or_next = lambda do |timestamp|
  period = periods.find { |p| timestamp <= p[:stop_timestamp] }
  period && (([timestamp, period[:start_timestamp]].max - period[:start_timestamp] + period[:offset]) / 1000.0).round(1)
end

# polls.json: a poll is in the recording when its results were published
# while recording, at that moment
poll_types = {}
events.xpath('/recording/event[@eventname="PollStartedRecordEvent"]').each do |event|
  poll_types[event.at_xpath('pollId')&.text.to_s] ||= event.at_xpath('type')&.text.to_s
end

polls = []
events.xpath('/recording/event[@eventname="PollPublishedRecordEvent"]').each do |event|
  time = to_recording.call(event['timestamp'].to_i)
  next if time.nil?

  answers = begin
    JSON.parse(event.at_xpath('answers')&.text.to_s)
  rescue JSON::ParserError
    []
  end

  polls << {
    timestamp: time.to_i,
    type: poll_types[event.at_xpath('pollId')&.text.to_s].to_s,
    question: event.at_xpath('question')&.text.to_s,
    answers: answers,
    respondents: event.at_xpath('numRespondents')&.text.to_i,
    responders: event.at_xpath('numResponders')&.text.to_i,
    showCorrectAnswer: event.at_xpath('showCorrectAnswer')&.text == 'true',
    isQuiz: event.at_xpath('isQuiz')&.text == 'true',
  }
end

polls_file = "#{published_dir}/polls.json"
if polls.empty?
  FileUtils.rm_f(polls_file)
else
  File.write(polls_file, JSON.generate(polls))
end
logger.info("studio_content: #{polls.size} poll(s) for #{meeting_id}")

# slides.json: the presentation's current page, or screen sharing while
# there is one and it takes the presentation's place, as the presentation
# format tells them apart.
#
# A page is known by a key, the one in its files' names (thumb-<key>.png,
# slide-<key>.txt): its page id where the conversion lists them (BigBlueButton
# 4.1), else its number
page_ids = {}
events.xpath('/recording/event[@eventname="ConversionCompletedEvent"]').each do |event|
  ids = event.at_xpath('pageIds')&.text.to_s.split(',')
  page_ids[event.at_xpath('presentationName')&.text.to_s] = ids unless ids.empty?
end

page_key = lambda do |event, presentation|
  id = (event.at_xpath('whiteboardId') || event.at_xpath('id'))&.text
  return id if page_ids[presentation]&.include?(id)

  # The page's index, from 0
  slide = event.at_xpath('slide')&.text
  slide && (slide.to_i + 1).to_s
end

presentation = nil
pages = {} # presentation -> the key of its current page
sharing = false
sharing_as_content = true
shown = [] # [{ at: absolute ms, state: :screenshare or [presentation, key] }]

events.xpath('/recording/event').each do |event|
  case event['eventname']
  when 'SharePresentationEvent'
    presentation = event.at_xpath('presentationName')&.text.to_s
    # A presentation shown for the first time starts at its first page
    pages[presentation] ||= page_ids[presentation]&.first || '1'
  when 'GotoSlideEvent'
    next if presentation.nil?

    key = page_key.call(event, presentation)
    pages[presentation] = key if key
  when 'DeskshareStartedEvent', 'StartWebRTCDesktopShareEvent'
    sharing = true
  when 'DeskshareStoppedEvent', 'StopWebRTCDesktopShareEvent'
    sharing = false
  when 'SetScreenshareAsContentEvent'
    as_content = event.at_xpath('screenshareAsContent')&.text
    sharing_as_content = as_content == 'true' unless as_content.nil?
  else
    next
  end

  state = if sharing && sharing_as_content then :screenshare
          elsif presentation.nil? || presentation.empty? then nil
          else [presentation, pages[presentation]]
          end
  shown << { at: event['timestamp'].to_i, state: state } if shown.empty? || shown.last[:state] != state
end

# In the recording's time: of what changed at the same moment (before the
# recording, in a pause), the last is what shows
slides = []
shown.each do |change|
  time = to_recording_or_next.call(change[:at])
  break if time.nil?

  slides.pop if slides.any? && slides.last[:time] == time
  slides << { time: time, state: change[:state] }
end
# Nothing is shown before the first presentation; what is the same before and
# after a pause is one
slides = slides.reject { |slide| slide[:state].nil? }.chunk_while { |a, b| a[:state] == b[:state] }.map(&:first)

# A slide's first line of text, its title on most slides
first_line = lambda do |file|
  next nil unless File.file?(file)

  line = File.read(file, encoding: 'UTF-8').scrub.each_line.map { |l| l.gsub(/\s+/, ' ').strip }.find { |l| !l.empty? }
  line && line[0, 200]
end

# [width, height] of a PNG, from its header
png_size = lambda do |file|
  header = File.binread(file, 24)
  header && header.bytesize == 24 && header[1, 3] == 'PNG' ? header[16, 8].unpack('NN') : nil
end

# Names that go into paths: nothing that leaves the directory
safe = ->(name) { name.to_s.match?(/\A[\w.-]+\z/) && !name.to_s.start_with?('.') }

images_dir = "#{published_dir}/slides"
FileUtils.rm_rf(images_dir)

slides_json = slides.map do |slide|
  next({ time: slide[:time], type: 'screenshare' }) if slide[:state] == :screenshare

  shown_presentation, key = slide[:state]
  number = page_ids[shown_presentation] ? page_ids[shown_presentation].index(key).to_i + 1 : key.to_i
  entry = { time: slide[:time], type: 'slide', presentation: shown_presentation, slide: number }
  next entry unless safe.call(shown_presentation) && safe.call(key)

  presentation_dir = "#{raw_dir}/presentation/#{shown_presentation}"
  title = first_line.call("#{presentation_dir}/textfiles/slide-#{key}.txt")
  entry[:title] = title if title

  thumbnail = "#{presentation_dir}/thumbnails/thumb-#{key}.png"
  if File.file?(thumbnail)
    FileUtils.mkdir_p("#{images_dir}/#{shown_presentation}")
    FileUtils.cp(thumbnail, "#{images_dir}/#{shown_presentation}/thumb-#{key}.png")
    entry[:image] = "slides/#{shown_presentation}/thumb-#{key}.png"
    width, height = png_size.call(thumbnail)
    entry.merge!(width: width, height: height) if width.to_i.positive? && height.to_i.positive?
  end

  entry
end

slides_file = "#{published_dir}/slides.json"
if slides_json.empty?
  FileUtils.rm_f(slides_file)
else
  File.write(slides_file, JSON.generate(slides_json))
end
logger.info("studio_content: #{slides_json.size} slide(s) and screen sharing(s) for #{meeting_id}")

exit 0
