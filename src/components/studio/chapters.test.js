import { buildChapters } from './chapters';

const slide = (timestamp, number, alt = '') => ({
  alt,
  height: 900,
  src: `presentation/p/thumbnails/thumb-${number}.png`,
  timestamp,
  width: 1600,
});

describe('buildChapters', () => {
  it('makes a chapter of each slide shown and each screen sharing', () => {
    const chapters = buildChapters([
      slide(0, 1, 'Welcome'),
      slide(40, 2),
      { src: 'screenshare', timestamp: 70 },
      slide(95, 3),
    ], 120);

    expect(chapters.map(({ end, start }) => [start, end])).toEqual([[0, 40], [40, 70], [70, 95], [95, 120]]);
    expect(chapters[0].text).toBe('Welcome');
    expect(chapters[2].src).toBe('screenshare');
  });

  it('gives the paging through slides to the slide it leads to', () => {
    const chapters = buildChapters([
      slide(0, 1),
      slide(40, 2),
      slide(41, 5),
      slide(43, 2),
      slide(60, 3),
    ], 90);

    expect(chapters.map(({ end, src, start }) => [start, end, src.slice(-11)])).toEqual([
      [0, 40, 'thumb-1.png'],
      [40, 60, 'thumb-2.png'],
      [60, 90, 'thumb-3.png'],
    ]);
  });

  it('keeps the first slide when every slide is short', () => {
    expect(buildChapters([slide(0, 1), slide(2, 2)], 3)).toHaveLength(1);
  });

  it('has no chapters without slides', () => {
    expect(buildChapters([], 60)).toEqual([]);
  });
});
