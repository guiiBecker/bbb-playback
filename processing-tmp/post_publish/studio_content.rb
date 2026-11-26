# frozen_string_literal: true

# Publishes, next to a recording of the video format, what the meeting had
# besides its video. The presentation format published this; the video format
# does not, and the new playback reads the video format's directory only.
#
#   notes.html  the shared notes as they were when the meeting ended (the
#               archive step's export of the pad), for the Notes tab. Not
#               written for a meeting without shared notes.
#
# Everyone who can open the recording can read these files, as with the
# presentation format's.
#
# Runs after each publish (post_publish), or by hand for one already published:
#
#   cd /usr/local/bigbluebutton/core/scripts/post_publish
#   sudo -u bigbluebutton ruby studio_content.rb -m <record id> -f video

require 'fileutils'
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

exit 0
