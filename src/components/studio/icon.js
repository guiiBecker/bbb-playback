import React from 'react';

// 24x24 viewBox. Filled shapes: captions from Material Design icons (Apache
// License 2.0), play and pause drawn for the studio. Outlines in the style of
// the redesign: fullscreen and fullscreenExit from Lucide (ISC License)
const FILLED = {
  captions: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
  pause: 'M7 4.5h2.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zm7.5 0H17a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-2.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z',
  play: 'M8 5.4v13.2a1 1 0 0 0 1.52.85l10.6-6.6a1 1 0 0 0 0-1.7L9.52 4.55A1 1 0 0 0 8 5.4z',
};

const OUTLINED = {
  fullscreen: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  fullscreenExit: 'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3',
};

const Icon = ({ name, size = 24 }) => {
  const filled = FILLED[name];
  const outlined = OUTLINED[name];
  if (!filled && !outlined) return null;

  return (
    <svg
      aria-hidden="true"
      className="studio-icon"
      focusable="false"
      // Inline, so the presentation's global `svg` rule cannot resize it
      style={{ height: size, width: size }}
      viewBox="0 0 24 24"
    >
      {filled ? (
        <path d={filled} fill="currentColor" />
      ) : (
        <path
          d={outlined}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
  );
};

export default Icon;
