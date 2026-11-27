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

// fetch mock where each response is released by hand, in any order. The
// presentation format's files (/presentation/…), all optional, are answered
// at once: with what the test has for them (`published`, by file name), else
// as missing
const deferredFetch = (published = {}) => {
  const pending = {};
  global.fetch = jest.fn((url, options = {}) => {
    if (url.startsWith('/presentation/')) {
      const answer = published[url.split('/').pop()] || MISSING;

      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    }

    return new Promise((resolve, reject) => {
      const key = `${options.method || 'GET'} ${url.split('/').slice(-2).join('/')}`;
      pending[key] = { resolve, reject };
    });
  });

  return pending;
};

const text = (value) => ({ ok: true, status: 200, text: () => Promise.resolve(value) });
const json = (value) => ({ ok: true, status: 200, json: () => Promise.resolve(value) });

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

  it('reads the video format\'s files, and no WebM', async () => {
    const pending = deferredFetch();
    const storage = loadStorage();
    storage.fetch('rec', jest.fn(), jest.fn(), jest.fn());

    expect(Object.keys(pending).sort()).toEqual(['GET rec/captions.json', 'GET rec/metadata.xml', 'GET rec/notes.html', 'GET rec/slides.json', 'GET rec/video.xml', M4V, M4V_SECOND, MP4].sort());
    // Everything else is the presentation format's optional data, never a video
    const elsewhere = global.fetch.mock.calls.map(([url]) => url).filter(url => !url.startsWith('/playback/video/rec/'));
    expect(elsewhere.every(url => url.startsWith('/presentation/rec/'))).toBe(true);
    expect(elsewhere.some(url => /\.(webm|mp4|m4v|ogg)$/.test(url))).toBe(false);
  });

  it('reads the notes, the polls and the slides from the presentation format\'s folder', async () => {
    const pending = deferredFetch({
      'notes.html': text('<html>\n<body>\n<p>Agenda</p>\n</body>\n</html>'),
      'polls.json': json([
        { answers: [{ id: 0, key: 'Yes', numVotes: 3 }], question: 'Ready?', timestamp: 23, type: 'YN' },
      ]),
      'presentation_text.json': json({ p: { 'slide-1': 'Welcome\nAgenda' } }),
      'shapes.svg': text(`<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image id="image1" class="slide" in="0.0" out="40.0" xlink:href="presentation/p/slide-1.png" width="1600" height="900"/>
  <image id="image2" class="slide" in="40.0" out="60.0" xlink:href="presentation/deskshare.png" width="1280" height="720"/>
</svg>`),
    });
    const storage = loadStorage();
    const onError = jest.fn();
    const onLoaded = jest.fn();
    storage.fetch('rec', jest.fn(), onLoaded, onError);

    const urls = global.fetch.mock.calls.map(([url]) => url).filter(url => url.startsWith('/presentation/'));
    expect(urls.sort()).toEqual([
      '/presentation/rec/deskshare.xml',
      '/presentation/rec/layout.xml',
      '/presentation/rec/notes.html',
      '/presentation/rec/polls.json',
      '/presentation/rec/presentation_text.json',
      '/presentation/rec/shapes.svg',
    ]);

    Object.values(files).forEach(file => pending[fileKey(file)].resolve(MISSING));
    pending[MP4].resolve(VIDEO);
    pending[M4V].resolve(MISSING);
    pending[M4V_SECOND].resolve(MISSING);
    await flush();

    expect(onError).not.toHaveBeenCalled();
    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(storage.notes).toContain('<p>Agenda</p>');
    expect(storage.polls.map(({ question, timestamp }) => [question, timestamp])).toEqual([['Ready?', 23]]);
    expect(storage.thumbnails.map(({ alt, src, timestamp }) => [src, timestamp, alt])).toEqual([
      ['presentation/p/thumbnails/thumb-1.png', 0, 'Welcome\nAgenda'],
      ['screenshare', 40, ''],
    ]);
  });

  it('takes the notes from the video format\'s folder over the presentation format\'s', async () => {
    const pending = deferredFetch({ 'notes.html': text('<html>\n<body>\n<p>Old</p>\n</body>\n</html>') });
    const storage = loadStorage();
    storage.fetch('rec', jest.fn(), jest.fn(), jest.fn());

    Object.values(files).filter(file => file !== 'notes.html').forEach(file => pending[fileKey(file)].resolve(MISSING));
    pending[fileKey('notes.html')].resolve(text('<html>\n<body>\n<p>From the video folder</p>\n</body>\n</html>'));
    pending[MP4].resolve(VIDEO);
    pending[M4V].resolve(MISSING);
    pending[M4V_SECOND].resolve(MISSING);
    await flush();

    expect(storage.notes).toContain('From the video folder');
    expect(storage.notes).not.toContain('Old');
  });

  it('takes the slides from the video format\'s slides.json over the presentation format\'s shapes.svg', async () => {
    const pending = deferredFetch({
      'shapes.svg': text(`<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image id="image1" class="slide" in="0.0" out="40.0" xlink:href="presentation/old/slide-1.png" width="1600" height="900"/>
</svg>`),
    });
    const storage = loadStorage();
    storage.fetch('rec', jest.fn(), jest.fn(), jest.fn());

    Object.values(files).filter(file => file !== 'slides.json').forEach(file => pending[fileKey(file)].resolve(MISSING));
    pending[fileKey('slides.json')].resolve(json([
      { alt: 'Agenda', src: 'presentation/p/thumbnails/thumb-2.png', timestamp: 0 },
      { src: 'screenshare', timestamp: 30 },
    ]));
    pending[MP4].resolve(VIDEO);
    pending[M4V].resolve(MISSING);
    pending[M4V_SECOND].resolve(MISSING);
    await flush();

    expect(storage.thumbnails.map(({ folder, src, timestamp }) => [folder, src, timestamp])).toEqual([
      ['video', 'presentation/p/thumbnails/thumb-2.png', 0],
      ['video', 'screenshare', 30],
    ]);
  });

  it('plays a recording without the presentation format, with no notes, polls or slides', async () => {
    const pending = deferredFetch({
      // Not there, not reachable, or a server's page for an unknown path
      'notes.html': MISSING,
      'polls.json': { ok: true, status: 200, json: () => Promise.reject(new SyntaxError('Unexpected token <')) },
      'shapes.svg': new TypeError('Failed to fetch'),
      'deskshare.xml': text('<html><body>Not found</body></html>'),
    });
    const storage = loadStorage();
    const onError = jest.fn();
    const onLoaded = jest.fn();
    storage.fetch('rec', jest.fn(), onLoaded, onError);

    Object.values(files).forEach(file => pending[fileKey(file)].resolve(MISSING));
    pending[MP4].resolve(VIDEO);
    pending[M4V].resolve(MISSING);
    pending[M4V_SECOND].resolve(MISSING);
    await flush();

    expect(onError).not.toHaveBeenCalled();
    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(storage.notes).toBe('');
    expect(storage.polls).toEqual([]);
    expect(storage.thumbnails).toEqual([]);
    expect(storage.slides).toEqual([]);
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
