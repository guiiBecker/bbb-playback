import React from 'react';

// Material Design icons (Apache License 2.0), 24x24 viewBox
const PATHS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
};

const Icon = ({ name, size = 24 }) => {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      aria-hidden="true"
      className="studio-icon"
      focusable="false"
      // Inline, so the presentation's global `svg` rule cannot resize it
      style={{ height: size, width: size }}
      viewBox="0 0 24 24"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
};

export default Icon;
