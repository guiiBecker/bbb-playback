import { findMasterSources, masterAreas } from './master';

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

describe('masterAreas', () => {
  const layout = {
    content: {
      height: 828, width: 1472, x: 40, y: 126,
    },
    height: 1080,
    tiles: [
      {
        end: 120, height: 246, start: 0, width: 328, x: 1552, y: 155,
      },
      {
        end: 100, height: 246, start: 30, width: 328, x: 1552, y: 417,
      },
    ],
    width: 1920,
  };

  it('has the presentation and the webcam tiles on screen', () => {
    expect(masterAreas(layout, 10, false).map(({ x, y }) => [x, y])).toEqual([[40, 126], [1552, 155]]);
    expect(masterAreas(layout, 50, false)).toHaveLength(3);
    expect(masterAreas(layout, 100, false)).toHaveLength(2);
  });

  it('has only the presentation when the webcams are hidden', () => {
    expect(masterAreas(layout, 50, true).map(({ x, y }) => [x, y])).toEqual([[40, 126]]);
  });

  it('rounds by the size in the video, small tiles less', () => {
    const [content, tile] = masterAreas(layout, 10, false);

    expect(content.radius).toBeCloseTo(17.664);
    expect(tile.radius).toBe(16);
    expect(masterAreas({ ...layout, tiles: [{ ...layout.tiles[0], width: 200 }] }, 10, false)[1].radius).toBe(10);
  });

  it('has none without a layout or its size', () => {
    expect(masterAreas(null, 10, false)).toEqual([]);
    expect(masterAreas({ content: layout.content, tiles: [] }, 10, false)).toEqual([]);
  });
});
