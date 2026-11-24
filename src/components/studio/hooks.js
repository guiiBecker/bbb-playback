import { useEffect, useState } from 'react';
import player from 'utils/player';

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

export { usePlayerState };
