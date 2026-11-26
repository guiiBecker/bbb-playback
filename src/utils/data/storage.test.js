import { files } from 'config';
import { ERROR } from 'utils/constants';

const MISSING = { ok: false, status: 404, headers: { get: () => null } };
const VIDEO = { ok: true, status: 200, headers: { get: () => 'video/mp4' } };
// The recording's MP4, the "video" format's, as the fetch mock keys it
const MASTER = 'HEAD rec/video-0.mp4';

// Fresh storage module per test: it keeps the fetched data in module state
const loadStorage = () => {
  let storage;
  jest.isolateModules(() => {
    storage = require('./storage').default;
  });

  return storage;
};

// fetch mock where each response is released by hand, in any order
const deferredFetch = () => {
  const pending = {};
  global.fetch = jest.fn((url, options = {}) => new Promise((resolve, reject) => {
    const key = `${options.method || 'GET'} ${url.split('/').slice(-2).join('/')}`;
    pending[key] = { resolve, reject };
  }));

  return pending;
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const fileKey = (file) => `GET rec/${file}`;

describe('storage', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('waits for the last file after the media probe', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    const onLoaded = jest.fn();
    storage.fetch('rec', jest.fn(), onLoaded, jest.fn());

    const names = Object.values(files);
    const last = names.pop();
    names.forEach(file => pending[fileKey(file)].resolve(MISSING));
    pending[MASTER].resolve(VIDEO);
    await flush();

    expect(onLoaded).not.toHaveBeenCalled();

    pending[fileKey(last)].resolve(MISSING);
    await flush();

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it('waits for the media probe after the last file', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    const onLoaded = jest.fn();
    storage.fetch('rec', jest.fn(), onLoaded, jest.fn());

    Object.values(files).forEach(file => pending[fileKey(file)].resolve(MISSING));
    await flush();

    expect(onLoaded).not.toHaveBeenCalled();

    pending[MASTER].resolve(VIDEO);
    await flush();

    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(storage.media).toEqual({ type: 'video/mp4', url: '/playback/video/rec/video-0.mp4' });
  });

  it('probes only the MP4, no WebM', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    storage.fetch('rec', jest.fn(), jest.fn(), jest.fn());

    const probes = Object.keys(pending).filter(key => key.startsWith('HEAD'));

    expect(probes).toEqual([MASTER]);
    expect(Object.keys(pending).some(key => /webm|audio\./.test(key))).toBe(false);
  });

  const failures = [
    ['is not there', MISSING],
    ['answers with a page, not a video', { ok: true, status: 200, headers: { get: () => 'text/html' } }],
  ];
  failures.forEach(([label, response]) => {
    it(`reports the recording as not found when the MP4 ${label}`, async () => {
      const pending = deferredFetch();
      const storage = loadStorage();
      const onError = jest.fn();
      const onLoaded = jest.fn();
      storage.fetch('rec', jest.fn(), onLoaded, onError);

      Object.values(files).forEach(file => pending[fileKey(file)].resolve(MISSING));
      pending[MASTER].resolve(response);
      await flush();

      expect(onError).toHaveBeenCalledWith(ERROR.NOT_FOUND);
      expect(onLoaded).not.toHaveBeenCalled();
    });
  });

  it('reports the recording as not found when the probe fails', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    const onError = jest.fn();
    storage.fetch('rec', jest.fn(), jest.fn(), onError);

    pending[MASTER].reject(new TypeError('Failed to fetch'));
    await flush();

    expect(onError).toHaveBeenCalledWith(ERROR.NOT_FOUND);
  });
});
