import { buildMarkers } from './markers';

jest.mock('utils/data/storage', () => ({
  __esModule: true,
  default: {
    chat: [
      { moderator: true, timestamp: 100 },
      { moderator: false, timestamp: 200 },
    ],
    polls: [],
    screenshare: [],
    thumbnails: [],
    videos: [],
  },
}));

describe('buildMarkers', () => {
  it('marks the raised hands and reactions of timeline.json', () => {
    const markers = buildMarkers(1000, [
      { name: 'Ana', time: 500, type: 'hand' },
      { emoji: '👍', name: 'Bia', time: 800, type: 'reaction' },
    ]);

    expect(markers.map(({ time, type }) => [time, type])).toEqual([
      [100, 'chat'],
      [500, 'hand'],
      [800, 'reaction'],
    ]);
  });

  it('works without timeline.json, as before it', () => {
    expect(buildMarkers(1000).map(({ type }) => type)).toEqual(['chat']);
    expect(buildMarkers(1000, null).map(({ type }) => type)).toEqual(['chat']);
  });

  it('leaves out what it does not know or what is outside the recording', () => {
    const markers = buildMarkers(1000, [
      { time: 300, type: 'away' },
      { time: 1200, type: 'hand' },
      { time: -1, type: 'reaction' },
      null,
    ]);

    expect(markers.map(({ type }) => type)).toEqual(['chat']);
  });

  it('merges close moments, the most relevant type giving the icon', () => {
    // 3% of 1000 s: moments within 30 s are one marker
    const [marker] = buildMarkers(1000, [
      { time: 105, type: 'reaction' },
      { time: 110, type: 'hand' },
    ]);

    expect(marker.type).toBe('hand');
    expect(marker.counts).toEqual({ chat: 1, hand: 1, reaction: 1 });
  });

  it('ignores a timeline.json that is not a list', () => {
    expect(buildMarkers(1000, { hand: 5 }).map(({ type }) => type)).toEqual(['chat']);
  });
});
