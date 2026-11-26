# Recording processing for the redesigned playback (temporary)

**Temporary folder.** It holds the server-side pieces the redesigned
playback (`src/components/studio/`) needs, until they are proposed to
`bigbluebutton/bigbluebutton` (`record-and-playback/`). Remove it then.

## What the playback reads

Only BBB's **`video` recording format** runs. The `presentation` format is not
needed. The playback reads one folder, `/playback/video/<record id>/`:

| File | Made by | Used for |
|---|---|---|
| `video-<n>.m4v` / `video-<n>.mp4` | the `video` format | the stage and the download |
| `metadata.xml` | the `video` format | name, date, duration |
| `captions.json` + `caption_<lang>.vtt` | the `video` format | captions and the Transcription tab |
| `video.xml` | the `video` format | the Chat tab and its markers |
| `layout.json` | the `video` format (change not here yet, see below) | names and who is talking over the webcams, hiding them |
| `talking.json` | `post_publish/studio_data.rb` | who is talking |
| `timeline.json` | `post_publish/studio_data.rb` | raised hands and reactions on the timeline |
| `participants.json` | `post_publish/participants.rb` | the participants list |

**The video.** The playback looks for `video-0.m4v`, then `video-1.m4v`, then
`video-0.mp4`. It plays the first one found and the download offers that same
file. The `video` format names each output `video-<its index in the preset>.<extension>`,
so a preset that outputs `[mp4, m4v]` publishes `video-0.mp4` and `video-1.m4v`.
Both hold the same H.264/AAC. Without any of them the recording shows the
"not found" error. There is no WebM and no `presentation` format fallback.

**The tabs.** All the tabs are always shown. When the recording has nothing
for one, it says so. Notes, Chapters and Apps (polls) came from the
`presentation` format, so they stay empty until the `video` format makes that
data too.

Every JSON is optional. If one is missing, its feature is just not shown.

## What is here

- `post_publish/studio_data.rb`: writes `talking.json` and `timeline.json`
  from the raw `events.xml`.
- `post_publish/participants.rb`: writes `participants.json`.

Both run as post_publish scripts of the `video` format (`-f video`) and write
into its folder. Copy them to
`/usr/local/bigbluebutton/core/scripts/post_publish/` on a BBB server, or run
them by hand on a recording that is already published:

```sh
cd /usr/local/bigbluebutton/core/scripts/post_publish
sudo -u bigbluebutton ruby studio_data.rb -m <record id> -f video
sudo -u bigbluebutton ruby participants.rb -m <record id> -f video
```

The raw files must still be on the server.

## Not here yet: the video format's preset and `layout.json`

The video comes from the `video` format with a new preset:
- 1920x1080 at 15 fps;
- presentation or screen sharing 16:9 on the left, a fixed column of up to
  4 webcams on the right;
- the presentation drawn at 5 fps;
- background `#001428`, the playback's `--studio-player`, so the video
  blends into the stage;
- outputs MP4 and M4V.

Each render also writes `layout.json`. Those changes are not in this folder
yet. They will come when they are written on top of the upstream `video`
format.

Recording pauses need nothing extra: the `video` format joins the recorded
periods (the record button's start and stop in `events.xml`), and the JSON
files use the same timeline.

## Processing steps

With only the `video` format, `bigbluebutton.yml` would have:

```yaml
steps:
  archive: "sanity"
  sanity: "captions"
  captions: "process:video"
  "process:video": "publish:video"
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

Captions may say who speaks with a WebVTT voice span, `<v Ana>text`. The
Transcription tab then shows the name and starts a new paragraph when the
speaker changes.

## Cost

Measured on a 2 vCPU (1 physical core) server, 1080p preset:

| Recording | CPU seconds per recorded minute | Size per hour |
|---|---|---|
| 25-33 min, up to 5 webcams at once | 23.5-24.9 | 173-183 MB |
| 32 min, screen sharing only | 14.2 | 131 MB |
| 1 h 31, 10 webcams, 5 screen shares, 1 pause | 26.6 (24 min of wall time) | 233 MB |
