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
// <chattimeline> entries as the presentation format's slides_new.xml), and
// the shared notes (notes.html, published from the recording's raw files by
// the post_publish step, with notes.pdf). The JSON files next to them
// (layout.json, talking.json, timeline.json, participants.json) are optional
// and fetched where they are used
const files = {
  captions: 'captions.json',
  chat: 'video.xml',
  metadata: 'metadata.xml',
  notes: 'notes.html',
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
  search,
  shortcuts,
  styles,
  thumbnails,
};
