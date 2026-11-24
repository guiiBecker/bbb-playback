import React, { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import storage from 'utils/data/storage';

const intlMessages = defineMessages({
  minutes: { id: 'studio.info.minutes', defaultMessage: '{minutes} min' },
  file: { id: 'studio.info.file', defaultMessage: 'Media file' },
});

const fileName = (url) => decodeURIComponent(url.split('?')[0].split('/').pop() || '');

// Size of the media file the player is playing, from a HEAD request
const useFileSize = (source) => {
  const [size, setSize] = useState(null);

  useEffect(() => {
    setSize(null);
    if (!source) return undefined;

    let cancelled = false;
    fetch(source, { method: 'HEAD' })
      .then((response) => {
        const length = parseInt(response.headers.get('content-length'), 10);
        if (!cancelled && response.ok && length > 0) setSize(length);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [source]);

  return size;
};

const formatSize = (intl, bytes) => {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return intl.formatNumber(value, {
    maximumFractionDigits: unit > 1 ? 1 : 0,
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
  });
};

// The recording (name, date, duration) and the media file being played
// (name, resolution, size). The participants row comes in a later step
const Info = ({ state }) => {
  const intl = useIntl();
  const { end, name, start } = storage.metadata;
  const { height, source, width } = state;
  // The media's own duration; the recording's start/end until the media loads
  const duration = state.duration || Math.max(0, (end - start) / 1000);
  const size = useFileSize(source);

  const file = [
    fileName(source),
    width && height ? `${width}×${height}` : null,
    size ? formatSize(intl, size) : null,
  ].filter(Boolean);

  return (
    <section className="studio-info">
      <h2 className="studio-info-title">{name}</h2>
      <p className="studio-info-meta">
        <span>{intl.formatDate(new Date(start), { dateStyle: 'medium', timeStyle: 'short' })}</span>
        <span aria-hidden="true">•</span>
        <span>{intl.formatMessage(intlMessages.minutes, { minutes: Math.max(1, Math.round(duration / 60)) })}</span>
      </p>
      {file.length ? (
        <p className="studio-info-meta studio-info-file">
          <span className="studio-info-label">{intl.formatMessage(intlMessages.file)}</span>
          {file.map((item, index) => (
            <React.Fragment key={item}>
              {index > 0 ? <span aria-hidden="true">•</span> : null}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </p>
      ) : null}
    </section>
  );
};

export default Info;
