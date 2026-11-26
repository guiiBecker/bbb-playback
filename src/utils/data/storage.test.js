import { files } from 'config';
import { ERROR } from 'utils/constants';

const MISSING = { ok: false, status: 404, headers: { get: () => null } };
const VIDEO = { ok: true, status: 200, headers: { get: () => 'video/mp4' } };
// The recording's video, the "video" format's, as the fetch mock keys it
const MP4 = 'HEAD rec/video-0.mp4';
const M4V = 'HEAD rec/video-0.m4v';
// The M4V when the preset makes [mp4, m4v]
const M4V_SECOND = 'HEAD rec/video-1.m4v';

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
    pending[MP4].resolve(VIDEO);
    pending[M4V].resolve(MISSING);
    pending[M4V_SECOND].resolve(MISSING);
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

    pending[MP4].resolve(VIDEO);
    pending[M4V].resolve(MISSING);
    pending[M4V_SECOND].resolve(MISSING);
    await flush();

    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(storage.media).toEqual({ type: 'video/mp4', url: '/playback/video/rec/video-0.mp4' });
  });

  it('reads only the video format\'s files: no presentation format, no WebM', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    storage.fetch('rec', jest.fn(), jest.fn(), jest.fn());

    expect(Object.keys(pending).sort()).toEqual([
      'GET rec/captions.json',
      'GET rec/metadata.xml',
      'GET rec/notes.html',
      'GET rec/video.xml',
      M4V,
      M4V_SECOND,
      MP4,
    ].sort());
    expect(global.fetch.mock.calls.every(([url]) => url.startsWith('/playback/video/rec/'))).toBe(true);
  });

  it('plays the MP4 when there is no M4V', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    const onLoaded = jest.fn();
    storage.fetch('rec', jest.fn(), onLoaded, jest.fn());

    Object.values(files).forEach(file => pending[fileKey(file)].resolve(MISSING));
    pending[MP4].resolve(VIDEO);
    pending[M4V].resolve(MISSING);
    pending[M4V_SECOND].resolve(MISSING);
    await flush();

    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(storage.media.url).toBe('/playback/video/rec/video-0.mp4');
  });

  it('prefers the M4V when there are both (video-1.m4v, the preset\'s second format)', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    storage.fetch('rec', jest.fn(), jest.fn(), jest.fn());

    Object.values(files).forEach(file => pending[fileKey(file)].resolve(MISSING));
    pending[MP4].resolve(VIDEO);
    pending[M4V].resolve(MISSING);
    pending[M4V_SECOND].resolve({ ok: true, status: 200, headers: { get: () => 'video/x-m4v' } });
    await flush();

    expect(storage.media).toEqual({ type: 'video/mp4', url: '/playback/video/rec/video-1.m4v' });
  });

  it('prefers video-0.m4v over video-1.m4v', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    storage.fetch('rec', jest.fn(), jest.fn(), jest.fn());

    Object.values(files).forEach(file => pending[fileKey(file)].resolve(MISSING));
    const m4v = { ok: true, status: 200, headers: { get: () => 'video/x-m4v' } };
    pending[MP4].resolve(VIDEO);
    pending[M4V].resolve(m4v);
    pending[M4V_SECOND].resolve(m4v);
    await flush();

    expect(storage.media.url).toBe('/playback/video/rec/video-0.m4v');
  });

  const failures = [
    ['are not there', MISSING],
    ['answer with a page, not a video', { ok: true, status: 200, headers: { get: () => 'text/html' } }],
  ];
  failures.forEach(([label, response]) => {
    it(`reports the recording as not found when the MP4 and M4V ${label}`, async () => {
      const pending = deferredFetch();
      const storage = loadStorage();
      const onError = jest.fn();
      const onLoaded = jest.fn();
      storage.fetch('rec', jest.fn(), onLoaded, onError);

      Object.values(files).forEach(file => pending[fileKey(file)].resolve(MISSING));
      pending[MP4].resolve(response);
      pending[M4V].resolve(response);
      pending[M4V_SECOND].resolve(response);
      await flush();

      expect(onError).toHaveBeenCalledWith(ERROR.NOT_FOUND);
      expect(onLoaded).not.toHaveBeenCalled();
    });
  });

  it('reports the recording as not found when the probes fail', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    const onError = jest.fn();
    storage.fetch('rec', jest.fn(), jest.fn(), onError);

    pending[MP4].reject(new TypeError('Failed to fetch'));
    pending[M4V].reject(new TypeError('Failed to fetch'));
    pending[M4V_SECOND].reject(new TypeError('Failed to fetch'));
    await flush();

    expect(onError).toHaveBeenCalledWith(ERROR.NOT_FOUND);
  });

  it('has empty presentation data, not errors', () => {
    const storage = loadStorage();

    expect(storage.slides).toEqual([]);
    expect(storage.thumbnails).toEqual([]);
  });
});
