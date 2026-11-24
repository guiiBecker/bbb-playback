import React from 'react';

// Material Design icons (Apache License 2.0), 24x24 viewBox
const PATHS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  captions: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
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
