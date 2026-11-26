const chat = {
  align: 'bottom',
  scroll: true,
};

const controls = {
  about: true,
  fullscreen: true,
  search: true,
  section: true,
  swap: true,
  theme: true,
};

const date = { enabled: true };

// The recording is the "video" format's (/playback/video/<record id>/): its
// MP4 (or M4V), metadata, captions and chat (video.xml, the same
// <chattimeline> entries as the presentation format's slides_new.xml). The
// JSON files next to them (layout.json, talking.json, timeline.json,
// participants.json) are optional and fetched where they are used
const files = {
  captions: 'captions.json',
  chat: 'video.xml',
  metadata: 'metadata.xml',
};

// What the video format does not publish, read from the presentation
// format's folder (/presentation/<record id>/) as the classic player read
// it: the shared notes, the polls, and for the chapters and the timeline the
// slides and screen sharing shown (shapes.svg, with the slides' text, the
// screen sharing and the layout swaps). All optional: on a server that does
// not run the presentation format, the recording has no notes, polls or
// chapters
const presentation = {
  alternates: 'presentation_text.json',
  layout: 'layout.xml',
  notes: 'notes.html',
  polls: 'polls.json',
  screenshare: 'deskshare.xml',
  shapes: 'shapes.svg',
};

const locale = { default: 'en' };

const player = {
  rps: 10,
  rates: [0.5, 1, 1.25, 1.5, 1.75, 2],
};

const search = {
  length: {
    min: 3,
    max: 32,
  },
};

const shortcuts = {
  enabled: true,
  fullscreen: 'K',
  play: 'Enter',
  section: 'L',
  seek: {
    backward: 'ArrowLeft',
    forward: 'ArrowRight',
    seconds: 15,
  },
  skip: {
    next: 'ArrowUp',
    previous: 'ArrowDown',
  },
  swap: 'M',
};

const styles = {
  default: null,
  url: 'HOST',
  valid: [],
};

const thumbnails = {
  align: 'center',
  scroll: true,
};

export {
  chat,
  controls,
  date,
  files,
  locale,
  player,
  presentation,
  search,
  shortcuts,
  styles,
  thumbnails,
};
