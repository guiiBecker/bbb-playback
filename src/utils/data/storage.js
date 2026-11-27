import { files, presentation } from 'config';
import {
  addAlternatesToThumbnails,
  build,
} from 'utils/builder';
import {
  ERROR,
  ID,
} from 'utils/constants';
import {
  buildFileURL,
  buildPresentationFileURL,
  getFileType,
} from 'utils/data';
import { hasProperty } from 'utils/data/validators';
import logger from 'utils/logger';

const STATE = {
  WAITING: 'waiting',
  LOADING: 'loading',
  LOADED: 'loaded',
};

let STATUS = STATE.WAITING;

const DATA = {};

const hasFetched = () => {
  if (STATUS !== STATE.WAITING) return true;

  logger.debug(ID.STORAGE, STATE.LOADING);
  STATUS = STATE.LOADING;

  return false;
}

// Every file and the media probe must be in. Counting the stored keys is not
// enough: the media probe is stored in the same object, so the count could
// reach the number of files with one of them still missing
const hasLoaded = () => {
  const filesLoaded = [...Object.keys(files), ...Object.keys(presentation)]
    .every(data => Object.hasOwn(DATA, data));
  const mediaLoaded = Object.hasOwn(DATA, ID.MEDIA);

  if (filesLoaded && mediaLoaded) {
    logger.debug(ID.STORAGE, STATE.LOADED);
    STATUS = STATE.LOADED;

    return true;
  }

  return false;
};

const fetchFile = (data, recordId, onUpdate, onLoaded, onError) => {
  const file = files[data];
  const url = buildFileURL(file, recordId);
  fetch(url).then(response => {
    if (response.ok) {
      logger.debug(ID.STORAGE, file, response);
      const fileType = getFileType(file);
      switch (fileType) {
        case 'json':
          // Not JSON (a server's page for an unknown path): as if missing
          return response.json().catch(() => null);
        case 'html':
          return response.text();
        case 'svg':
          return response.text();
        case 'xml':
          return response.text();
        default:
          onError(ERROR.BAD_REQUEST);
          return null;
      }
    } else {
      logger.warn(ID.STORAGE, file, response);
      return null;
    }
  }).then(value => {
    build(file, value).then(content => {
      if (content) logger.debug(ID.STORAGE, 'built', file);
      DATA[data] = content;
      onUpdate(data);
      if (hasLoaded()) onLoaded();
    }).catch(error => onError(ERROR.BAD_REQUEST));
  }).catch(error => onError(ERROR.NOT_FOUND));
};

// A file of the presentation format (config.js, `presentation`): the notes,
// the polls and what the chapters and the timeline are made of, which the
// video format does not publish. Optional: a missing or broken file leaves
// its part of the player empty and is never an error, so a recording of a
// server without the presentation format still plays
const fetchPresentationFile = (data, recordId, onUpdate, onLoaded) => {
  const file = presentation[data];
  const store = content => {
    DATA[data] = content;
    onUpdate(data);
    if (hasLoaded()) onLoaded();
  };

  fetch(buildPresentationFileURL(file, recordId))
    .then(response => {
      if (!response.ok) return null;

      return getFileType(file) === 'json' ? response.json() : response.text();
    })
    .then(value => build(file, value))
    .then(store)
    .catch(error => {
      logger.warn(ID.STORAGE, file, error);
      // What the builder gives for a missing file
      build(file, null).then(store).catch(() => store(null));
    });
};

// The recording's video is the "video" format's, as M4V or MP4 (the same
// H.264/AAC), and only it: without it the recording cannot be played. The
// M4V comes first; the MP4 is played when there is no M4V. Only a
// video answer counts: a server that answers unknown paths with a page (a
// single page app's fallback) says 200 too
// The format names each output video-<its index in the preset>.<extension>:
// video-0.mp4 and video-1.m4v for [mp4, m4v], video-0.m4v for [m4v]
const VIDEO_FILES = ['video-0.m4v', 'video-1.m4v', 'video-0.mp4'];

const probeVideo = (url) => fetch(url, { method: 'HEAD' })
  .then(response => {
    const type = (response.headers?.get('content-type') || '').toLowerCase();
    return response.ok && type.startsWith('video/');
  })
  .catch(error => {
    logger.warn(ID.STORAGE, ID.MEDIA, url, error);
    return false;
  });

const fetchMedia = (recordId, onUpdate, onLoaded, onError) => {
  const urls = VIDEO_FILES.map(file => buildFileURL(file, recordId));
  Promise.all(urls.map(probeVideo)).then(found => {
    const url = urls.find((_, index) => found[index]);
    if (!url) {
      onError(ERROR.NOT_FOUND);
      return;
    }

    logger.debug(ID.STORAGE, ID.MEDIA, url);
    // Browsers play an M4V as the MP4 it is
    DATA[ID.MEDIA] = { type: 'video/mp4', url };
    onUpdate(ID.MEDIA);
    if (hasLoaded()) onLoaded();
  });
};

const storage = {
  fetch: (recordId, onUpdate, onLoaded, onError) => {
    if (hasFetched()) return null;

    for (const data in files) {
      fetchFile(data, recordId, onUpdate, onLoaded, onError);
    }

    for (const data in presentation) {
      fetchPresentationFile(data, recordId, onUpdate, onLoaded);
    }

    fetchMedia(recordId, onUpdate, onLoaded, onError);
  },
  get status() {
    return STATUS;
  },
  get built() {
    return {
      captions: hasProperty(DATA, ID.CAPTIONS),
      chat: hasProperty(DATA, ID.CHAT),
      notes: hasProperty(DATA, ID.NOTES),
      polls: hasProperty(DATA, ID.POLLS),
      presentation: hasProperty(DATA, ID.SHAPES),
      screenshare: hasProperty(DATA, ID.SCREENSHARE),
      layoutSwap: hasProperty(DATA, ID.LAYOUT),
    };
  },
  get alternates() {
    return DATA[ID.ALTERNATES];
  },
  get captions() {
    return DATA[ID.CAPTIONS];
  },
  get chat() {
    return DATA[ID.CHAT];
  },
  get polls() {
    return DATA[ID.POLLS];
  },
  // { url, type } of the recording's M4V (or MP4)
  get media() {
    return DATA[ID.MEDIA];
  },
  get metadata() {
    return DATA[ID.METADATA];
  },
  // The video format's folder first (notes.html, published by the
  // post_publish step); the presentation format's when that one has none
  get notes() {
    return DATA[ID.NOTES] || DATA.presentationNotes;
  },
  get screenshare() {
    return DATA[ID.SCREENSHARE];
  },
  // From the presentation format's shapes.svg: the slides and screen sharing
  // shown, for the chapters and the timeline. Empty where the server does
  // not publish that format
  get shapes() {
    return DATA[ID.SHAPES] || {};
  },
  get slides() {
    return this.shapes[ID.SLIDES] || [];
  },
  // What the presentation area showed: the video format's slides.json first,
  // the presentation format's shapes.svg when that one has none
  get thumbnails() {
    if ((DATA.videoSlides || []).length) return DATA.videoSlides;
    if (!hasProperty(DATA, ID.THUMBNAILS)) {
      const thumbnails = this.shapes[ID.THUMBNAILS];
      DATA[ID.THUMBNAILS] = thumbnails ? addAlternatesToThumbnails(thumbnails, this.alternates || []) : [];
    }

    return DATA[ID.THUMBNAILS];
  },
  get layoutSwap() {
    return DATA[ID.LAYOUT];
  },
};

export default storage;
