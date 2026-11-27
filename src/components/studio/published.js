import { useEffect, useState } from 'react';
import { buildFileURL } from 'utils/data';

// Optional JSON files published next to the recording by the video format
// (layout.json) and the server's post_publish scripts (participants.json,
// talking.json, timeline.json): each one is fetched once and shared; null
// when it is not there or not valid
const cache = new Map();

const load = (file) => {
  if (!cache.has(file)) {
    cache.set(file, fetch(buildFileURL(file))
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null));
  }

  return cache.get(file);
};

const usePublishedJson = (file) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    load(file).then((value) => { if (!cancelled) setData(value); });

    return () => { cancelled = true; };
  }, [file]);

  return data;
};

export default usePublishedJson;
