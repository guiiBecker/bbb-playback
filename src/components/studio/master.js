import React, { useEffect, useMemo, useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import { buildFileURL } from 'utils/data';
import storage from 'utils/data/storage';
import Icon from './icon';
import usePublishedJson from './published';

// The recording's video: the server's "video" recording format, in the
// playback's layout (the presentation or screen sharing on the left, the
// webcams in a column on the right), at /playback/video/<id>/. It is the only
// video the player plays (utils/data/storage finds it, the M4V first, else
// the MP4) and the download button offers the very same file. layout.json,
// next to it, says where each webcam tile sits in the video and whose it is,
// and where the presentation is; talking.json says who talks when. With them
// the names and who is talking are drawn over the video, the presentation and
// the tiles get rounded corners, and the webcams can be hidden by showing only
// the presentation part of it (they stay in the downloaded file).

const intlMessages = defineMessages({
  download: { id: 'studio.download.video', defaultMessage: 'Download the video' },
});

// layout.json, or null while it loads or when it is not there (the video
// then plays without overlays)
const useMasterLayout = () => {
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(buildFileURL('layout.json'), { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.tiles) && data.people) setLayout(data);
      });

    return () => { cancelled = true; };
  }, []);

  return layout;
};

// talking.json: { "<user id>": { userName, events: [{ start, stop }] } } ->
// { "<user id>": [{ start, stop }] }
const useTalking = () => {
  const data = usePublishedJson('talking.json');

  return useMemo(() => {
    const talking = {};
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([user, entry]) => {
        if (entry && Array.isArray(entry.events)) talking[user] = entry.events;
      });
    }

    return talking;
  }, [data]);
};

const within = (spans, time) => (spans || []).some(({ start, stop }) => start <= time && time < stop);

// Where a video of `width` x `height` goes inside a box of `boxWidth` x
// `boxHeight`: the whole frame (object-fit contain), or with `crop` ({x, y,
// width, height} in video pixels) only that part of it, as large as fits and
// centred; the box clips the rest. { left, top, width, height } of the whole
// video in CSS pixels, and its scale
const fitFrame = (boxWidth, boxHeight, width, height, crop = null) => {
  const area = crop || { height, width, x: 0, y: 0 };
  const scale = Math.min(boxWidth / area.width, boxHeight / area.height);

  return {
    height: height * scale,
    left: (boxWidth - area.width * scale) / 2 - area.x * scale,
    scale,
    top: (boxHeight - area.height * scale) / 2 - area.y * scale,
    width: width * scale,
  };
};

// fitFrame for the element, again whenever it is resized
const useMasterFrame = (element, width, height, crop) => {
  const [box, setBox] = useState(null);
  // The crop's numbers, not the object: a new object each render must not
  // measure again
  const {
    height: areaHeight, width: areaWidth, x, y,
  } = crop || { height, width, x: 0, y: 0 };

  useEffect(() => {
    const node = element.current;
    if (!node || !width || !height) return undefined;

    const area = {
      height: areaHeight, width: areaWidth, x, y,
    };
    const update = () => setBox(fitFrame(node.clientWidth, node.clientHeight, width, height, area));
    const observer = new ResizeObserver(update);
    observer.observe(node);
    update();

    return () => observer.disconnect();
  }, [element, width, height, x, y, areaWidth, areaHeight]);

  return box;
};

// The video's own size in its pixels, once the browser knows it: what places
// the frame for a recording without layout.json, which has the size too
const useVideoSize = (element) => {
  const [size, setSize] = useState(null);

  useEffect(() => {
    const node = element.current;
    if (!node) return undefined;

    const update = () => {
      const video = node.querySelector('video');
      if (!video || !video.videoWidth || !video.videoHeight) return;

      setSize((previous) => (previous && previous.width === video.videoWidth && previous.height === video.videoHeight
        ? previous
        : { height: video.videoHeight, width: video.videoWidth }));
    };

    // Media events do not bubble, but reach the ancestors' capture listeners
    const events = ['loadedmetadata', 'resize'];
    events.forEach((event) => node.addEventListener(event, update, true));
    update();

    return () => events.forEach((event) => node.removeEventListener(event, update, true));
  }, [element]);

  return size;
};

// Where the captions go, in CSS pixels inside the whole video (`frame`):
// over the presentation's part of it, at its bottom, as they were on the
// slide before the video had it all. Without layout.json nothing says where
// the presentation is: null, and they keep to the bottom of the video.
// { bottom: from the video's bottom edge, center: from its left edge, width }
const captionsPlace = (frame, layout) => {
  const content = layout && layout.content;
  if (!frame || !content || !layout.height) return null;

  return {
    bottom: (layout.height - content.y - content.height) * frame.scale,
    center: (content.x + content.width / 2) * frame.scale,
    width: content.width * frame.scale,
  };
};

const onScreen = (tile, time) => tile.start <= time && time < tile.end;

