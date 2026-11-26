import React, { useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import { player as config } from 'config';
import player from 'utils/player';
import { useDisclosure } from './disclosure';

// The classic player's speeds (config.js, player.rates) and 3x on top
const SPEEDS = [...new Set([...config.rates, 3])].sort((a, b) => a - b);

const intlMessages = defineMessages({
  speed: { id: 'studio.controls.speed', defaultMessage: 'Playback speed' },
  speedValue: { id: 'studio.controls.speedValue', defaultMessage: 'Playback speed {rate}' },
});

const isRate = (value, rate) => Math.abs(value - rate) < 0.001;

// The current speed on a small pill; it opens the list of speeds above it
// (a disclosure, see disclosure.js)
const Speed = ({ rate }) => {
  const intl = useIntl();
  // The value pops in after a choice, not when the page loads
  const [chosen, setChosen] = useState(false);
  const {
    button,
    close,
    id,
    list,
    onBlur,
    onKeyDown,
    open,
    root,
    toggle,
  } = useDisclosure();

  // "1.5x", "1,5x" in German
  const format = (value) => `${intl.formatNumber(value)}x`;

  const select = (value) => {
    if (player.primary) player.primary.playbackRate(value);
    setChosen(true);
    close();
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
        onClick={toggle}
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
