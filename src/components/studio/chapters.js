import React, { useMemo } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import { ID } from 'utils/constants';
import { buildFileURL } from 'utils/data';
import storage from 'utils/data/storage';
import { useFollow } from './follow';
import Icon from './icon';
import { formatTime, seekTo } from './utils';

const intlMessages = defineMessages({
  aria: { id: 'studio.chapters.aria', defaultMessage: 'Chapters' },
  chapter: { id: 'studio.chapters.chapter', defaultMessage: 'Chapter {number}' },
  empty: { id: 'studio.chapters.empty', defaultMessage: "We didn't find chapters in this recording." },
  screenshare: { id: 'studio.marker.screenshare', defaultMessage: 'Screen sharing' },
  slide: { id: 'studio.chapters.slide', defaultMessage: 'Slide {number}' },
});

// A slide shown for less time than this is no chapter: the presenter paging
// through to another slide
const MIN_CHAPTER = 5;

// The rows that come in one after the other when the tab opens; the rest
// come in with the last of them
const STAGGERED = 8;

// The slide's first line of text, if it has any
const firstLine = (text) => (text || '')
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .find(Boolean) || '';

const toChapter = (item, start, index) => ({
  height: item.height,
  id: `chapter-${index}`,
  image: item.image,
  number: item.number,
  src: item.src,
  start,
  text: item.alt,
  width: item.width,
});

// The recording has no chapters of its own: each slide shown and each screen
// sharing is one (`items`: storage.slides, from slides.json). Slides shown
// only for a moment are paging: that time goes to the slide it leads to, and
// what is then the same slide twice in a row is one chapter.
// [{ id, start, end, src, image, number, text, width, height }]
const buildChapters = (items, duration) => {
  const chapters = [];
  let paging = null;

  items.forEach((item, index) => {
    const next = items[index + 1];
    const end = next ? next.timestamp : duration;

    if (end - item.timestamp < MIN_CHAPTER) {
      if (paging === null) paging = item.timestamp;
      return;
    }

    const start = paging === null ? item.timestamp : paging;
    paging = null;

    const previous = chapters[chapters.length - 1];
    if (previous && previous.src === item.src) return;

    chapters.push(toChapter(item, start, chapters.length));
  });

  // Every slide was short: the first one stands for them
  if (!chapters.length && items.length) chapters.push(toChapter(items[0], items[0].timestamp, 0));

  return chapters.map((chapter, index) => {
    const next = chapters[index + 1];

    return { ...chapter, end: next ? next.start : Math.max(duration, chapter.start) };
  });
};

// The latest chapter that has started; -1 before the first one
const findChapterIndex = (chapters, time) => {
  let found = -1;
  chapters.forEach((chapter, index) => {
    if (chapter.start <= time) found = index;
  });

  return found;
};

// 30 -> "30 sec", 150 -> "3 min", 3900 -> "1 hr 5 min"
const formatLength = (intl, seconds) => {
  const unit = (value, name) => intl.formatNumber(value, { style: 'unit', unit: name, unitDisplay: 'short' });
  const total = Math.max(1, Math.round(seconds));
  if (total < 60) return unit(total, 'second');

  const minutes = Math.round(total / 60);
  if (minutes < 60) return unit(minutes, 'minute');

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest ? `${unit(hours, 'hour')} ${unit(rest, 'minute')}` : unit(hours, 'hour');
};

const Thumbnail = ({ chapter }) => {
  if (chapter.src === ID.SCREENSHARE) return <Icon name="screenshare" size={28} />;
  // A slide the server had no picture of
  if (!chapter.image) return <Icon name="slides" size={28} />;

  // The size before it loads, so lazy loading knows which rows are visible
  const size = chapter.width > 0 && chapter.height > 0
    ? { height: chapter.height, width: chapter.width }
    : {};

  return <img alt="" loading="lazy" src={buildFileURL(chapter.image)} {...size} />;
};

const Chapter = React.memo(({ chapter, current, index, intl, progress }) => {
  const screenshare = chapter.src === ID.SCREENSHARE;
  const number = chapter.number > 0 ? chapter.number : null;
  const text = firstLine(chapter.text);
  const slide = number ? intl.formatMessage(intlMessages.slide, { number }) : null;

  let title = text;
  if (screenshare) title = intl.formatMessage(intlMessages.screenshare);
  else if (!title) title = slide || intl.formatMessage(intlMessages.chapter, { number: index + 1 });

  const length = formatLength(intl, chapter.end - chapter.start);
  const meta = !screenshare && text && slide ? `${slide} · ${length}` : length;

  return (
    <li
      className={cx('studio-chapter', { current })}
      data-id={chapter.id}
      style={{ '--studio-chapter-delay': Math.min(index, STAGGERED) }}
    >
      <button
        aria-current={current ? 'true' : undefined}
        className="studio-chapter-button"
        onClick={() => seekTo(chapter.start)}
        type="button"
      >
        <span className={cx('studio-chapter-thumb', { screenshare: screenshare || !chapter.image })}>
          <Thumbnail chapter={chapter} />
          <span aria-hidden="true" className="studio-chapter-play">
            <Icon name="play" size={16} />
          </span>
          <span className="studio-chapter-time">{formatTime(chapter.start)}</span>
          {current ? (
            <span aria-hidden="true" className="studio-chapter-progress">
              <span style={{ transform: `scaleX(${progress})` }} />
            </span>
          ) : null}
        </span>
        <span className="studio-chapter-text">
          <span className="studio-chapter-title">{title}</span>
          <span className="studio-chapter-meta">{meta}</span>
        </span>
      </button>
    </li>
  );
});

// The recording's chapters with a picture of each, following the playback:
// the current one is marked, with how far into it the playback is
const Chapters = ({ duration, time }) => {
  const intl = useIntl();
  const chapters = useMemo(() => buildChapters(storage.slides || [], duration), [duration]);
  const currentIndex = findChapterIndex(chapters, time);
  const current = chapters[currentIndex];
  const { listProps } = useFollow(current ? current.id : null);

  if (!chapters.length) {
    return <p className="studio-empty">{intl.formatMessage(intlMessages.empty)}</p>;
  }

  const progress = current && current.end > current.start
    ? Math.min(1, Math.max(0, (time - current.start) / (current.end - current.start)))
    : 0;

  return (
    <ul
      aria-label={intl.formatMessage(intlMessages.aria)}
      className="studio-chapters studio-list"
      {...listProps}
    >
      {chapters.map((chapter, index) => (
        <Chapter
          chapter={chapter}
          current={index === currentIndex}
          index={index}
          intl={intl}
          key={chapter.id}
          progress={index === currentIndex ? progress : 0}
        />
      ))}
    </ul>
  );
};

export { buildChapters };

export default Chapters;
