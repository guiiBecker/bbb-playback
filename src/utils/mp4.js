// Chapters and subtitles for the recording's video file, put into the file
// in the browser, for the download: players such as VLC then list the
// chapters and offer the subtitles as tracks to switch on and off.
//
// The video and the sound are not touched and not read: an MP4 keeps its
// index in one box, `moov`, and only that box is rewritten.
//
//   chapters   a chapter list (`moov/udta/chpl`)
//   subtitles  a text track each (3GPP timed text, `tx3g`), with the texts
//              appended to the end of the file
//
// The new file is the old one with a larger `moov`:
//   [what was before moov] [new moov] [what was after moov] [subtitle texts]
// What comes after `moov` moves back by the difference, so the places the
// index points to (the chunk offsets) are moved with it.

const encode = (text) => new TextEncoder().encode(text);

const u16 = (value) => [(value >>> 8) & 0xff, value & 0xff];
const u32 = (value) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
// Up to 2^53, what a file's offsets and a recording's times stay below
const u64 = (value) => [...u32(Math.floor(value / 0x100000000)), ...u32(value % 0x100000000)];

const concat = (parts) => {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    bytes.set(part, offset);
    offset += part.length;
  });

  return bytes;
};

const ascii = (text) => Array.from(text, (char) => char.charCodeAt(0));

// A box: its size, its four letter type, its content
const box = (type, ...content) => {
  const body = concat(content.map((part) => (part instanceof Uint8Array ? part : Uint8Array.from(part))));

  return concat([Uint8Array.from([...u32(body.length + 8), ...ascii(type)]), body]);
};

// A box that starts with a version and flags
const fullBox = (type, version, flags, ...content) => box(type, [version, ...u32(flags).slice(1)], ...content);

const readU32 = (bytes, offset) => (
  bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]
);
const readU64 = (bytes, offset) => readU32(bytes, offset) * 0x100000000 + readU32(bytes, offset + 4);
const readType = (bytes, offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));

// The boxes between `start` and `end`: [{ type, start, end, content }], with
// `content` where the box's own content begins
const readBoxes = (bytes, start = 0, end = bytes.length) => {
  const boxes = [];
  let offset = start;

  while (offset + 8 <= end) {
    let size = readU32(bytes, offset);
    let header = 8;
    if (size === 1) {
      size = readU64(bytes, offset + 8);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) break;

    boxes.push({
      content: offset + header, end: offset + size, start: offset, type: readType(bytes, offset + 4),
    });
    offset += size;
  }

  return boxes;
};

const find = (bytes, parent, type) => readBoxes(bytes, parent.content, parent.end).filter((child) => child.type === type);

// ISO 639-1 -> 639-2/T, what an MP4 names a track's language with
const LANGUAGES = {
  ar: 'ara', bg: 'bul', ca: 'cat', cs: 'ces', da: 'dan', de: 'deu', el: 'ell', en: 'eng', es: 'spa',
  et: 'est', eu: 'eus', fa: 'fas', fi: 'fin', fr: 'fra', gl: 'glg', he: 'heb', hi: 'hin', hr: 'hrv',
  hu: 'hun', id: 'ind', it: 'ita', ja: 'jpn', ko: 'kor', lt: 'lit', lv: 'lav', nb: 'nob', nl: 'nld',
  no: 'nor', pl: 'pol', pt: 'por', ro: 'ron', ru: 'rus', sk: 'slk', sl: 'slv', sr: 'srp', sv: 'swe',
  th: 'tha', tr: 'tur', uk: 'ukr', vi: 'vie', zh: 'zho',
};

// "pt-BR" -> the three letters packed in 15 bits; "und" when not known
const packLanguage = (locale) => {
  const code = LANGUAGES[String(locale || '').toLowerCase().split(/[-_]/)[0]] || 'und';

  return ascii(code).reduce((packed, char) => (packed << 5) | (char - 0x60), 0);
};

// As many whole characters of `text` as fit in `limit` bytes
const utf8 = (text, limit) => {
  let bytes = encode(text);
  let cut = text;
  while (bytes.length > limit) {
    cut = Array.from(cut).slice(0, -1).join('');
    bytes = encode(cut);
  }

  return bytes;
};

// The chapter list as Nero wrote it first, read by VLC, mpv and ffmpeg: up
// to 255 chapters, each a start in 100 ns and a title of up to 255 bytes
const chapterList = (chapters) => {
  const list = chapters.slice(0, 255);

  return fullBox('chpl', 1, 0, u32(0), [list.length], ...list.map(({ start, title }) => {
    const name = utf8(title, 255);

    return concat([Uint8Array.from([...u64(Math.max(0, Math.round(start * 10000000))), name.length]), name]);
  }));
};

