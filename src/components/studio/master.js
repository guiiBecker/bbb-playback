import React, { useEffect, useMemo, useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import storage from 'utils/data/storage';
import Icon from './icon';
import usePublishedJson from './published';

// The recording's master MP4: the server's "video" recording format, in the
// playback's layout (studio-1080 preset: the presentation or screen sharing on
// the left, the webcams in a column on the right), at /playback/video/<id>/.
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

// { status: 'checking' | 'found' | 'none', src, type, layout }
const useMasterVideo = () => {
  const [master, setMaster] = useState({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    const find = async () => {
      const src = `${base()}/video-0.mp4`;
      try {
        const response = await fetch(src, { method: 'HEAD' });
        // Only a video counts: a server that answers unknown paths with a
        // page (the dev server, a single page app's fallback) says 200 too
        const answered = (response.headers.get('content-type') || '').toLowerCase();
        if (!response.ok || !answered.startsWith('video/')) return { status: 'none' };
      } catch (error) {
        return { status: 'none' };
      }
      let layout = null;
      try {
        const response = await fetch(`${base()}/layout.json`, { cache: 'no-store' });
        if (response.ok) layout = await response.json();
      } catch (error) {
        // no overlays: the video still plays
      }
      return {
        layout, src, status: 'found', type: 'video/mp4',
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

// Names and who is talking, over the webcam tiles of the video; `scale` is the
// video's, the overlay covers the whole video
const MasterOverlay = ({ layout, scale, time }) => {
  const talkingByUser = useTalking();
  const tiles = layout.tiles.filter((tile) => tile.start <= time && time < tile.end);

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

// The same file the stage plays
const DownloadButton = ({ master }) => {
  const intl = useIntl();
  if (master.status !== 'found') return null;

  const label = intl.formatMessage(intlMessages.download);

  return (
    <a
      aria-label={label}
      className="studio-download"
      download={fileName(master.src)}
      href={master.src}
      title={label}
    >
      <Icon name="download" size={18} />
    </a>
  );
};

export {
  DownloadButton,
  MasterOverlay,
  useMasterFrame,
  useMasterVideo,
};
