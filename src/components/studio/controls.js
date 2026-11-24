import React, { useMemo, useRef, useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import { play } from 'utils/actions';
import Icon from './icon';
import { buildMarkers, buildSegments, TYPES } from './markers';
import Speed from './speed';
import { formatTime, seekTo as setTime } from './utils';

const intlMessages = defineMessages({
  play: { id: 'studio.controls.play', defaultMessage: 'Play' },
  pause: { id: 'studio.controls.pause', defaultMessage: 'Pause' },
  timeline: { id: 'studio.controls.timeline', defaultMessage: 'Timeline' },
  captions: { id: 'studio.controls.captions', defaultMessage: 'Captions' },
  fullscreen: { id: 'studio.controls.fullscreen', defaultMessage: 'Fullscreen' },
  exitFullscreen: { id: 'studio.controls.exitFullscreen', defaultMessage: 'Exit fullscreen' },
  chat: { id: 'studio.marker.chat', defaultMessage: '{count, plural, one {# chat message} other {# chat messages}}' },
  slide: { id: 'studio.marker.slide', defaultMessage: '{count, plural, one {# slide change} other {# slide changes}}' },
  poll: { id: 'studio.marker.poll', defaultMessage: '{count, plural, one {# poll} other {# polls}}' },
  screenshare: { id: 'studio.marker.screenshare', defaultMessage: 'Screen sharing' },
  video: { id: 'studio.marker.video', defaultMessage: '{count, plural, one {# external video} other {# external videos}}' },
});

const MARKER_ICONS = {
  chat: 'chat',
  poll: 'poll',
  screenshare: 'screenshare',
  slide: 'slides',
  video: 'video',
};

// "01:15 · 2 chat messages, 1 slide change"
const describe = (intl, marker) => {
  const parts = TYPES
    .filter((type) => marker.counts[type])
    .map((type) => intl.formatMessage(intlMessages[type], { count: marker.counts[type] }));

  return `${formatTime(marker.time)} · ${parts.join(', ')}`;
};

// What happened along the recording, above the track. Each marker seeks to
// its time
const Markers = ({ markers, shown }) => {
  const intl = useIntl();

  return (
    <div className="studio-markers">
      {markers.map((marker) => {
        const label = describe(intl, marker);

        return (
          <button
            aria-label={label}
            className={cx('studio-marker', { reached: marker.time <= shown })}
            key={`${marker.type}-${marker.time}`}
            onClick={() => setTime(marker.time)}
            style={{ left: `${marker.position * 100}%` }}
            title={label}
            type="button"
          >
            <Icon name={MARKER_ICONS[marker.type]} size={14} />
          </button>
        );
      })}
    </div>
  );
};

const Timeline = ({ duration, time, label }) => {
  const track = useRef(null);
  const [dragTime, setDragTime] = useState(null);
  const markers = useMemo(() => buildMarkers(duration), [duration]);
  const segments = useMemo(() => buildSegments(duration), [duration]);

  const timeAt = (event) => {
    const rect = track.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));

    return ratio * duration;
  };

  const onPointerDown = (event) => {
    if (!duration) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragTime(timeAt(event));
  };

  const onPointerMove = (event) => {
    if (dragTime !== null) setDragTime(timeAt(event));
  };

  const onPointerUp = (event) => {
    if (dragTime === null) return;
    setTime(timeAt(event));
    setDragTime(null);
  };

  const onKeyDown = (event) => {
    const step = { ArrowLeft: -5, ArrowRight: 5 }[event.key];
    if (step) {
      event.preventDefault();
      setTime(Math.min(duration, Math.max(0, time + step)));
    }
  };

  const shown = dragTime !== null ? dragTime : time;
  const progress = duration ? (shown / duration) * 100 : 0;

  return (
    <div className="studio-timeline">
      <Markers markers={markers} shown={shown} />
      <div
        aria-label={label}
        aria-valuemax={Math.floor(duration)}
        aria-valuemin={0}
        aria-valuenow={Math.floor(shown)}
        aria-valuetext={`${formatTime(shown)} / ${formatTime(duration)}`}
        className="studio-track"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={track}
        role="slider"
        tabIndex={0}
      >
        <div className="studio-track-rail" />
        <div className="studio-track-fill" style={{ width: `${progress}%` }} />
        {/* Breaks in the rail: the recording's parts, between slide changes */}
        {segments.map((position) => (
          <div className="studio-track-gap" key={position} style={{ left: `${position * 100}%` }} />
        ))}
        <div className="studio-track-handle" style={{ left: `${progress}%` }} />
      </div>
    </div>
  );
};

// Fullscreen for the presentation and the webcams, with the controls at the
// bottom. Hidden where the browser has no element fullscreen (iPhone)
const FullscreenButton = ({ fullscreen }) => {
  const intl = useIntl();

  if (!fullscreen.supported) return null;

  const { active, toggle } = fullscreen;
  const label = intl.formatMessage(active ? intlMessages.exitFullscreen : intlMessages.fullscreen);

  return (
    <button
      aria-label={label}
      className="studio-control"
      onClick={toggle}
      title={label}
      type="button"
    >
      <Icon name={active ? 'fullscreenExit' : 'fullscreen'} size={20} />
    </button>
  );
};

// Play, time, timeline, speed, captions and fullscreen. The other buttons
// (seek, volume) go in the actions slot in later steps
const Controls = ({ captions, fullscreen, state }) => {
  const intl = useIntl();
  const {
    duration,
    paused,
    rate,
    time,
  } = state;

  return (
    <div className="studio-controls">
      <button
        aria-label={intl.formatMessage(paused ? intlMessages.play : intlMessages.pause)}
        className="studio-play"
        onClick={() => play()}
        type="button"
      >
        <Icon name={paused ? 'play' : 'pause'} size={18} />
      </button>
      <span className="studio-clock">
        {formatTime(time)} / {formatTime(duration)}
      </span>
      <Timeline duration={duration} label={intl.formatMessage(intlMessages.timeline)} time={time} />
      <div className="studio-actions">
        <Speed rate={rate} />
        {captions.available ? (
          <button
            aria-label={intl.formatMessage(intlMessages.captions)}
            aria-pressed={captions.on}
            className="studio-control"
            onClick={captions.toggle}
            title={intl.formatMessage(intlMessages.captions)}
            type="button"
          >
            <Icon name="captions" size={20} />
          </button>
        ) : null}
        <FullscreenButton fullscreen={fullscreen} />
      </div>
    </div>
  );
};

export default Controls;