// How a 3GPP timed text track describes its samples: plain white text at the
// bottom, as ffmpeg writes it
const TEXT_SAMPLE_ENTRY = box(
  'tx3g',
  [0, 0, 0, 0, 0, 0], u16(1), // reserved, data reference index
  u32(0), [1, 0xff], [0, 0, 0, 0xff], // display flags, justification, background
  u16(0), u16(0), u16(0), u16(0), // text box
  u16(0), u16(0), u16(1), [0, 16], [0xff, 0xff, 0xff, 0xff], // style: font 1, size, colour
  box('ftab', u16(1), u16(1), [5], ascii('Arial')),
);

const MEDIA_TIMESCALE = 1000;

// The cues as the track's samples: a text each, and an empty one for the time
// between two cues, so nothing stays on screen. Times in milliseconds
const textSamples = (cues) => {
  const samples = [];
  let cursor = 0;

  [...cues].sort((a, b) => a.start - b.start).forEach((cue) => {
    const start = Math.max(cursor, Math.round(cue.start * MEDIA_TIMESCALE));
    const end = Math.round(cue.end * MEDIA_TIMESCALE);
    if (!(end > start) || !cue.text) return;

    if (start > cursor) samples.push({ data: Uint8Array.from(u16(0)), duration: start - cursor });
    const text = utf8(cue.text, 0xffff);
    samples.push({ data: concat([Uint8Array.from(u16(text.length)), text]), duration: end - start });
    cursor = end;
  });

  return samples;
};

// One subtitle track. `offset` is where its samples are in the file, all in
// one chunk. Not enabled: players offer it, none shows it unasked
const subtitleTrack = ({
  id, locale, movieTimescale, name, offset, samples,
}) => {
  const duration = samples.reduce((total, sample) => total + sample.duration, 0);
  const identity = [...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];

  return box(
    'trak',
    fullBox(
      'tkhd', 0, 0x000002, // in the movie, not enabled
      u32(0), u32(0), u32(id), u32(0), u32(Math.round((duration * movieTimescale) / MEDIA_TIMESCALE)),
      u32(0), u32(0), u16(0), u16(3), u16(0), u16(0), // layer, alternate group (the subtitles), volume
      identity, u32(0), u32(0), // matrix, width, height
    ),
    box(
      'mdia',
      fullBox('mdhd', 0, 0, u32(0), u32(0), u32(MEDIA_TIMESCALE), u32(duration), u16(packLanguage(locale)), u16(0)),
      fullBox('hdlr', 0, 0, u32(0), ascii('sbtl'), u32(0), u32(0), u32(0), ascii('SubtitleHandler'), [0]),
      box(
        'minf',
        fullBox('nmhd', 0, 0),
        box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))),
        box(
          'stbl',
          fullBox('stsd', 0, 0, u32(1), TEXT_SAMPLE_ENTRY),
          fullBox('stts', 0, 0, u32(samples.length), ...samples.map((sample) => [...u32(1), ...u32(sample.duration)])),
          fullBox('stsc', 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
          fullBox('stsz', 0, 0, u32(0), u32(samples.length), ...samples.map((sample) => u32(sample.data.length))),
          fullBox('co64', 0, 0, u32(1), u64(offset)),
        ),
      ),
    ),
    // The track's name, what players list it by next to the language
    ...(name ? [box('udta', box('name', utf8(name, 255)))] : []),
  );
};

// Moves the chunk offsets of a track that point at or after `from` by
// `delta`, in place
const shiftChunkOffsets = (moov, track, from, delta) => {
  find(moov, track, 'mdia').forEach((mdia) => find(moov, mdia, 'minf').forEach((minf) => {
    find(moov, minf, 'stbl').forEach((stbl) => readBoxes(moov, stbl.content, stbl.end).forEach((table) => {
      if (table.type !== 'stco' && table.type !== 'co64') return;

      const wide = table.type === 'co64';
      const count = readU32(moov, table.content + 4);
      for (let index = 0; index < count; index += 1) {
        const at = table.content + 8 + index * (wide ? 8 : 4);
        const offset = wide ? readU64(moov, at) : readU32(moov, at);
        if (offset >= from) {
          const moved = offset + delta;
          // A 32 bit table cannot say it: the file stays as it is
          if (!wide && moved > 0xffffffff) throw new Error('chunk offset too large');
          moov.set(wide ? u64(moved) : u32(moved), at);
        }
      }
    }));
  }));
};

