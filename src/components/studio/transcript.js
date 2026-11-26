import React, { useEffect, useMemo, useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import { buildFileURL } from 'utils/data';
import { useFollow } from './follow';
import { formatTime, seekTo } from './utils';

const intlMessages = defineMessages({
  aria: { id: 'studio.transcript.aria', defaultMessage: 'Transcription' },
  empty: { id: 'studio.transcript.empty', defaultMessage: "We didn't find a transcription in this recording." },
  error: { id: 'studio.transcript.error', defaultMessage: 'The transcription could not be loaded.' },
  language: { id: 'studio.transcript.language', defaultMessage: 'Language' },
  loading: { id: 'studio.transcript.loading', defaultMessage: 'Loading the transcription…' },
  seek: { id: 'studio.chat.seek', defaultMessage: 'Go to {time}' },
});

// A paragraph ends at a pause in the speech, or at the end of a sentence once
// it is long enough
const PARAGRAPH_GAP = 2.5;
const PARAGRAPH_SOFT_LENGTH = 160;
const PARAGRAPH_MAX_LENGTH = 320;

// "00:01:02.500" or "01:02.500" -> 62.5
const parseCueTime = (value) => value
  .trim()
  .split(':')
  .reduce((total, part) => total * 60 + parseFloat(part), 0);

// gen_webvtt escapes &, < and >
const decode = (text) => text
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

// WebVTT voice span: "<v Ana Lima>text", the speaker of the cue
const VOICE = /^<v(?:\.[\w.-]+)?\s+([^>]+)>/;

// WebVTT -> [{ start, end, text, speaker }]. The recording's files come from
// record-and-playback's gen_webvtt: lines of up to 32 characters, one or two
// per cue. A cue may say who speaks with a voice span; `speaker` is then that
// name, else null
const parseVtt = (content) => content
  .replace(/\r/g, '')
  .split(/\n{2,}/)
  .map((block) => {
    const lines = block.split('\n');
    const timing = lines.findIndex((line) => line.includes('-->'));
    if (timing === -1) return null;

    const [start, end] = lines[timing].split('-->').map((part) => parseCueTime(part.trim().split(/\s+/)[0]));
    // Keeps the cue's line breaks for the captions; the transcript joins them
    const raw = lines.slice(timing + 1).map((line) => line.trim()).filter(Boolean).join('\n');
    const voice = VOICE.exec(raw);
    const text = decode(raw.replace(/<\/?v(?:[.\s][^>]*)?>/g, '').trim());

    return text ? {
      end, speaker: voice ? decode(voice[1].trim()) : null, start, text,
    } : null;
  })
  .filter(Boolean);

// A cue's text cut at its sentence ends: "a. B c" -> ["a. ", "B c"]
const SENTENCES = /[^.!?…]+(?:[.!?…]+["')\]]*\s*|$)|[.!?…]+\s*/g;

const sentenceEnds = (text) => /[.!?…]["')\]]*\s*$/.test(text);

// The cues are short line fragments that cut sentences anywhere, so reading
// them as a list is choppy. They are joined into paragraphs that only end at a
// sentence end: after a pause in the speech, or once they are long enough. Each
// piece keeps its cue, to mark the one being spoken and to seek to it
const buildParagraphs = (cues) => {
  const paragraphs = [];
  let current = null;

  const open = (piece, speaker) => {
    current = {
      first: piece.index,
      id: `p${paragraphs.length}`,
      last: piece.index,
      length: 0,
      pieces: [],
      speaker,
      start: piece.start,
    };
    paragraphs.push(current);
  };

  cues.forEach((cue, index) => {
    const next = cues[index + 1];
    // Another person speaking starts a new paragraph, mid-sentence or not
    if (current && cue.speaker !== current.speaker) current = null;
    const pieces = cue.text.replace(/\n/g, ' ').match(SENTENCES) || [];

    pieces.forEach((text, position) => {
      const piece = { index, key: `${index}-${position}`, start: cue.start, text };
      if (!current) open(piece, cue.speaker || null);

      current.pieces.push(piece);
      current.last = index;
      current.length += text.length;

      if (!sentenceEnds(text)) {
        // No sentence end for too long: break anyway, between cues
        if (current.length >= PARAGRAPH_MAX_LENGTH && position === pieces.length - 1) current = null;
        return;
      }

      const lastPiece = position === pieces.length - 1;
      const pause = lastPiece && (!next || next.start - cue.end > PARAGRAPH_GAP);
      if (pause || current.length >= PARAGRAPH_SOFT_LENGTH) current = null;
    });
  });

  return paragraphs;
};

// The latest cue that has started; -1 before the first one
const findCueIndex = (cues, time) => {
  let low = 0;
  let high = cues.length - 1;
  let found = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (cues[middle].start <= time) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return found;
};

// The cue on screen at `time`, for the captions. gen_webvtt never overlaps
// cues, so it is the latest one that has started, until it ends
const activeCue = (cues, time) => {
  const cue = cues[findCueIndex(cues, time)];

  return cue && cue.end > time ? cue : null;
};

// The recorded transcription comes as one WebVTT file per language, listed in
// captions.json
const useTranscript = (locale) => {
  const [state, setState] = useState({ cues: [], status: locale ? 'loading' : 'empty' });

  useEffect(() => {
    if (!locale) {
      setState({ cues: [], status: 'empty' });
      return undefined;
    }

    let cancelled = false;
    setState({ cues: [], status: 'loading' });
    fetch(buildFileURL(`caption_${locale}.vtt`))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((content) => {
        if (cancelled) return;
        const cues = parseVtt(content);
        setState({ cues, status: cues.length ? 'ready' : 'empty' });
      })
      .catch(() => {
        if (!cancelled) setState({ cues: [], status: 'error' });
      });

    return () => { cancelled = true; };
  }, [locale]);

  return state;
};

// Prefers the captions in the interface language, else the first ones
const pickLocale = (captions, interfaceLocale) => {
  if (!captions.length) return null;

  const language = (interfaceLocale || '').split('-')[0];
  const match = captions.find((c) => c.locale === interfaceLocale)
    || captions.find((c) => c.locale.split('-')[0] === language);

  return (match || captions[0]).locale;
};

// `speaker` is shown when it changes from the paragraph before
const Paragraph = React.memo(({ activeCue, current, intl, paragraph, past, speaker }) => {
  const time = formatTime(paragraph.start);

  return (
    <li
      className={cx('studio-paragraph', { current, future: !past })}
      data-id={paragraph.id}
    >
      <div className="studio-paragraph-head">
        {speaker ? <span className="studio-paragraph-speaker">{speaker}</span> : null}
        <button
          aria-label={intl.formatMessage(intlMessages.seek, { time })}
          className="studio-paragraph-time"
          onClick={() => seekTo(paragraph.start)}
          type="button"
        >
          {time}
        </button>
      </div>
      <p className="studio-paragraph-text">
        {paragraph.pieces.map((piece) => (
          // Mouse shortcut to any sentence; the time button above is the
          // keyboard way in
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <span
            className={cx('studio-cue', {
              current: piece.index === activeCue,
              future: activeCue !== -1 && piece.index > activeCue,
            })}
            key={piece.key}
            onClick={() => seekTo(piece.start)}
          >
            {piece.text.endsWith(' ') ? piece.text : `${piece.text} `}
          </span>
        ))}
      </p>
    </li>
  );
});

// The recorded transcription as text that follows the playback. The cue being
// spoken is marked inside its paragraph, what is still ahead is dimmed
const Transcript = ({ captions, cues, locale, setLocale, status, time }) => {
  const intl = useIntl();
  const paragraphs = useMemo(() => buildParagraphs(cues), [cues]);

  const cueIndex = findCueIndex(cues, time);
  // A cue can end one paragraph and start the next: the later one is current
  let current = null;
  if (cueIndex >= 0) {
    for (let i = paragraphs.length - 1; i >= 0 && !current; i -= 1) {
      if (paragraphs[i].first <= cueIndex) current = paragraphs[i];
    }
  }
  const { listProps } = useFollow(current ? current.id : null);

  const language = captions.length ? (
    <div className="studio-language">
      <span className="studio-language-label">{intl.formatMessage(intlMessages.language)}</span>
      {captions.length > 1 ? (
        <select
          aria-label={intl.formatMessage(intlMessages.language)}
          onChange={(event) => setLocale(event.target.value)}
          value={locale}
        >
          {captions.map((c) => <option key={c.locale} value={c.locale}>{c.localeName}</option>)}
        </select>
      ) : (
        <span className="studio-language-name">{captions[0].localeName}</span>
      )}
    </div>
  ) : null;

  if (status !== 'ready') {
    return (
      <>
        {language}
        <p className="studio-empty">{intl.formatMessage(intlMessages[status])}</p>
      </>
    );
  }

  return (
    <>
      {language}
      <ul
        aria-label={intl.formatMessage(intlMessages.aria)}
        className="studio-transcript studio-list"
        {...listProps}
      >
        {paragraphs.map((paragraph, index) => (
          <Paragraph
            activeCue={paragraph.first <= cueIndex && cueIndex <= paragraph.last ? cueIndex : -1}
            current={paragraph === current}
            intl={intl}
            key={paragraph.id}
            paragraph={paragraph}
            past={cueIndex >= paragraph.first}
            speaker={paragraph.speaker && paragraph.speaker !== (paragraphs[index - 1] || {}).speaker
              ? paragraph.speaker
              : null}
          />
        ))}
      </ul>
    </>
  );
};

export {
  activeCue,
  buildParagraphs,
  parseVtt,
  pickLocale,
  useTranscript,
};

export default Transcript;
