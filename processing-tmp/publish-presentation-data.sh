#!/bin/bash
# Processes and publishes one recording's presentation format as data only,
# from the copy make-data-copy.sh made, then runs the post_publish scripts
# (participants.json, talking.json, timeline.json). The recording's raw files
# must still be on the server. The published recording is replaced; the
# previous one is kept in BACKUP and put back if the publish fails.
#
#   sudo ./publish-presentation-data.sh <record id>
#   env: COPY (default /var/bigbluebutton/recording/rap-presentation-data),
#        BACKUP (default /var/bigbluebutton/recording/presentation-backup)
set -u
ID=${1:?record id}
COPY=${COPY:-/var/bigbluebutton/recording/rap-presentation-data}
BACKUP=${BACKUP:-/var/bigbluebutton/recording/presentation-backup}
REC=/var/bigbluebutton/recording
PUBLISHED=/var/bigbluebutton/published/presentation
as_bbb() { sudo -u bigbluebutton "$@"; }

[ -f "$REC/raw/$ID/events.xml" ] || { echo "no raw files for $ID"; exit 1; }
cd "$COPY/scripts" || exit 1

echo "processing $ID"
rm -rf "$REC/process/presentation/$ID"
START=$(date +%s%3N)
as_bbb bundle exec ruby process/presentation.rb -m "$ID" > /dev/null 2>&1 || { echo "process failed, see /var/log/bigbluebutton/presentation/process-$ID.log"; exit 1; }
# rap-process-worker writes the step's time (ms) for publish; by hand, here
echo $(( $(date +%s%3N) - START )) | as_bbb tee "$REC/process/presentation/$ID/processing_time" > /dev/null

mkdir -p "$BACKUP"
SAVED="$BACKUP/$ID-$(date +%Y%m%d%H%M%S)"
[ -d "$PUBLISHED/$ID" ] && mv "$PUBLISHED/$ID" "$SAVED"
rm -rf "$REC/publish/presentation/$ID"
as_bbb bundle exec ruby publish/presentation.rb -m "$ID-presentation" > /dev/null 2>&1
if [ ! -f "$PUBLISHED/$ID/metadata.xml" ]; then
  echo "publish failed, see /var/log/bigbluebutton/presentation/publish-$ID.log; previous one put back"
  rm -rf "$PUBLISHED/$ID"; [ -d "$SAVED" ] && mv "$SAVED" "$PUBLISHED/$ID"
  exit 1
fi

cd post_publish
for script in participants.rb studio_data.rb; do
  as_bbb bundle exec ruby "$script" -m "$ID" -f presentation > /dev/null 2>&1 || echo "$script failed, see /var/log/bigbluebutton/post_publish.log"
done
echo "published: $(ls "$PUBLISHED/$ID" | tr '\n' ' ')"
