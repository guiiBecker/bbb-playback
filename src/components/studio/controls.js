import React, { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { play } from 'utils/actions';
import Icon from './icon';
import { formatTime, seekTo as setTime } from './utils';

const intlMessages = defineMessages({
  play: { id: 'studio.controls.play', defaultMessage: 'Play' },
  pause: { id: 'studio.controls.pause', defaultMessage: 'Pause' },
  timeline: { id: 'studio.controls.timeline', defaultMessage: 'Timeline' },
  captions: { id: 'studio.controls.captions', defaultMessage: 'Captions' },
  fullscreen: { id: 'studio.controls.fullscreen', defaultMessage: 'Fullscreen' },
  exitFullscreen: { id: 'studio.controls.exitFullscreen', defaultMessage: 'Exit fullscreen' },
});

const Timeline = ({ duration, time, label }) => {
  const track = useRef(null);
  const [dragTime, setDragTime] = useState(null);

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

  // The row above the track is reserved for the event markers
  return (
    <div className="studio-timeline">
      <div className="studio-markers" />
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
        <div className="studio-track-handle" style={{ left: `${progress}%` }} />
      </div>
    </div>
  );
};

// Fullscreen for the presentation, with the controls at the bottom. Hidden
// where the browser has no element fullscreen (iPhone)
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
      <Icon name={active ? 'fullscreenExit' : 'fullscreen'} />
    </button>
  );
};

// Play, time, timeline, captions and fullscreen. The other buttons (seek,
// speed, volume) go in the actions slot in later steps
const Controls = ({ captions, fullscreen, state }) => {
  const intl = useIntl();
  const { duration, paused, time } = state;

  return (
    <div className="studio-controls">
      <button
        aria-label={intl.formatMessage(paused ? intlMessages.play : intlMessages.pause)}
        className="studio-play"
        onClick={() => play()}
        type="button"
      >
        <Icon name={paused ? 'play' : 'pause'} size={30} />
      </button>
      <span className="studio-clock">
        {formatTime(time)} / {formatTime(duration)}
      </span>
      <Timeline duration={duration} label={intl.formatMessage(intlMessages.timeline)} time={time} />
      <div className="studio-actions">
        {captions.available ? (
          <button
            aria-label={intl.formatMessage(intlMessages.captions)}
            aria-pressed={captions.on}
            className="studio-control"
            onClick={captions.toggle}
            title={intl.formatMessage(intlMessages.captions)}
            type="button"
          >
            <Icon name="captions" />
          </button>
        ) : null}
        <FullscreenButton fullscreen={fullscreen} />
      </div>
    </div>
  );
};

export default Controls;
