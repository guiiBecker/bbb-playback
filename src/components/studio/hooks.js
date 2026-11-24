import { useEffect, useState } from 'react';
import player from 'utils/player';
import {
  getFullscreenElement,
  isFullscreenSupported,
  toggleFullscreen,
} from './utils';

const PLAYER_EVENTS = [
  'durationchange',
  'loadedmetadata',
  'pause',
  'play',
  'seeked',
  'timeupdate',
];

const readPlayer = (p) => ({
  duration: p.duration() || 0,
  hasVideo: p.videoWidth() > 0,
  paused: p.paused(),
  height: p.videoHeight(),
  ratio: p.videoWidth() && p.videoHeight() ? p.videoWidth() / p.videoHeight() : 4 / 3,
  source: p.currentSrc() || '',
  time: p.currentTime() || 0,
  width: p.videoWidth(),
});

const INITIAL = {
  duration: 0,
  hasVideo: true,
  paused: true,
  height: 0,
  ratio: 4 / 3,
  source: '',
  time: 0,
  width: 0,
};

// The video.js player is created by the webcams component after mount, so
// wait for it before subscribing
const usePlayerState = () => {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    let current = null;
    let timer = null;

    const update = () => {
      if (current && !current.isDisposed()) setState(readPlayer(current));
    };

    const attach = () => {
      if (!player.primary) {
        timer = setTimeout(attach, 100);
        return;
      }

      current = player.primary;
      PLAYER_EVENTS.forEach((event) => current.on(event, update));
      update();
    };

    attach();

    return () => {
      clearTimeout(timer);
      if (current && !current.isDisposed()) {
        PLAYER_EVENTS.forEach((event) => current.off(event, update));
      }
    };
  }, []);

  return state;
};

const FULLSCREEN_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
];

// Fullscreen state of the element in `ref`. Follows the browser events, so
// leaving with Escape or the browser's own controls updates it as well
const useFullscreen = (ref) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const update = () => {
      setActive(Boolean(ref.current) && getFullscreenElement() === ref.current);
    };

    FULLSCREEN_EVENTS.forEach((event) => document.addEventListener(event, update));
    update();

    return () => {
      FULLSCREEN_EVENTS.forEach((event) => document.removeEventListener(event, update));
    };
  }, [ref]);

  return {
    active,
    supported: isFullscreenSupported(),
    toggle: () => toggleFullscreen(ref.current),
  };
};

export {
  useFullscreen,
  usePlayerState,
};
