#!/bin/bash
# Makes an isolated copy of this server's recording core with the presentation
# format as data only (presentation-data-only.patch): no webcams or screen
# sharing video, the "video" format's MP4 is the video. The installed core is
# not touched. Also puts the post_publish scripts of this folder in the copy.
#
#   sudo ./make-data-copy.sh [copy dir]    (default /var/bigbluebutton/recording/rap-presentation-data)
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
COPY=${1:-/var/bigbluebutton/recording/rap-presentation-data}
CORE=/usr/local/bigbluebutton/core

[ -e "$COPY" ] && { echo "$COPY already exists"; exit 1; }
cp -a "$CORE" "$COPY"
# The patch's paths are record-and-playback/presentation/scripts/...: the
# installed core has them under scripts/
patch -p3 -d "$COPY" < "$HERE/presentation-data-only.patch"
install -o bigbluebutton -g bigbluebutton -m 644 "$HERE"/post_publish/*.rb "$COPY/scripts/post_publish/"
chown -R bigbluebutton:bigbluebutton "$COPY"
echo "data-only copy ready: $COPY"
