import { findMasterSources } from './master';

const FOLDER = '/playback/video/record-1';

// A server with these files: { 'video-0.m4v': 'video/x-m4v', … }. Any other
// path gets `fallback`, the answer to unknown paths
const serve = (files, fallback = { ok: false, type: 'text/html' }) => {
  global.fetch = jest.fn((url) => {
    const name = url.replace(`${FOLDER}/`, '');
    const answer = name in files ? { ok: true, type: files[name] } : fallback;

    return Promise.resolve({ headers: { get: () => answer.type }, ok: answer.ok });
  });
};

describe('findMasterSources', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('finds the studio preset\'s MP4', async () => {
    serve({ 'video-0.mp4': 'video/mp4' });

    expect(await findMasterSources(FOLDER)).toEqual([{ src: `${FOLDER}/video-0.mp4`, type: 'video/mp4' }]);
  });

  it('finds BigBlueButton\'s default .m4v and tells the player it is an MP4', async () => {
    serve({ 'video-0.m4v': 'video/x-m4v' });

    expect(await findMasterSources(FOLDER)).toEqual([{ src: `${FOLDER}/video-0.m4v`, type: 'video/mp4' }]);
  });

  it('takes a file the server gives no video type for', async () => {
    serve({ 'video-0.m4v': 'application/octet-stream' });

    expect(await findMasterSources(FOLDER)).toHaveLength(1);
  });

  it('offers a second format after the first', async () => {
    serve({ 'video-0.m4v': 'video/x-m4v', 'video-1.webm': 'video/webm' });

    expect(await findMasterSources(FOLDER)).toEqual([
      { src: `${FOLDER}/video-0.m4v`, type: 'video/mp4' },
      { src: `${FOLDER}/video-1.webm`, type: 'video/webm' },
    ]);
  });

  it('finds a WebM as the only format', async () => {
    serve({ 'video-0.webm': 'video/webm' });

    expect(await findMasterSources(FOLDER)).toEqual([{ src: `${FOLDER}/video-0.webm`, type: 'video/webm' }]);
  });

  it('has none when the files are missing, without looking for a second format', async () => {
    serve({});

    expect(await findMasterSources(FOLDER)).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('does not take a server\'s fallback page for the video', async () => {
    serve({}, { ok: true, type: 'text/html; charset=utf-8' });

    expect(await findMasterSources(FOLDER)).toEqual([]);
  });

  it('has none when the server cannot be reached', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));

    expect(await findMasterSources(FOLDER)).toEqual([]);
  });
});
