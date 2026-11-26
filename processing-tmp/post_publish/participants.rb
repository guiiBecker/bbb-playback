# frozen_string_literal: true

# Publishes the meeting's participants next to a presentation recording, as
# participants.json, for the playback's participant list.
#
# The published recording keeps only their number (metadata.xml); the names
# are in the raw events.xml, which is not published. This runs after each
# publish (post_publish), or by hand for a recording already published:
#
#   cd /usr/local/bigbluebutton/core/scripts/post_publish
#   sudo -u bigbluebutton ruby participants.rb -m <record id> -f presentation
#
# Only each person's name and role are written, in the order they first
# joined: no internal or external user ids, no join or leave times.

require 'json'
require 'optimist'
require File.expand_path('../../../lib/recordandplayback', __FILE__)

opts = Optimist.options do
  opt :meeting_id, 'Meeting id', type: String
  opt :format, 'Playback format name', type: String
end
meeting_id = opts[:meeting_id]
exit 0 unless opts[:format] == 'presentation'

props = BigBlueButton.read_props
logger = Logger.new("#{props['log_dir']}/post_publish.log", 'weekly')
logger.level = Logger::INFO
BigBlueButton.logger = logger

events_xml = "#{props['recording_dir']}/raw/#{meeting_id}/events.xml"
published_dir = "#{props['published_dir']}/presentation/#{meeting_id}"
unless File.exist?(events_xml) && File.directory?(published_dir)
  logger.info("participants: nothing to do for #{meeting_id}")
  exit 0
end

events = Nokogiri::XML(File.read(events_xml))

# Someone who leaves and comes back joins again with a new internal user id;
# the external id (from the join call) groups them, else the name does
people = {}
events.xpath('/recording/event[@eventname="ParticipantJoinEvent"]').each do |event|
  name = event.at_xpath('name')&.text.to_s.strip
  next if name.empty?

  external_id = event.at_xpath('externalUserId')&.text.to_s
  key = external_id.empty? ? "name:#{name}" : "ext:#{external_id}"
  person = (people[key] ||= { name: name, role: 'VIEWER' })
  person[:name] = name # the latest name, if it changed
  person[:role] = 'MODERATOR' if event.at_xpath('role')&.text == 'MODERATOR'
end

# Role changes during the meeting (a viewer promoted to moderator)
events.xpath('/recording/event[@eventname="ParticipantStatusChangeEvent"]').each do |event|
  next unless event.at_xpath('status')&.text == 'role' && event.at_xpath('value')&.text == 'MODERATOR'

  user_id = event.at_xpath('userId')&.text
  join = events.at_xpath(%(/recording/event[@eventname="ParticipantJoinEvent"][userId="#{user_id}"]))
  next unless join

  external_id = join.at_xpath('externalUserId')&.text.to_s
  key = external_id.empty? ? "name:#{join.at_xpath('name')&.text.to_s.strip}" : "ext:#{external_id}"
  people[key][:role] = 'MODERATOR' if people[key]
end

output = "#{published_dir}/participants.json"
File.write(output, JSON.generate(people.values))
logger.info("participants: wrote #{people.size} participant(s) to #{output}")

exit 0
