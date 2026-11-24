import logger from 'utils/logger';
import player from 'utils/player';

const pad = (value) => String(value).padStart(2, '0');

// 75 -> "01:15", 3675 -> "1:01:15"
const formatTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const seekTo = (time) => {
  if (player.primary) player.primary.currentTime(time);
};

// Element fullscreen. Safari before 16.4 only has the webkit-prefixed API,
// the iPhone has none for elements other than video
const getFullscreenElement = () => (
  document.fullscreenElement || document.webkitFullscreenElement || null
);

const isFullscreenSupported = () => Boolean(
  document.fullscreenEnabled || document.webkitFullscreenEnabled
);

const toggleFullscreen = (element) => {
  let request;
  if (getFullscreenElement()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) request = exit.call(document);
  } else if (element) {
    const enter = element.requestFullscreen || element.webkitRequestFullscreen;
    if (enter) request = enter.call(element);
  }

  // The standard API returns a promise that rejects when the browser refuses
  if (request && typeof request.catch === 'function') {
    request.catch((error) => logger.warn('studio', 'fullscreen', error));
  }
};

export {
  formatTime,
  getFullscreenElement,
  isFullscreenSupported,
  seekTo,
  toggleFullscreen,
};