// Corner radii in video pixels, so they grow and shrink with the video. The
// presentation's is the slide's of the stage without a master video (1.2% of
// its width, index.scss), a tile's the webcams' there (8px), capped
const CONTENT_RADIUS = 0.012;
const TILE_RADIUS = 0.05;
const TILE_RADIUS_MAX = 16;

// The parts of the video with a picture in them at `time`: the presentation
// and the webcam tiles on screen, or with `cropped` (webcams hidden) only the
// presentation. [{ x, y, width, height, radius }] in video pixels; empty when
// layout.json does not say
const masterAreas = (layout, time, cropped) => {
  if (!layout || !layout.width || !layout.height) return [];

  const areas = [];
  if (layout.content) {
    areas.push({ ...layout.content, radius: layout.content.width * CONTENT_RADIUS });
  }
  if (!cropped) {
    (layout.tiles || []).filter((tile) => onScreen(tile, time)).forEach((tile) => areas.push({
      height: tile.height,
      radius: Math.min(TILE_RADIUS_MAX, tile.width * TILE_RADIUS),
      width: tile.width,
      x: tile.x,
      y: tile.y,
    }));
  }

  return areas;
};

// One master video on the page
const CLIP_ID = 'studio-master-clip';
const MASTER_CLIP_PATH = `url(#${CLIP_ID})`;

// Rounded corners for the presentation and the webcam tiles, which are square
// in the video: the video is clipped to `areas` (MASTER_CLIP_PATH on its
// element). In fractions of the video (objectBoundingBox), so the clip follows
// the video's size by itself, also while it moves
const MasterClip = ({ areas, layout }) => (
  // Its size inline: the presentation's global `svg` rule would stretch it
  <svg aria-hidden="true" focusable="false" style={{ height: 0, position: 'absolute', width: 0 }}>
    <defs>
      <clipPath clipPathUnits="objectBoundingBox" id={CLIP_ID}>
        {areas.map((area) => (
          <rect
            height={area.height / layout.height}
            key={`${area.x}-${area.y}-${area.width}-${area.height}`}
            rx={area.radius / layout.width}
            ry={area.radius / layout.height}
            width={area.width / layout.width}
            x={area.x / layout.width}
            y={area.y / layout.height}
          />
        ))}
      </clipPath>
    </defs>
  </svg>
);

// Names and who is talking, over the webcam tiles of the video; `scale` is the
// video's, the overlay covers the whole video
const MasterOverlay = ({ layout, scale, time }) => {
  const talkingByUser = useTalking();
  const tiles = layout.tiles.filter((tile) => onScreen(tile, time));

  return (
    // Visual only: the names are in the participants list too
    <div aria-hidden="true" className="studio-master-overlay">
      {tiles.map((tile) => {
        const person = layout.people[tile.user] || { name: '' };
        const talking = within(talkingByUser[tile.user], time);
        // The video inside the tile, without the tile's border
        const style = {
          height: (tile.height - 2 * tile.border) * scale,
          left: (tile.x + tile.border) * scale,
          top: (tile.y + tile.border) * scale,
          width: (tile.width - 2 * tile.border) * scale,
        };

        return (
          <div
            className={cx('studio-master-tile', { talking })}
            key={`${tile.start}-${tile.user}-${tile.x}-${tile.y}`}
            style={style}
          >
            {person.name ? <span className="studio-master-name">{person.name}</span> : null}
            {talking ? (
              <span className="studio-master-mic"><Icon name="mic" size={12} /></span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const fileName = (src) => {
  const name = (storage.metadata.name || 'recording').replace(/[^\w\- ]+/g, '').trim() || 'recording';

  return `${name}.${src.split('.').pop()}`;
};

// Lucide's download (ISC License). Its parts apart, so the arrow can move
// into the tray
const DownloadIcon = ({ dropping }) => (
  <svg
    aria-hidden="true"
    className={cx('studio-download-icon', { dropping })}
    focusable="false"
    // Inline, so the presentation's global `svg` rule cannot resize it
    style={{ height: 18, width: 18 }}
    viewBox="0 0 24 24"
  >
    <path className="studio-download-tray" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path className="studio-download-arrow" d="M7 10l5 5 5-5M12 15V3" />
  </svg>
);

// The same file the stage plays. The arrow nods on hover; on a click it
// drops into the tray and a new one follows, to show the download started
const DownloadButton = () => {
  const intl = useIntl();
  const [drops, setDrops] = useState(0);
  const { url } = storage.media;

  const label = intl.formatMessage(intlMessages.download);

  return (
    <a
      aria-label={label}
      className="studio-download"
      download={fileName(url)}
      href={url}
      onClick={() => setDrops((count) => count + 1)}
      title={label}
    >
      {/* A new element for each click, so the drop plays again */}
      <DownloadIcon dropping={drops > 0} key={drops} />
    </a>
  );
};

export {
  captionsPlace,
  DownloadButton,
  fitFrame,
  MASTER_CLIP_PATH,
  MasterClip,
  MasterOverlay,
  masterAreas,
  useMasterFrame,
  useMasterLayout,
  useVideoSize,
};
