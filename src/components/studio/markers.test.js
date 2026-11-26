import storage from 'utils/data/storage';
import { buildMarkers, buildSegments } from './markers';

jest.mock('utils/data/storage', () => ({
  __esModule: true,
  default: {
    chat: [
      { moderator: true, timestamp: 100 },
      { moderator: false, timestamp: 200 },
    ],
    polls: [],
    slides: [],
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

  describe('with polls.json and slides.json', () => {
    beforeEach(() => {
      storage.polls = [{ timestamp: 600 }];
      storage.slides = [
        { src: 'slides/p/thumb-1.png', timestamp: 0 },
        { src: 'slides/p/thumb-2.png', timestamp: 300 },
        { src: 'screenshare', timestamp: 400 },
        { src: 'slides/p/thumb-2.png', timestamp: 450 },
      ];
    });

    afterEach(() => {
      storage.polls = [];
      storage.slides = [];
    });

    it('marks the polls, each slide that comes up and each screen sharing', () => {
      // The first slide is the start, not a change; the slide after the
      // screen sharing comes up again
      expect(buildMarkers(1000).map(({ time, type }) => [time, type])).toEqual([
        [100, 'chat'],
        [300, 'slide'],
        [400, 'screenshare'],
        [450, 'slide'],
        [600, 'poll'],
      ]);
    });

    it('breaks the rail at the slides and the screen sharing', () => {
      expect(buildSegments(1000)).toEqual([0.3, 0.4, 0.45]);
    });
  });
});
