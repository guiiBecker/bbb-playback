import { TextDecoder, TextEncoder } from 'util';
import { embed, readBoxes } from './mp4';

// jsdom has neither
global.TextEncoder = TextEncoder;

const u32 = (value) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
const ascii = (text) => Array.from(text, (char) => char.charCodeAt(0));
const box = (type, ...content) => {
  const body = content.flatMap((part) => Array.from(part));

  return Uint8Array.from([...u32(body.length + 8), ...ascii(type), ...body]);
};

// A file's index with one track of two chunks, at 40 (before moov, as in a
// file with its index at the end) and at 5000 (after it)
const MOOV_OFFSET = 100;
const FILE_SIZE = 9000;
const movie = ({ offsets = [40, 5000], userData = null } = {}) => box(
  'moov',
  // mvhd, version 0: times, timescale 600, duration, 76 bytes of the rest, next track id 2
  box('mvhd', u32(0), u32(0), u32(0), u32(600), u32(72000), new Uint8Array(76), u32(2)),
  box(
    'trak',
    box('tkhd', u32(0), u32(0), u32(0), u32(1), new Uint8Array(68)),
    box('mdia', box('minf', box('stbl', box('stco', u32(0), u32(offsets.length), ...offsets.map(u32))))),
  ),
  ...(userData ? [userData] : []),
);

const child = (bytes, parent, type) => readBoxes(bytes, parent.content, parent.end).filter((item) => item.type === type);
const read32 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset);
const text = (bytes) => new TextDecoder().decode(bytes);

const run = (options, moov = movie()) => embed({
  fileSize: FILE_SIZE, moov, moovOffset: MOOV_OFFSET, ...options,
});

