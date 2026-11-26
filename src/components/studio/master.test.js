import { captionsPlace, fitFrame, masterAreas } from './master';

// The studio-1080 master: 1920x1080, the presentation inside its border at
// x 20, y 155, 1400x770 (layout.json "content")
const CONTENT = {
  height: 770, width: 1400, x: 20, y: 155,
};

describe('fitFrame', () => {
  it('fits the whole video, centred, when the box is wider', () => {
    const frame = fitFrame(1000, 450, 1920, 1080);

    expect(frame.scale).toBeCloseTo(450 / 1080);
    expect(frame.width).toBeCloseTo(800);
    expect(frame.height).toBeCloseTo(450);
    expect(frame.left).toBeCloseTo(100);
    expect(frame.top).toBeCloseTo(0);
  });

  it('fits the whole video, centred, when the box is taller', () => {
    const frame = fitFrame(960, 1000, 1920, 1080);

    expect(frame.width).toBeCloseTo(960);
    expect(frame.height).toBeCloseTo(540);
    expect(frame.left).toBeCloseTo(0);
    expect(frame.top).toBeCloseTo(230);
  });

  it('shows only the cropped part, as large as fits and centred', () => {
    // The numbers measured on the stage of a 1400x780 window
    const frame = fitFrame(978, 624, 1920, 1080, CONTENT);
    const scale = 978 / 1400;

    expect(frame.scale).toBeCloseTo(scale);
    expect(frame.width).toBeCloseTo(1920 * scale);
    expect(frame.left).toBeCloseTo(-20 * scale);
    expect(frame.top).toBeCloseTo((624 - 770 * scale) / 2 - 155 * scale);
    // The crop's corners land on the box: its left edge at 0, its right at 978
    expect(frame.left + CONTENT.x * frame.scale).toBeCloseTo(0);
    expect(frame.left + (CONTENT.x + CONTENT.width) * frame.scale).toBeCloseTo(978);
  });

  it('keeps the crop inside the box when the box is narrow', () => {
    const frame = fitFrame(300, 600, 1920, 1080, CONTENT);
    const top = frame.top + CONTENT.y * frame.scale;
    const bottom = frame.top + (CONTENT.y + CONTENT.height) * frame.scale;

    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(600);
    expect(bottom - top).toBeCloseTo((300 / 1400) * 770);
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

describe('captionsPlace', () => {
  const layout = { content: CONTENT, height: 1080, width: 1920 };

  it('is the bottom of the presentation in the video, in the stage\'s pixels', () => {
    // The video at half its size
    const place = captionsPlace(fitFrame(960, 540, 1920, 1080), layout);

    // Below the presentation the video has 1080 - 155 - 770 = 155 px
    expect(place.bottom).toBeCloseTo(77.5);
    expect(place.center).toBeCloseTo((20 + 700) / 2);
    expect(place.width).toBeCloseTo(700);
  });

  it('follows the presentation when only it is shown (webcams hidden)', () => {
    const frame = fitFrame(1400, 770, 1920, 1080, CONTENT);
    const place = captionsPlace(frame, layout);

    // The presentation fills the box: its bottom is the box's, its middle too
    expect(frame.top + frame.height - place.bottom).toBeCloseTo(770);
    expect(frame.left + place.center).toBeCloseTo(700);
    expect(place.width).toBeCloseTo(1400);
  });

  it('is not known without layout.json, or before the video is placed', () => {
    expect(captionsPlace(fitFrame(960, 540, 1280, 720), null)).toBeNull();
    expect(captionsPlace(fitFrame(960, 540, 1280, 720), { height: 720, width: 1280 })).toBeNull();
    expect(captionsPlace(null, layout)).toBeNull();
  });
});