// The new `moov` and the bytes to append to the file.
//   moov        the file's moov box, as bytes
//   moovOffset  where it starts in the file
//   fileSize    the file's size
//   chapters    [{ start (seconds), title }]
//   subtitles   [{ locale, name, cues: [{ start, end (seconds), text }] }]
// -> { moov, data }, or null when there is nothing to add or the file is not
// one this can be done to
const embed = ({
  chapters = [], fileSize, moov, moovOffset, subtitles = [],
}) => {
  const [root] = readBoxes(moov);
  if (!root || root.type !== 'moov' || root.end !== moov.length) return null;

  const children = readBoxes(moov, root.content, root.end);
  const header = children.find((child) => child.type === 'mvhd');
  if (!header) return null;

  const tracks = subtitles
    .map((subtitle) => ({ ...subtitle, samples: textSamples(subtitle.cues || []) }))
    .filter((subtitle) => subtitle.samples.length);
  const list = chapters.filter((chapter) => chapter && Number.isFinite(chapter.start) && chapter.title);
  if (!tracks.length && !list.length) return null;

  // mvhd: version 1 has 64 bit times, so its timescale comes later
  const version = moov[header.content];
  const movieTimescale = readU32(moov, header.content + (version === 1 ? 20 : 12));
  const trackIds = children
    .filter((child) => child.type === 'trak')
    .flatMap((trak) => find(moov, trak, 'tkhd'))
    .map((tkhd) => readU32(moov, tkhd.content + (moov[tkhd.content] === 1 ? 20 : 12)));
  const firstId = Math.max(0, ...trackIds, readU32(moov, header.end - 4) - 1) + 1;

  // The same chapter list or none in the file's own user data
  const userData = children.find((child) => child.type === 'udta');
  const kept = userData
    ? readBoxes(moov, userData.content, userData.end).filter((child) => child.type !== 'chpl')
    : [];
  const newUserData = (kept.length || list.length) ? box(
    'udta',
    ...kept.map((child) => moov.subarray(child.start, child.end)),
    ...(list.length ? [chapterList(list)] : []),
  ) : null;

  // The new moov from `source`, the old one's bytes, with the subtitles'
  // samples at `dataOffset` in the file
  const lastTrack = children.filter((child) => child.type === 'trak').pop();
  const assemble = (source, dataOffset) => {
    let offset = dataOffset;
    const added = tracks.map((track, index) => {
      const bytes = subtitleTrack({ ...track, id: firstId + index, movieTimescale, offset });
      offset += track.samples.reduce((total, sample) => total + sample.data.length, 0);

      return bytes;
    });

    const parts = [];
    children.filter((child) => child.type !== 'udta').forEach((child) => {
      parts.push(source.subarray(child.start, child.end));
      // The new tracks follow the file's own
      if (child === lastTrack) parts.push(...added);
    });
    if (!lastTrack) parts.push(...added);
    if (newUserData) parts.push(newUserData);

    return box('moov', ...parts);
  };

  // How much larger moov gets does not depend on where the samples are
  const delta = assemble(moov, 0).length - moov.length;

  // What is after moov in the file moves back by `delta`; what is before it
  // (a file with its index at the end) stays where it is
  const patched = moov.slice();
  patched.set(u32(firstId + tracks.length), header.end - 4); // the next track id
  children
    .filter((child) => child.type === 'trak')
    .forEach((trak) => shiftChunkOffsets(patched, trak, moovOffset + moov.length, delta));

  return {
    data: concat(tracks.flatMap((track) => track.samples.map((sample) => sample.data))),
    moov: assemble(patched, fileSize + delta),
  };
};

// Where the top level boxes of the file are: [{ type, start, end }]. `read`
// gives the bytes from `start` to `end`: (start, end) => Promise<Uint8Array>
const readTopLevel = async (read, fileSize) => {
  const boxes = [];
  let offset = 0;

  while (offset + 8 <= fileSize) {
    // eslint-disable-next-line no-await-in-loop
    const head = await read(offset, Math.min(fileSize, offset + 16));
    let size = readU32(head, 0);
    if (size === 1 && head.length >= 16) size = readU64(head, 8);
    else if (size === 0) size = fileSize - offset;
    if (size < 8 || offset + size > fileSize) return null;

    boxes.push({ end: offset + size, start: offset, type: readType(head, 4) });
    offset += size;
  }

  return offset === fileSize ? boxes : null;
};

// The video file with the chapters and subtitles in it, as the parts of a new
// Blob: slices of the file and the new bytes. Null when there is nothing to
// add or the file is not a plain MP4 (one moov, not fragmented)
const embedInFile = async (file, { chapters, subtitles }) => {
  const read = async (start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());
  const boxes = await readTopLevel(read, file.size);
  if (!boxes || boxes.some((item) => item.type === 'moof')) return null;

  const found = boxes.filter((item) => item.type === 'moov');
  if (found.length !== 1) return null;

  const [place] = found;
  const result = embed({
    chapters, fileSize: file.size, moov: await read(place.start, place.end), moovOffset: place.start, subtitles,
  });
  if (!result) return null;

  return [file.slice(0, place.start), result.moov, file.slice(place.end), result.data];
};

export {
  embed,
  embedInFile,
  readBoxes,
};
