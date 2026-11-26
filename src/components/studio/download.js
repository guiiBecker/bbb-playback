import { useCallback, useState } from 'react';
import { buildFileURL } from 'utils/data';
import storage from 'utils/data/storage';
import logger from 'utils/logger';
import { embedInFile } from 'utils/mp4';
import player from 'utils/player';
import { chapterTitle, recordingChapters } from './chapters';
import { parseVtt } from './transcript';

// The download of the recording's video with its chapters and its captions
// in the file: a player such as VLC then lists the chapters and offers each
// captions language as a subtitle track to switch on. The browser does it,
// when the download is asked for (utils/mp4.js): the pictures and the sound
// stay as they are, only the file's index is written again. Nothing runs on
// the server and nothing is encoded.
//
// For that the browser has to have the whole file before it can hand it
// over, so the download shows its own progress and starts when it is done.
// Whatever goes wrong, the file is downloaded as it is.

// Above this the file is downloaded as it is: the browser would have to
// hold all of it
const MAX_SIZE = 2 * 1024 * 1024 * 1024;

// The video as a Blob. `onProgress` gets 0 to 1; resolves null for a file
// that is too large
const fetchVideo = (url, onProgress) => new Promise((resolve, reject) => {
  const request = new XMLHttpRequest();
  request.open('GET', url);
  request.responseType = 'blob';
  request.onprogress = (event) => {
    if (!event.lengthComputable) return;
    if (event.total > MAX_SIZE) {
      request.abort();
      resolve(null);
      return;
    }
    onProgress(event.loaded / event.total);
  };
  request.onload = () => (request.status >= 200 && request.status < 300
    ? resolve(request.response)
    : reject(new Error(`HTTP ${request.status}`)));
  request.onerror = () => reject(new Error('network'));
  request.send();
});

// Every captions language of the recording as a subtitle track:
// [{ locale, name, cues }]. A language that cannot be read is left out
const fetchSubtitles = () => Promise.all((storage.captions || []).map(({ locale, localeName }) => (
  fetch(buildFileURL(`caption_${locale}.vtt`))
    .then((response) => (response.ok ? response.text() : ''))
    .then((content) => ({ cues: parseVtt(content), locale, name: localeName || locale }))
    .catch(() => null)
))).then((tracks) => tracks.filter((track) => track && track.cues.length));

// The chapters of the Chapters tab, with the titles it shows
const chapters = (intl) => {
  const { end, start } = storage.metadata;
  const duration = (player.primary && player.primary.duration()) || Math.max(0, (end - start) / 1000);

  return recordingChapters(duration).map((chapter, index) => ({
    start: chapter.start,
    title: chapterTitle(chapter, index, intl),
  }));
};

// Whether the recording has anything to put into the file
const hasExtras = () => (storage.captions || []).length > 0 || (storage.thumbnails || []).length > 0;

const save = (href, name) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// The file to download: the video with the chapters and subtitles in it,
// the video as it is when there is nothing to add to it, or null when it was
// not fetched (too large)
const prepare = async (url, intl, onProgress) => {
  const [video, subtitles] = await Promise.all([fetchVideo(url, onProgress), fetchSubtitles()]);
  if (!video) return null;

  const parts = await embedInFile(video, { chapters: chapters(intl), subtitles });

  return parts ? new Blob(parts, { type: video.type || 'video/mp4' }) : video;
};

// The download button's behaviour. `progress` is null, or 0 to 1 while the
// file is prepared; `onClick` is the link's
const useDownload = (url, name, intl) => {
  const [progress, setProgress] = useState(null);

  const onClick = useCallback((event) => {
    // One at a time
    if (progress !== null) {
      event.preventDefault();
      return;
    }
    // Nothing to add: the link downloads the file itself
    if (!hasExtras()) return;

    event.preventDefault();
    setProgress(0);
    prepare(url, intl, setProgress)
      .then((file) => {
        if (!file) {
          save(url, name);
          return;
        }
        const href = URL.createObjectURL(file);
        save(href, name);
        // Once the browser has taken it over
        setTimeout(() => URL.revokeObjectURL(href), 60000);
      })
      .catch((error) => {
        logger.error('studio', 'download', error);
        save(url, name);
      })
      .finally(() => setProgress(null));
  }, [intl, name, progress, url]);

  return { onClick, progress };
};

export default useDownload;
