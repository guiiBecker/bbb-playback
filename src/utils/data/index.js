import {
  MEDIA_ROOT_URL,
  NUMBERS,
  ROUTER,
} from 'utils/constants';
import storage from 'utils/data/storage';
import {
  hasProperty,
  isCurrent,
  isEmpty,
  isVisible,
} from 'utils/data/validators';
import hash from 'utils/hash';
import { getMediaPath } from 'utils/params';

const buildFileURL = (file, recordId = null) => {
  if (!ROUTER) return file;

  const mediaPath = getMediaPath();

  const rootUrl = MEDIA_ROOT_URL ? MEDIA_ROOT_URL : '/playback/video';

  const id = recordId ? recordId : storage.metadata.id;
  let fileUrl = `${id}/${file}`;
  if (mediaPath) fileUrl = `${mediaPath}/${fileUrl}`;

  return `${rootUrl}/${fileUrl}`;
};

// A file of the presentation format (/presentation/<record id>/): what the
// video format does not publish (config.js, `presentation`)
const buildPresentationFileURL = (file, recordId = null) => {
  if (!ROUTER) return file;

  const mediaPath = getMediaPath();
  const id = recordId ? recordId : storage.metadata.id;
  let fileUrl = `${id}/${file}`;
  if (mediaPath) fileUrl = `${mediaPath}/${fileUrl}`;

  return `/presentation/${fileUrl}`;
};

const getAvatarStyle = name => {
  const index = hash(name) % NUMBERS.length;

  return `avatar-${NUMBERS[index]}`;
};

const getCurrentDataIndex = (data, time) => {
  if (isEmpty(data)) return -1;

  let start = 0;
  let stop = data.length - 1;
  let middle = Math.floor((start + stop) / 2);

  while (!isCurrent(data, middle, time) && start < stop) {
    const item = data[middle];
    if (!hasProperty(item, 'timestamp')) return -1;

    if (!isVisible(time, item.timestamp)) {
      stop = middle - 1;
    } else {
      start = middle + 1;
    }

    middle = Math.floor((start + stop) / 2);
  }

  const current = isCurrent(data, middle, time);

  return (!current) ? -1 : middle;
};

const getFileType = file => file.split('.').pop();

const POLL_TYPES = {
  YN: 'YN',
  YNA: 'YNA',
  TF: 'TF',
};

const POLL_KEYS = [
  'Yes',
  'No',
  'Abstention',
  'True',
  'False',
];

const getPollLabel = (key, type) => {
  if (!POLL_TYPES[type]) return null;

  if (!POLL_KEYS.includes(key)) return null;

  return key.toLowerCase();
};

const caseInsensitiveReducer = (acc, item) => {
  const index = acc.findIndex(ans => ans.key.toLowerCase() === item.key.toLowerCase());
  if (index !== -1) {
    if (acc[index].numVotes >= item.numVotes) acc[index].numVotes += item.numVotes;
    else {
      const tempVotes = acc[index].numVotes;
      acc[index] = item;
      acc[index].numVotes += tempVotes;
    }
  } else {
    acc.push(item);
  }
  return acc;
};

export {
  buildFileURL,
  buildPresentationFileURL,
  getAvatarStyle,
  getCurrentDataIndex,
  getFileType,
  getPollLabel,
  caseInsensitiveReducer,
};
