# Recording processing for the redesigned playback (temporary)

**Temporary folder.** It holds the server-side pieces the redesigned
playback (`src/components/studio/`) needs, until they are proposed to
`bigbluebutton/bigbluebutton` (`record-and-playback/`). Remove it then.

## What the playback reads

The redesigned playback plays one MP4 with everything in it (slides or
screen sharing, webcams, audio). That same file is the download. Next to it
are data files for the panel and the overlays:

| File | Where | Made by | Used for |
|---|---|---|---|
| `video-0.mp4` | `/playback/video/<id>/` | the `video` format | the stage, and the download |
| `layout.json` | `/playback/video/<id>/` | the `video` format (patch not here yet, see below) | names over the webcams, hiding them |
| `talking.json` | `/presentation/<id>/` | `post_publish/studio_data.rb` | who is talking |
| `timeline.json` | `/presentation/<id>/` | `post_publish/studio_data.rb` | raised hands and reactions on the timeline |
| `participants.json` | `/presentation/<id>/` | `post_publish/participants.rb` | the participants list |
| slides, chat, captions, notes... | `/presentation/<id>/` | the `presentation` format, as today | panel tabs, chapters, markers |

The playback plays **only** `video-0.mp4`: no WebM, no webcams video or audio
of the `presentation` format. Without it the recording shows the "not found"
error. Every JSON is optional. If one is missing, its feature is just not
shown.

## What is here

- `presentation-data-only.patch`: the `presentation` format with
  `video_formats: []` publishes data only. It makes no webcams video and no
  screen sharing video, because the MP4 has them. The audio mix is still
  published, so older players keep the sound. The patch is written against
  `bigbluebutton/bigbluebutton` `v4.0.x-release`.
- `post_publish/studio_data.rb`: writes `talking.json` and `timeline.json`
  from the raw `events.xml`.
- `post_publish/participants.rb`: writes `participants.json`.
- `make-data-copy.sh`: makes an isolated copy of the server's recording core
  with the patch and the post_publish scripts. The installed core is not
  changed.
- `publish-presentation-data.sh <record id>`: processes and publishes one
  recording, data only, from that copy. Then it runs the post_publish
  scripts. The raw files must still be on the server.

## Not here yet: the master MP4 and `layout.json`

The MP4 comes from BBB's `video` format with a new preset:
- 1920x1080 at 15 fps;
- presentation or screen sharing 16:9 on the left, a fixed column of up to
  4 webcams on the right;
- the presentation drawn at 5 fps;
- background `#001428`, the playback's `--studio-player`, so the video
  blends into the stage.

Each render also writes `layout.json`. Those changes are not in this folder
yet. They will come when they are written on top of the upstream
`video` format. Until then, test with recordings that already have them
(ask the team).

Every recording the playback opens needs the master MP4. The data-only patch
leaves the `presentation` format without any video, which is fine for this
playback: it never plays the `presentation` format's media.

## Usage, on a BBB server

```sh
sudo ./make-data-copy.sh                      # once: /var/bigbluebutton/recording/rap-presentation-data
sudo ./publish-presentation-data.sh <record id>
```

The previous published copy of the recording goes to
`/var/bigbluebutton/recording/presentation-backup/` (`BACKUP=...` to
change). If the publish fails, it is put back.

The post_publish scripts can also run alone, on a recording already
published:

```sh
cd /usr/local/bigbluebutton/core/scripts/post_publish   # after copying them there
sudo -u bigbluebutton ruby studio_data.rb -m <record id> -f presentation
sudo -u bigbluebutton ruby participants.rb -m <record id> -f presentation
```

## File formats

Times are in seconds of the published recording. The recording periods are
joined, and anything outside them is dropped.

```jsonc
// talking.json
{ "<user id>": { "userName": "Ana", "events": [{ "start": 12.3, "stop": 15.0 }] } }

// timeline.json, in time order
[{ "time": 90.4, "type": "reaction", "name": "Ana", "emoji": "👍" },
 { "time": 93.0, "type": "hand", "name": "Bia" }]

// participants.json, in the order people first joined
[{ "name": "Ana", "role": "MODERATOR" }, { "name": "Bia", "role": "VIEWER" }]

// layout.json (video format): sizes in video pixels
{ "width": 1920, "height": 1080,
  "content": { "x": 20, "y": 155, "width": 1400, "height": 770 },  // presentation area
  "people": { "<user id>": { "name": "Ana" } },
  "tiles": [{ "start": 0.4, "end": 1.1, "x": 1440, "y": 358, "width": 480,
              "height": 364, "border": 10, "user": "<user id>" }] }
```

## Cost

Measured on 3 recordings of 25-33 minutes, on a 2 vCPU (1 physical core)
server:

| | CPU seconds per recorded minute | Published size |
|---|---|---|
| `presentation` today (webcams mosaic) | 9.6-10.4 | - |
| `presentation`, data only | 1.5-1.9 | 28-36 MB per recording (mostly slide images) |
| master MP4, 1080p (with webcams) | 23.5-24.9 | 173-183 MB per hour |
| master MP4, 1080p (screen sharing only) | 14.2 | 131 MB per hour |
