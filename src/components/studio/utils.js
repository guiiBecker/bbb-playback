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

export {
  formatTime,
  seekTo,
};