describe('embed', () => {
  it('adds nothing when there is nothing to add, or the bytes are no moov', () => {
    expect(run({})).toBeNull();
    expect(run({ chapters: [], subtitles: [{ cues: [], locale: 'en' }] })).toBeNull();
    expect(embed({
      chapters: [{ start: 0, title: 'One' }], fileSize: 10, moov: box('free'), moovOffset: 0,
    })).toBeNull();
  });

  it('writes the chapters as a chapter list in the user data', () => {
    const { data, moov } = run({ chapters: [{ start: 0, title: 'Welcome' }, { start: 40.5, title: 'Fragen? ä €' }] });
    const [root] = readBoxes(moov);
    const [userData] = child(moov, root, 'udta');
    const [list] = child(moov, userData, 'chpl');
    const bytes = moov.subarray(list.content, list.end);

    // Version 1, flags, reserved, two chapters
    expect(Array.from(bytes.subarray(0, 9))).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 2]);
    // The first: at 0, a title of 7 bytes
    expect(Array.from(bytes.subarray(9, 18))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 7]);
    expect(text(bytes.subarray(18, 25))).toBe('Welcome');
    // The second: at 40.5 s in 100 ns, its title in UTF-8
    expect(read32(bytes, 25) * 2 ** 32 + read32(bytes, 29)).toBe(405000000);
    expect(text(bytes.subarray(34, 34 + bytes[33]))).toBe('Fragen? ä €');
    expect(data).toHaveLength(0);
  });

  it('keeps the file\'s own user data and replaces a chapter list it had', () => {
    const userData = box('udta', box('meta', ascii('kept')), box('chpl', ascii('old')));
    const { moov } = run({ chapters: [{ start: 0, title: 'New' }] }, movie({ userData }));
    const [root] = readBoxes(moov);
    const [result] = child(moov, root, 'udta');

    expect(readBoxes(moov, result.content, result.end).map((item) => item.type)).toEqual(['meta', 'chpl']);
    expect(text(moov.subarray(result.content, result.end))).toContain('kept');
    expect(text(moov.subarray(result.content, result.end))).not.toContain('old');
  });

  it('cuts a title that is too long at a whole character', () => {
    const { moov } = run({ chapters: [{ start: 0, title: 'ä'.repeat(200) }] });
    const [root] = readBoxes(moov);
    const [list] = child(moov, child(moov, root, 'udta')[0], 'chpl');

    // 127 times 2 bytes: 254, not half an ä
    expect(moov[list.content + 17]).toBe(254);
  });

  it('adds a subtitle track per language, with its texts appended to the file', () => {
    const before = movie();
    const { data, moov } = run({
      subtitles: [
        { cues: [{ end: 3, start: 1, text: 'Hi' }, { end: 6, start: 5, text: 'Bye' }], locale: 'en', name: 'English' },
        { cues: [{ end: 3, start: 1, text: 'Hallo' }], locale: 'de-DE', name: 'Deutsch' },
      ],
    }, before);
    const [root] = readBoxes(moov);
    const tracks = child(moov, root, 'trak');
    expect(tracks).toHaveLength(3);

    const [, english, german] = tracks;
    const [header] = child(moov, english, 'tkhd');
    // Not enabled (in the movie only), the next free track id
    expect(Array.from(moov.subarray(header.content, header.content + 4))).toEqual([0, 0, 0, 2]);
    expect(read32(moov, header.content + 12)).toBe(2);
    expect(read32(moov, child(moov, german, 'tkhd')[0].content + 12)).toBe(3);
    // The next track id of the movie
    const [movieHeader] = child(moov, root, 'mvhd');
    expect(read32(moov, movieHeader.end - 4)).toBe(4);

    const media = (track) => child(moov, track, 'mdia')[0];
    const table = (track, type) => child(moov, child(moov, child(moov, media(track), 'minf')[0], 'stbl')[0], type)[0];
    // A subtitle track, in its language
    expect(text(moov.subarray(child(moov, media(english), 'hdlr')[0].content + 8, child(moov, media(english), 'hdlr')[0].content + 12))).toBe('sbtl');
    const language = (track) => {
      const packed = (moov[child(moov, media(track), 'mdhd')[0].content + 20] << 8) | moov[child(moov, media(track), 'mdhd')[0].content + 21];

      return [10, 5, 0].map((shift) => String.fromCharCode(((packed >> shift) & 0x1f) + 0x60)).join('');
    };
    expect(language(english)).toBe('eng');
    expect(language(german)).toBe('deu');
    expect(text(moov.subarray(child(moov, english, 'udta')[0].content, child(moov, english, 'udta')[0].end))).toContain('English');

    // English: nothing for the first second, "Hi" for 2 s, nothing for 2 s, "Bye" for 1 s
    const times = table(english, 'stts');
    expect(read32(moov, times.content + 4)).toBe(4);
    expect([0, 1, 2, 3].map((index) => read32(moov, times.content + 12 + index * 8))).toEqual([1000, 2000, 2000, 1000]);
    const sizes = table(english, 'stsz');
    expect([0, 1, 2, 3].map((index) => read32(moov, sizes.content + 12 + index * 4))).toEqual([2, 4, 2, 5]);

    // The texts, each after its length: English first, then German
    expect(Array.from(data)).toEqual([
      0, 0, 0, 2, ...ascii('Hi'), 0, 0, 0, 3, ...ascii('Bye'),
      0, 0, 0, 5, ...ascii('Hallo'),
    ]);

    // They are at the end of the new file: the old size and what moov grew by
    const delta = moov.length - before.length;
    const offset = (track) => read32(moov, table(track, 'co64').content + 8) * 2 ** 32 + read32(moov, table(track, 'co64').content + 12);
    expect(offset(english)).toBe(FILE_SIZE + delta);
    expect(offset(german)).toBe(FILE_SIZE + delta + 13);
  });

  it('moves what the index points to after moov, and leaves what is before it', () => {
    const before = movie();
    const { moov } = run({ chapters: [{ start: 0, title: 'One' }] }, before);
    const delta = moov.length - before.length;
    const [root] = readBoxes(moov);
    const [track] = child(moov, root, 'trak');
    const [offsets] = child(moov, child(moov, child(moov, child(moov, track, 'mdia')[0], 'minf')[0], 'stbl')[0], 'stco');

    expect(delta).toBeGreaterThan(0);
    expect(read32(moov, offsets.content + 8)).toBe(40);
    expect(read32(moov, offsets.content + 12)).toBe(5000 + delta);
    // The input is not changed
    expect(Array.from(before)).toEqual(Array.from(movie()));
  });

  it('gives up on a file whose 32 bit offsets cannot take the move', () => {
    expect(() => run({ chapters: [{ start: 0, title: 'One' }] }, movie({ offsets: [0xfffffff0] }))).toThrow();
  });
});
