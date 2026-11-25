import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import { shortcuts } from 'config';
import { play, seek } from 'utils/actions';
import player from 'utils/player';
import Icon from './icon';
import { buildMarkers, buildSegments, TYPES } from './markers';
import Speed from './speed';
import { formatTime, seekTo as setTime } from './utils';

// The timeline's arrow keys move by this; the back and forward buttons by the
// seek shortcut's step (15 s), as in the classic player
const ARROW_STEP = 5;

const intlMessages = defineMessages({
  play: { id: 'studio.controls.play', defaultMessage: 'Play' },
  pause: { id: 'studio.controls.pause', defaultMessage: 'Pause' },
  timeline: { id: 'studio.controls.timeline', defaultMessage: 'Timeline' },
  captions: { id: 'studio.controls.captions', defaultMessage: 'Captions' },
  webcams: { id: 'studio.controls.webcams', defaultMessage: 'Webcams' },
  backward: { id: 'studio.controls.backward', defaultMessage: 'Back {seconds} seconds' },
  forward: { id: 'studio.controls.forward', defaultMessage: 'Forward {seconds} seconds' },
  mute: { id: 'studio.controls.mute', defaultMessage: 'Mute' },
  unmute: { id: 'studio.controls.unmute', defaultMessage: 'Unmute' },
  volume: { id: 'studio.controls.volume', defaultMessage: 'Volume' },
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
    const step = { ArrowLeft: -ARROW_STEP, ArrowRight: ARROW_STEP }[event.key];
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
        // While dragging the handle grows (index.scss); :active alone misses
        // touch screens
        className={cx('studio-track', { dragging: dragTime !== null })}
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
      className="studio-control studio-fullscreen"
      onClick={toggle}
      title={label}
      type="button"
    >
      <Icon name={active ? 'fullscreenExit' : 'fullscreen'} size={20} />
    </button>
  );
};

// Back and forward by a fixed step
const SeekButtons = () => {
  const intl = useIntl();
  const { seconds } = shortcuts.seek;
  const step = (direction) => {
    if (player.primary) seek(direction * seconds);
  };

  return (
    <div className="studio-seek">
      {[['backward', -1], ['forward', 1]].map(([name, direction]) => {
        const label = intl.formatMessage(intlMessages[name], { seconds });

        return (
          <button
            aria-label={label}
            className="studio-control"
            key={name}
            onClick={() => step(direction)}
            title={label}
            type="button"
          >
            <Icon name={name} size={20} />
          </button>
        );
      })}
    </div>
  );
};

// The webcams video carries the meeting's audio; a shared screen may bring
// its own, so it follows the same volume
const applyVolume = (volume, muted) => {
  [player.primary, player.screenshare].filter(Boolean).forEach((p) => {
    p.volume(volume);
    p.muted(muted);
  });
};

// Mute toggle, with a slider to turn the volume up and down that opens on
// hover or keyboard focus
const VolumeControl = ({ muted: playerMuted, volume: playerVolume }) => {
  const intl = useIntl();
  // Set at once on input: the player reports a change a moment later, and
  // until then the slider would jump back to the old value, so quick presses
  // of the arrow keys lost all but one step
  const [level, setLevel] = useState({ muted: playerMuted, volume: playerVolume });
  useEffect(() => {
    setLevel({ muted: playerMuted, volume: playerVolume });
  }, [playerMuted, playerVolume]);

  const set = (volume, muted) => {
    setLevel({ muted, volume });
    applyVolume(volume, muted);
  };

  const { muted, volume } = level;
  const silent = muted || volume === 0;
  const label = intl.formatMessage(silent ? intlMessages.unmute : intlMessages.mute);
  let icon = 'volumeHigh';
  if (silent) icon = 'volumeMuted';
  else if (volume < 0.5) icon = 'volumeLow';

  // Unmuting at zero would stay silent: bring the volume back up
  const toggle = () => {
    if (silent) set(volume === 0 ? 0.5 : volume, false);
    else set(volume, true);
  };

  const shown = silent ? 0 : volume;

  return (
    <div className="studio-volume">
      <button
        aria-label={label}
        className="studio-control"
        onClick={toggle}
        title={label}
        type="button"
      >
        <Icon name={icon} size={20} />
      </button>
      <input
        aria-label={intl.formatMessage(intlMessages.volume)}
        aria-valuetext={`${Math.round(shown * 100)}%`}
        max={1}
        min={0}
        onChange={(event) => {
          const value = parseFloat(event.target.value);
          set(value, value === 0);
        }}
        step={0.05}
        style={{ '--studio-volume-level': `${shown * 100}%` }}
        type="range"
        value={shown}
      />
    </div>
  );
};

// Play, back and forward, time, timeline, speed, webcams, captions, volume and
// fullscreen
const Controls = ({
  captions,
  fullscreen,
  state,
  webcams,
}) => {
  const intl = useIntl();
  const {
    duration,
    muted,
    paused,
    rate,
    time,
    volume,
  } = state;

  return (
    <div className="studio-controls">
      <button
        aria-label={intl.formatMessage(paused ? intlMessages.play : intlMessages.pause)}
        className="studio-play"
        onClick={() => play()}
        type="button"
      >
        {/* A new icon on every change, so it pops in (index.scss) */}
        <Icon key={paused ? 'play' : 'pause'} name={paused ? 'play' : 'pause'} size={18} />
      </button>
      <SeekButtons />
      <span className="studio-clock">
        {formatTime(time)} / {formatTime(duration)}
      </span>
      <Timeline duration={duration} label={intl.formatMessage(intlMessages.timeline)} time={time} />
      <div className="studio-actions">
        <Speed rate={rate} />
        {webcams.available ? (
          // A toggle like captions; the icon shows the state, and a new
          // icon on every change so it pops in (index.scss)
          <button
            aria-label={intl.formatMessage(intlMessages.webcams)}
            aria-pressed={webcams.on}
            className="studio-control studio-webcams-toggle"
            onClick={webcams.toggle}
            title={intl.formatMessage(intlMessages.webcams)}
            type="button"
          >
            <Icon key={webcams.on ? 'on' : 'off'} name={webcams.on ? 'webcams' : 'webcamsOff'} size={20} />
          </button>
        ) : null}
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
        <VolumeControl muted={muted} volume={volume} />
        <FullscreenButton fullscreen={fullscreen} />
      </div>
    </div>
  );
};

export default Controls;
