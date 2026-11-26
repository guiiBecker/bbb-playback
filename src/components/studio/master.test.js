import { fitFrame } from './master';

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
