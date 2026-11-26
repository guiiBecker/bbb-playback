import React, { useEffect, useMemo, useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import { buildFileURL } from 'utils/data';
import storage from 'utils/data/storage';
import Icon from './icon';
import usePublishedJson from './published';

// The recording's MP4: the server's "video" recording format, in the
// playback's layout (the presentation or screen sharing on the left, the
// webcams in a column on the right), at /playback/video/<id>/. It is the only
// video the player plays (utils/data/storage checks it is there) and the
// download button offers the very same file. layout.json, next to it, says
// where each webcam tile sits in the video and whose it is, and where the
// presentation is; talking.json (next to the presentation format's files)
// says who talks when. With them the names and who is talking are drawn over
// the video, and the webcams can be hidden by showing only the presentation
// part of it (they stay in the downloaded file).

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
const DownloadButton = () => {
  const intl = useIntl();
  const { url } = storage.media;
  const label = intl.formatMessage(intlMessages.download);

  return (
    <a
      aria-label={label}
      className="studio-download"
      download={fileName(url)}
      href={url}
      title={label}
    >
      <Icon name="download" size={18} />
    </a>
  );
};

export {
  DownloadButton,
  fitFrame,
  MasterOverlay,
  useMasterFrame,
  useMasterLayout,
};
