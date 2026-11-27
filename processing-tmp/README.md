# Recording processing for the redesigned playback (temporary)

**Temporary folder.** It holds the server-side pieces the redesigned
playback (`src/components/studio/`) needs, until they are proposed to
`bigbluebutton/bigbluebutton` (`record-and-playback/`). Remove it then.
Everything here is written on top of the **public** BigBlueButton code
(`v4.0.x-release`).

## What the playback reads

The playback plays BBB's **`video` recording format** and reads its folder,
`/playback/video/<record id>/`:

| File | Made by | Used for |
|---|---|---|
| `video-0.m4v` / `video-1.mp4` | the `video` format | the stage and the download |
| `metadata.xml` | the `video` format | name, date, duration |
| `captions.json` + `caption_<lang>.vtt` | the `video` format | captions and the Transcription tab |
| `video.xml` | the `video` format | the Chat tab and its markers |
| `layout.json` | the `video` format, with `video-format-playback.patch` | names and who is talking over the webcams, hiding them, rounded corners |
| `talking.json` | `post_publish/studio_data.rb` | who is talking |
| `timeline.json` | `post_publish/studio_data.rb` | raised hands (with who raised them) and reactions on the timeline |
| `notes.html` + `notes.pdf` | `post_publish/studio_data.rb` | the Notes tab, its PDF download (its Markdown is made in the browser) |
| `participants.json` | `post_publish/participants.rb` | the participants list |
| `slides.json` + `presentation/<id>/thumbnails/` | `post_publish/chapters.rb` | the Chapters tab, slide and screen sharing markers, the chapters in the download |

**The video.** The playback looks for `video-0.m4v`, then `video-1.m4v`, then
`video-0.mp4`. It plays the first one found and the download offers that same
file. The `video` format names each output `video-<its index in the preset>.<extension>`.
BBB's own presets write `video-0.m4v`, so the playback plays a stock `video`
format recording too, without the overlays. Without any of these files the
recording shows the "not found" error. There is no WebM, and the video never
comes from the `presentation` format.

**The tabs.** All the tabs are always shown. When the recording has nothing
for one, it says so. The notes and the chapters come from the `video`
format's folder (`notes.html` from `post_publish/studio_data.rb`,
`slides.json` from `post_publish/chapters.rb`). What is not there is read
from the `presentation` format's folder, `/presentation/<record id>/`, when
it is there, as the classic player did: the polls (`polls.json`), and the
notes or the slides (`shapes.svg`, `presentation_text.json`,
`deskshare.xml`, `layout.xml`) of a recording whose `video` folder has none.
Nothing has to be installed for that. On a server that does not run the
`presentation` format, only Apps (polls) is empty.

Every JSON is optional. If one is missing, its feature is just not shown.

## What is here

### `video-format-playback.patch`

A patch for `record-and-playback/` of `bigbluebutton/bigbluebutton`
`v4.0.x-release`. It applies cleanly with `git apply`. It changes:

- `video/scripts/video.yml`: a new preset, `playback-1080p`:
  - 1920x1080 at 15 fps, with the presentation drawn at 5 fps
    (`presentation_framerate`), since its pictures change seldom;
  - the presentation or the screen sharing 16:9 on the left, a fixed column
    of webcams on the right, the same all through the recording (no
    alternative `layouts`);
  - `background_color: '#102133'`, the playback's background, so the video
    blends into the player;
  - outputs `.m4v` (`video-0`) and `.mp4` (`video-1`), the same H.264/AAC.
- `core/lib/recordandplayback/edl/video.rb` and `edl/video/video_source.rb`:
  - the background colour, white before, comes from the preset's
    `background_color`;
  - an area can be drawn at its own rate (`presentation_framerate`);
  - the H.264 is tagged BT.601, the matrix ffmpeg converts with, so browsers
    show the colours as rendered;
  - each cut writes where every video sits, and the render joins them.
- `video/scripts/process/video.rb`: writes `layout.json`, which holds the
  webcam tiles with their owner (from the `StartWebRTCShareEvent` user id),
  the names, and the presentation area.
- `video/scripts/publish/video.rb`: publishes `layout.json`.

The default preset stays `720p`. A server picks this one in
`/etc/bigbluebutton/recording/video.yml`:

```yaml
default_preset: "playback-1080p"
```

or per meeting with the `bbb-recording-video-preset` meta parameter.

### `post_publish/`

- `studio_data.rb`: writes `talking.json` and `timeline.json` from the raw
  `events.xml`, and publishes the shared notes the archive step exported
  (`notes.html`, `notes.pdf`).
- `participants.rb`: writes `participants.json`.
- `chapters.rb`: writes `slides.json`, what the presentation area showed
  (each slide with its thumbnail and text, and the screen sharing), and
  publishes the thumbnails of the slides shown. Its sequence is the
  `presentation` format's (`publish/presentation.rb`, `process_presentation`):
  on two recordings it gives the same slides at the same times as that
  format's `shapes.svg`.

Both run as post_publish scripts of the `video` format (`-f video`) and write
into its folder. Copy them to
`/usr/local/bigbluebutton/core/scripts/post_publish/` on a BBB server, or run
them by hand on a recording that is already published:

```sh
cd /usr/local/bigbluebutton/core/scripts/post_publish
sudo -u bigbluebutton ruby studio_data.rb -m <record id> -f video
sudo -u bigbluebutton ruby participants.rb -m <record id> -f video
sudo -u bigbluebutton ruby chapters.rb -m <record id> -f video
```

The raw files must still be on the server.

## Processing steps

With only the `video` format (no notes, chapters or polls in the playback,
see above), `bigbluebutton.yml` would have:

```yaml
steps:
  archive: "sanity"
  sanity: "captions"
  captions: "process:video"
  "process:video": "publish:video"
```

Recording pauses need nothing extra: the `video` format joins the recorded
periods (the record button's start and stop in `events.xml`), and the JSON
files use the same timeline.

## File formats

Times are in seconds of the published recording. The recording periods are
joined, and anything outside them is dropped.

```jsonc
// layout.json (video format): sizes in pixels of the video
{ "width": 1920, "height": 1080,
  "content": { "x": 24, "y": 144, "width": 1392, "height": 783 },  // presentation area
  "people": { "<user id>": { "name": "Ana" } },
  "tiles": [{ "start": 0.4, "end": 1.1, "x": 1531, "y": 24, "width": 274,
              "height": 206, "border": 0, "user": "<user id>" }] }

// talking.json
{ "<user id>": { "userName": "Ana", "events": [{ "start": 12.3, "stop": 15.0 }] } }

// timeline.json, in time order
[{ "time": 90.4, "type": "reaction", "name": "Ana", "emoji": "👍" },
 { "time": 93.0, "type": "hand", "name": "Bia" }]

// participants.json, in the order people first joined
[{ "name": "Ana", "role": "MODERATOR" }, { "name": "Bia", "role": "VIEWER" }]
```

Captions may say who speaks with a WebVTT voice span, `<v Ana>text`. The
Transcription tab then shows the name and starts a new paragraph when the
speaker changes.

## Cost

The `playback-1080p` preset, measured on a 2 vCPU (1 physical core) server:

| Recording | CPU seconds per recorded minute | Each output file |
|---|---|---|
| 25 min, up to 5 webcams at once | 30.8 (8 min 42 s of wall time) | 59.6 MB |
