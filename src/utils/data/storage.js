import { files } from 'config';
import {
  addAlternatesToThumbnails,
  build,
  mergeMessages,
} from 'utils/builder';
import {
  ERROR,
  ID,
} from 'utils/constants';
import {
  buildFileURL,
  buildVideoURL,
  getFileType,
} from 'utils/data';
import {
  hasPresentation,
  hasProperty,
  isEmpty,
} from 'utils/data/validators';
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
  const filesLoaded = Object.keys(files).every(data => Object.hasOwn(DATA, data));
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
          return response.json();
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

// The recording's video is the "video" format's MP4, and only it: without it
// the recording cannot be played. Only a video answer counts: a server that
// answers unknown paths with a page (a single page app's fallback) says 200 too
const fetchMedia = (recordId, onUpdate, onLoaded, onError) => {
  const url = buildVideoURL('video-0.mp4', recordId);
  fetch(url, { method: 'HEAD' }).then(response => {
    const type = (response.headers?.get('content-type') || '').toLowerCase();
    if (!response.ok || !type.startsWith('video/')) {
      logger.warn(ID.STORAGE, ID.MEDIA, response);
      onError(ERROR.NOT_FOUND);
      return;
    }

    logger.debug(ID.STORAGE, ID.MEDIA, response);
    DATA[ID.MEDIA] = { type: 'video/mp4', url };
    onUpdate(ID.MEDIA);
    if (hasLoaded()) onLoaded();
  }).catch(error => {
    logger.warn(ID.STORAGE, ID.MEDIA, error);
    onError(ERROR.NOT_FOUND);
  });
};

const storage = {
  fetch: (recordId, onUpdate, onLoaded, onError) => {
    if (hasFetched()) return null;

    for (const data in files) {
      fetchFile(data, recordId, onUpdate, onLoaded, onError);
    }

    fetchMedia(recordId, onUpdate, onLoaded, onError);
  },
  get status() {
    return STATUS;
  },
  get data() {
    return DATA;
  },
  get built() {
    return {
      captions: hasProperty(DATA, ID.CAPTIONS),
      chat: hasProperty(DATA, ID.CHAT),
      notes: hasProperty(DATA, ID.NOTES),
      polls: hasProperty(DATA, ID.POLLS),
      videos: hasProperty(DATA, ID.VIDEOS),
      presentation: hasProperty(DATA, ID.SHAPES),
      screenshare: hasProperty(DATA, ID.SCREENSHARE),
      layoutSwap: hasProperty(DATA, ID.LAYOUT),
    };
  },
  get content() {
    return {
      captions: !isEmpty(this.captions),
      chat: !isEmpty(this.chat),
      notes: !isEmpty(this.notes),
      polls: !isEmpty(this.polls),
      videos: !isEmpty(this.videos),
      presentation: hasPresentation(this.slides),
      screenshare: !isEmpty(this.screenshare),
      layoutSwap: !isEmpty(this.layoutSwap),
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
  get videos() {
    return DATA[ID.VIDEOS];
  },
  get cursor() {
    const result = DATA[ID.CURSOR];
    return result ? result.data : [];
  },
  // { url, type } of the recording's MP4
  get media() {
    return DATA[ID.MEDIA];
  },
  get messages() {
    if (!hasProperty(DATA, ID.MESSAGES)) {
      DATA[ID.MESSAGES] = mergeMessages(
        this.chat,
        this.polls,
        this.videos,
      );
    }

    return DATA[ID.MESSAGES];
  },
  get metadata() {
    return DATA[ID.METADATA];
  },
  get notes() {
    return DATA[ID.NOTES];
  },
  get panzooms() {
    const result = DATA[ID.PANZOOMS];
    return result ? result.data : [];
  },
  get screenshare() {
    return DATA[ID.SCREENSHARE];
  },
  get shapes() {
    return DATA[ID.SHAPES];
  },
  get slides() {
    return this.shapes[ID.SLIDES];
  },
  get canvases() {
    return this.shapes[ID.CANVASES];
  },
  get thumbnails() {
    if (!hasProperty(DATA, ID.THUMBNAILS)) {
      DATA[ID.THUMBNAILS] = addAlternatesToThumbnails(this.shapes[ID.THUMBNAILS], this.alternates);
    }

    return DATA[ID.THUMBNAILS];
  },
  get layoutSwap() {
    return DATA[ID.LAYOUT];
  },
  get tldraw() {
    return DATA[ID.TLDRAW];
  },
};

export default storage;
