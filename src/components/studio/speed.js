import React, { useEffect, useId, useRef, useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import player from 'utils/player';

// The speeds the studio offers. The classic player keeps its own list
// (config.js, player.rates)
const SPEEDS = [0.5, 1, 1.5, 2, 3];

const NAVIGATION_KEYS = ['ArrowDown', 'ArrowUp', 'End', 'Home'];

const intlMessages = defineMessages({
  speed: { id: 'studio.controls.speed', defaultMessage: 'Playback speed' },
  speedValue: { id: 'studio.controls.speedValue', defaultMessage: 'Playback speed {rate}' },
});

const isRate = (value, rate) => Math.abs(value - rate) < 0.001;

// The current speed on a small pill; it opens the list of speeds above it.
// A disclosure: the speeds are plain buttons, the current one pressed. Escape,
// a press outside or tabbing away closes the list; arrows move within it
const Speed = ({ rate }) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  // The value pops in after a choice, not when the page loads
  const [chosen, setChosen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const list = useRef(null);
  const id = useId();

  // "1.5x", "1,5x" in German
  const format = (value) => `${intl.formatNumber(value)}x`;

  const close = () => {
    setOpen(false);
    if (button.current) button.current.focus();
  };

  const select = (value) => {
    if (player.primary) player.primary.playbackRate(value);
    setChosen(true);
    close();
  };

  // On opening the current speed takes the focus, so arrows and Enter work
  // right away; a press anywhere else closes the list
  useEffect(() => {
    if (!open) return undefined;

    const items = list.current ? [...list.current.querySelectorAll('button')] : [];
    const current = items.find((item) => item.getAttribute('aria-pressed') === 'true') || items[0];
    if (current) current.focus();

    const outside = (event) => {
      if (root.current && !root.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const onKeyDown = (event) => {
    if (!open) return;

    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }

    if (!NAVIGATION_KEYS.includes(event.key) || !list.current) return;

    const items = [...list.current.querySelectorAll('button')];
    const index = items.indexOf(document.activeElement);
    const last = items.length - 1;
    const next = {
      ArrowDown: index < last ? index + 1 : 0,
      ArrowUp: index > 0 ? index - 1 : last,
      End: last,
      Home: 0,
    }[event.key];

    event.preventDefault();
    items[next].focus();
  };

  // Tabbing out closes. Only when the focus goes somewhere: Safari does not
  // focus buttons on click, there the press outside does it
  const onBlur = (event) => {
    if (open && event.relatedTarget && !root.current.contains(event.relatedTarget)) setOpen(false);
  };

  const value = format(rate);
  const label = intl.formatMessage(intlMessages.speedValue, { rate: value });

  return (
    // The handlers watch the keys and the focus of the buttons inside
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="studio-speed" onBlur={onBlur} onKeyDown={onKeyDown} ref={root}>
      <button
        aria-controls={open ? id : undefined}
        aria-expanded={open}
        aria-label={label}
        className="studio-speed-button"
        onClick={() => setOpen((shown) => !shown)}
        ref={button}
        title={label}
        type="button"
      >
        {/* A new element for each speed, so the pop plays again */}
        <span className={cx('studio-speed-value', { pop: chosen })} key={rate}>{value}</span>
      </button>
      {open ? (
        <ul aria-label={intl.formatMessage(intlMessages.speed)} className="studio-speed-list" id={id} ref={list}>
          {SPEEDS.map((speed) => (
            <li key={speed}>
              <button
                aria-pressed={isRate(speed, rate)}
                className="studio-speed-option"
                onClick={() => select(speed)}
                type="button"
              >
                {format(speed)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default Speed;
