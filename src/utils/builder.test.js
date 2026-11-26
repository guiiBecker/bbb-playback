import {
  build,
  buildStyle,
  getAttr,
  getId,
  getNumbers,
  mergeMessages,
} from './builder';

it('merges and sorts messages arrays', () => {
  let chat = [
    { timestamp: 5.1, type: 'chat' },
    { timestamp: 11.9, type: 'chat' },
    { timestamp: 10.1, type: 'chat' },
  ];

  let polls = [
    { timestamp: 4.0, type: 'poll' },
    { timestamp: 16.9, type: 'poll' },
    { timestamp: 10.1, type: 'poll' },
  ];

  let videos = [
    { timestamp: 3.0, type: 'video' },
    { timestamp: 19.0, type: 'video' },
    { timestamp: 12.1, type: 'video' },
  ];


  expect(mergeMessages(chat, polls, videos)).toEqual([
    { timestamp: 3.0, type: 'video' },
    { timestamp: 4.0, type: 'poll' },
    { timestamp: 5.1, type: 'chat' },
    { timestamp: 10.1, type: 'chat' },
    { timestamp: 10.1, type: 'poll' },
    { timestamp: 11.9, type: 'chat' },
    { timestamp: 12.1, type: 'video' },
    { timestamp: 16.9, type: 'poll' },
    { timestamp: 19.0, type: 'video' },
  ]);
});

it('builds style object from a string', () => {
  let value = 'first: 1; second: two; visibility: hidden;';
  expect(buildStyle(value)).toEqual({ first: '1', second: 'two' });

  value = 'first: 1;';
  expect(buildStyle(value)).toEqual({ first: '1' });

  value = 'first: 1';
  expect(buildStyle(value)).toEqual({ first: '1' });

  value = '; second: two;';
  expect(buildStyle(value)).toEqual({ second: 'two' });

  value = 'visibility: hidden;';
  expect(buildStyle(value)).toEqual({});
});

it('gets attributes from a parsed xml node', () => {
  const attr = { first: 1, second: 'two' };

  expect(getAttr({ '$': attr })).toEqual(attr);
  expect(getAttr({ '$': attr, '%': null })).toEqual(attr);
  expect(getAttr({ '%': null })).toEqual({});
  expect(getAttr({})).toEqual({});
});

it('gets a numeric id from a string', () => {
  // Regular
  expect(getId('id1')).toEqual(1);
  expect(getId('1')).toEqual(1);
  expect(getId('id10')).toEqual(10);
  expect(getId('10')).toEqual(10);

  // Mixed
  expect(getId('0id1')).toEqual(1);
  expect(getId('00id11')).toEqual(11);

  // Invalid
  expect(getId('1id')).toEqual(-1);
  expect(getId('i1d')).toEqual(-1);
  expect(getId('id')).toEqual(-1);
  expect(getId('')).toEqual(-1);
  expect(getId()).toEqual(-1);
});

it('gets a numeric array from a string', () => {
  // Integer
  expect(getNumbers('1 2 3')).toEqual([1.0, 2.0, 3.0]);
  expect(getNumbers('1')).toEqual([1.0]);
  expect(getNumbers(' 1 ')).toEqual([1.0]);
  expect(getNumbers('1  2  3')).toEqual([1.0, 2.0, 3.0]);

  // Float
  expect(getNumbers('1.1 2.2 3.3')).toEqual([1.1, 2.2, 3.3]);
  expect(getNumbers('1.1')).toEqual([1.1]);
  expect(getNumbers(' 1.1 ')).toEqual([1.1]);
  expect(getNumbers('1.1  2.2  3.3')).toEqual([1.1, 2.2, 3.3]);

  // Invalid
  expect(getNumbers('')).toEqual([]);
  expect(getNumbers(' ')).toEqual([]);
  expect(getNumbers()).toEqual([]);
});

it('reads the video format\'s metadata.xml', async () => {
  const metadata = await build('metadata.xml', `<?xml version="1.0"?>
<recording>
  <id>abc-1795021174516</id>
  <start_time>1795021174516</start_time>
  <end_time>1795023029530</end_time>
  <playback><format>video</format><duration>1522112</duration></playback>
  <meta><meetingName>Room #4</meetingName></meta>
</recording>`);

  expect(metadata).toEqual({
    end: 1795023029530,
    id: 'abc-1795021174516',
    name: 'Room #4',
    participants: 0,
    start: 1795021174516,
  });
});

it('still reads the presentation format\'s metadata.xml', async () => {
  const metadata = await build('metadata.xml', `<?xml version="1.0"?>
<recording>
  <start_time>1</start_time>
  <end_time>2</end_time>
  <participants>3</participants>
  <meeting id="abc-1" name="Room"/>
  <meta></meta>
</recording>`);

  expect(metadata).toEqual({ end: 2, id: 'abc-1', name: 'Room', participants: 3, start: 1 });
});

it('reads slides.json: slides with their picture and title, and screen sharing', async () => {
  const slides = await build('slides.json', [
    { height: 85, image: 'slides/p/thumb-2.png', presentation: 'p', slide: 2, time: 10, title: 'Agenda', type: 'slide', width: 150 },
    { presentation: 'p', slide: 5, time: 11, type: 'slide' },
    { time: 28, type: 'screenshare' },
  ]);

  expect(slides).toEqual([
    { alt: 'Agenda', height: 85, id: 1, image: 'slides/p/thumb-2.png', number: 2, src: 'slides/p/thumb-2.png', timestamp: 10, width: 150 },
    { alt: '', height: undefined, id: 2, image: null, number: 5, src: 'slide-p-5', timestamp: 11, width: undefined },
    { id: 3, src: 'screenshare', timestamp: 28 },
  ]);
});

it('leaves out of slides.json what it does not know', async () => {
  expect(await build('slides.json', null)).toEqual([]);
  expect(await build('slides.json', { time: 1 })).toEqual([]);
  expect(await build('slides.json', [null, { type: 'slide' }, { time: 3, type: 'video' }])).toEqual([]);
});

it('reads polls.json, also when it is not a list or a poll has no answers', async () => {
  expect(await build('polls.json', null)).toEqual([]);
  expect(await build('polls.json', { timestamp: 1 })).toEqual([]);
  expect(await build('polls.json', [{ question: 'Ready?', timestamp: 23 }])).toEqual([
    { answers: [], question: 'Ready?', timestamp: 23 },
  ]);
});
