import React, { useEffect, useMemo, useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import storage from 'utils/data/storage';
import Icon from './icon';
import usePublishedJson from './published';

// The recording's master video: the server's "video" recording format, in the
// playback's layout (studio-1080 preset: the presentation or screen sharing on
// the left, the webcams in a column on the right), at /playback/video/<id>/.
// An MP4 with that preset, but any file of the format is taken (FORMATS).
// When it is there the stage plays it and the download button offers the very
// same file. layout.json, next to it, says where each webcam tile sits in the
// video and whose it is, and talking.json (the presentation format's, as
// mconf-live publishes it) who talks when, so the names and who is talking
// are drawn over it,
// and where the presentation is, so the webcams can be hidden by showing only
// that part of the video (they stay in the downloaded file).

const intlMessages = defineMessages({
  download: { id: 'studio.download.video', defaultMessage: 'Download the video' },
});

const base = () => `/playback/video/${storage.metadata.id}`;

// The video format names its files video-<n>.<extension>: <n> is the place of
// the format in the preset's list (video.yml), the extension is the preset's.
// BigBlueButton's own presets write video-0.m4v, with the VP9 alternative a
// .webm; the studio preset video-0.mp4. In the order they are tried and
// offered to the player; `type` is what the player is told, as the video
// format's own page does (video/mp4 for .m4v)
const FORMATS = [
  { extension: 'mp4', type: 'video/mp4' },
  { extension: 'm4v', type: 'video/mp4' },
  { extension: 'webm', type: 'video/webm' },
];

// A preset has one format, or two (MP4 and WebM)
const MAX_FORMATS = 2;

// Whether the server has the file. Not a page: a server that answers unknown
// paths with one (the dev server, a single page app's fallback) says 200 too.
// The type is not required to be a video's: servers name .m4v differently
// (video/x-m4v), or not at all
const exists = async (src) => {
  try {
    const response = await fetch(src, { method: 'HEAD' });
    const answered = (response.headers.get('content-type') || '').toLowerCase();

    return response.ok && !answered.startsWith('text/');
  } catch (error) {
    return false;
  }
};

// The master video's files under `folder`, [{ src, type }]: the first format
// in whichever extension it has, then a second one if the preset has it, for
// browsers that do not play the first. Empty when there is no master video
const findMasterSources = async (folder) => {
  const sources = [];

  for (let n = 0; n < MAX_FORMATS; n += 1) {
    // One format at a time: without the first there is no second to look for
    // eslint-disable-next-line no-await-in-loop
    const found = await Promise.all(FORMATS.map(async ({ extension, type }) => {
      const src = `${folder}/video-${n}.${extension}`;

      return (await exists(src)) ? { src, type } : null;
    }));
    const files = found.filter(Boolean);
    if (!files.length) break;

    sources.push(...files);
  }

  return sources;
};

// { status: 'checking' | 'found' | 'none', sources, src, type, layout }:
// `sources` for the player, `src` and `type` the first of them (the download)
const useMasterVideo = () => {
  const [master, setMaster] = useState({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    const find = async () => {
      const sources = await findMasterSources(base());
      if (!sources.length) return { status: 'none' };

      let layout = null;
      try {
        const response = await fetch(`${base()}/layout.json`, { cache: 'no-store' });
        if (response.ok) layout = await response.json();
      } catch (error) {
        // no overlays: the video still plays
      }
      return {
        layout, sources, src: sources[0].src, status: 'found', type: sources[0].type,
      };
    };
    find().then((result) => { if (!cancelled) setMaster(result); });

    return () => { cancelled = true; };
  }, []);

  return master;
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

// Where the video goes inside its element: the whole frame (object-fit
// contain), or with `crop` ({x, y, width, height} in video pixels) only that
// part of it, as large as fits; the element clips the rest. { left, top,
// width, height } of the whole video in CSS pixels, and its scale
const useMasterFrame = (element, width, height, crop) => {
  const [box, setBox] = useState(null);
  const area = crop || { height, width, x: 0, y: 0 };

  useEffect(() => {
    const node = element.current;
    if (!node || !width || !height) return undefined;

    const update = () => {
      const { clientWidth: w, clientHeight: h } = node;
      const scale = Math.min(w / area.width, h / area.height);
      setBox({
        height: height * scale,
        left: (w - area.width * scale) / 2 - area.x * scale,
        scale,
        top: (h - area.height * scale) / 2 - area.y * scale,
        width: width * scale,
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    update();

    return () => observer.disconnect();
  }, [element, width, height, area.x, area.y, area.width, area.height]);

  return box;
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
const DownloadButton = ({ master }) => {
  const intl = useIntl();
  const [drops, setDrops] = useState(0);
  if (master.status !== 'found') return null;

  const label = intl.formatMessage(intlMessages.download);

  return (
    <a
      aria-label={label}
      className="studio-download"
      download={fileName(master.src)}
      href={master.src}
      onClick={() => setDrops((count) => count + 1)}
      title={label}
    >
      {/* A new element for each click, so the drop plays again */}
      <DownloadIcon dropping={drops > 0} key={drops} />
    </a>
  );
};

export {
  DownloadButton,
  MASTER_CLIP_PATH,
  MasterClip,
  MasterOverlay,
  findMasterSources,
  masterAreas,
  useMasterFrame,
  useMasterVideo,
};
