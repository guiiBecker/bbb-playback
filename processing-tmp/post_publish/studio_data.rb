# frozen_string_literal: true

# Publishes the new playback's data files next to a recording (video format, or presentation),
# from the raw events.xml (which is not published):
#
#   talking.json   who talked when (kept if the publish step already wrote it):
#                  { "<user id>": { "userName": "...", "events": [{ "start": s, "stop": s }] } }
#   timeline.json  moments the published files do not have, for the timeline's
#                  markers: raised hands and reactions, in order:
#                  [{ "time": s, "type": "hand" | "reaction", "name": "...", "emoji": "👍" }]
#
# Times are seconds of the published recording (recording periods joined,
# what is outside them is dropped), as the playback's clock.
#
# Runs after each publish (post_publish), or by hand for one already published:
#
#   cd /usr/local/bigbluebutton/core/scripts/post_publish
#   sudo -u bigbluebutton ruby studio_data.rb -m <record id> -f video

require 'json'
require 'optimist'
require File.expand_path('../../../lib/recordandplayback', __FILE__)

opts = Optimist.options do
  opt :meeting_id, 'Meeting id', type: String
  opt :format, 'Playback format name', type: String
end
meeting_id = opts[:meeting_id]
# The new playback reads the video format's directory; the presentation
# format's is still served for older players
exit 0 unless %w[video presentation].include?(opts[:format])

props = BigBlueButton.read_props
logger = Logger.new("#{props['log_dir']}/post_publish.log", 'weekly')
logger.level = Logger::INFO
BigBlueButton.logger = logger

events_xml = "#{props['recording_dir']}/raw/#{meeting_id}/events.xml"
published_dir = "#{props['published_dir']}/#{opts[:format]}/#{meeting_id}"
unless File.exist?(events_xml) && File.directory?(published_dir)
  logger.info("studio_data: nothing to do for #{meeting_id}")
  exit 0
end

events = Nokogiri::XML(File.read(events_xml))
first = BigBlueButton::Events.first_event_timestamp(events)
last = BigBlueButton::Events.last_event_timestamp(events)

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

names = BigBlueButton::Events.user_name_map(events)

# talking.json: spans from ParticipantTalkingEvent; muting or leaving ends a
# span left open
talking_file = "#{published_dir}/talking.json"
if File.exist?(talking_file)
  logger.info("studio_data: #{talking_file} already there")
else
  spans = Hash.new { |hash, key| hash[key] = [] }
  open_since = {}
  events.xpath('/recording/event[@module="VOICE"]').each do |event|
    user = event.at_xpath('participant')&.text
    next if user.nil?

    timestamp = event['timestamp'].to_i
    case event['eventname']
    when 'ParticipantTalkingEvent'
      if event.at_xpath('talking')&.text == 'true'
        open_since[user] ||= timestamp
      elsif open_since.key?(user)
        spans[user] << [open_since.delete(user), timestamp]
      end
    when 'ParticipantMutedEvent'
      spans[user] << [open_since.delete(user), timestamp] if event.at_xpath('muted')&.text == 'true' && open_since.key?(user)
    when 'ParticipantLeftEvent'
      spans[user] << [open_since.delete(user), timestamp] if open_since.key?(user)
    end
  end
  open_since.each { |user, since| spans[user] << [since, last] }

  talking = {}
  spans.each do |user, list|
    list.each do |start, stop|
      # The part of the span in each recording period
      periods.each do |period|
        from = [start, period[:start_timestamp]].max
        to = [stop, period[:stop_timestamp]].min
        next if to <= from

        entry = (talking[user] ||= { userName: names[user].to_s, events: [] })
        entry[:events] << { start: to_recording.call(from), stop: to_recording.call(to) }
      end
    end
  end
  talking.each_value { |entry| entry[:events].sort_by! { |e| e[:start] } }
  File.write(talking_file, JSON.generate(talking))
  logger.info("studio_data: wrote talking for #{talking.size} participant(s) to #{talking_file}")
end

# timeline.json: raised hands (only when raised) and reactions
timeline = []
events.xpath('/recording/event[@eventname="ParticipantStatusChangeEvent"]').each do |event|
  status = event.at_xpath('status')&.text
  value = event.at_xpath('value')&.text.to_s
  type = if status == 'raiseHand' && value == 'true' then 'hand'
         elsif status == 'reactionEmoji' && !value.empty? && value != 'none' then 'reaction'
         end
  next if type.nil?

  time = to_recording.call(event['timestamp'].to_i)
  next if time.nil?

  item = { time: time, type: type, name: names[event.at_xpath('userId')&.text].to_s }
  item[:emoji] = value if type == 'reaction'
  timeline << item
end
timeline.sort_by! { |item| item[:time] }

timeline_file = "#{published_dir}/timeline.json"
File.write(timeline_file, JSON.generate(timeline))
logger.info("studio_data: wrote #{timeline.size} moment(s) to #{timeline_file} (meeting #{first}..#{last})")

exit 0
