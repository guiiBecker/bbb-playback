import { buildParagraphs, parseVtt } from './transcript';

const VTT = `WEBVTT

00:00:01.000 --> 00:00:02.000
<v Ana Lima>Bom dia a todos.

00:00:02.500 --> 00:00:04.000
<v Ana Lima>Vamos começar

00:00:04.100 --> 00:00:05.000
<v Bruno>pela pauta de hoje.

00:00:06.000 --> 00:00:07.000
sem voz &amp; sem nome
`;

describe('parseVtt', () => {
  it('reads who speaks from the voice span and keeps it out of the text', () => {
    expect(parseVtt(VTT)).toEqual([
      { end: 2, speaker: 'Ana Lima', start: 1, text: 'Bom dia a todos.' },
      { end: 4, speaker: 'Ana Lima', start: 2.5, text: 'Vamos começar' },
      { end: 5, speaker: 'Bruno', start: 4.1, text: 'pela pauta de hoje.' },
      { end: 7, speaker: null, start: 6, text: 'sem voz & sem nome' },
    ]);
  });

  it('drops a closing voice tag and a voice class', () => {
    const [cue] = parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v.loud Ana>Oi</v>\n');

    expect(cue).toEqual({ end: 2, speaker: 'Ana', start: 1, text: 'Oi' });
  });
});

describe('buildParagraphs', () => {
  it('starts a new paragraph when another person speaks, even mid-sentence', () => {
    const paragraphs = buildParagraphs(parseVtt(VTT));

    expect(paragraphs.map(({ pieces, speaker }) => [speaker, pieces.map((p) => p.text.trim()).join(' ')])).toEqual([
      ['Ana Lima', 'Bom dia a todos. Vamos começar'],
      ['Bruno', 'pela pauta de hoje.'],
      [null, 'sem voz & sem nome'],
    ]);
  });

  it('keeps one paragraph for cues without speakers, as before', () => {
    const cues = parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\num\n\n00:00:02.100 --> 00:00:03.000\ndois.\n');

    expect(buildParagraphs(cues)).toHaveLength(1);
  });
});
