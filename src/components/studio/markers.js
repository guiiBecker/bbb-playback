import { ID } from 'utils/constants';
import storage from 'utils/data/storage';

// Marker types, from the most to the least relevant: when markers merge, the
// most relevant type gives the icon
const TYPES = ['poll', 'video', 'screenshare', 'hand', 'chat', 'reaction', 'slide'];

// Markers closer than this (a fraction of the duration) merge into one, so a
// busy recording does not draw an unreadable row of icons
const MARKER_BUCKET = 0.03;

// Segment boundaries closer than this are dropped: a run of quick slide
// changes is one segment, not a row of slivers
const SEGMENT_MIN = 0.02;

// Everything with a time in the published recording: chat (video.xml),
// slides and screen sharing (slides.json), polls (polls.json), external
// videos (external_videos.json, not published with the video format), and
// raised hands and reactions (`timeline`: timeline.json, from the server's
// post_publish studio_data.rb).
// Of the chat only the moderators' messages: all of it would bury the
// timeline, and the chat tab lists the rest
const collectEvents = (duration, timeline) => {
  const events = [];
  const add = (type, time) => {
    if (Number.isFinite(time) && time >= 0 && time <= duration) events.push({ time, type });
  };

  (storage.chat || [])
    .filter((message) => message.moderator)
    .forEach((message) => add('chat', message.timestamp));
  (storage.polls || []).forEach((poll) => add('poll', poll.timestamp));
  // A stop with no start (the recording began with the video already
  // stopped) publishes an entry with no URL: not a video
  (storage.videos || []).filter((video) => video.url).forEach((video) => add('video', video.timestamp));
  (Array.isArray(timeline) ? timeline : [])
    .filter((moment) => moment && (moment.type === 'hand' || moment.type === 'reaction'))
    .forEach((moment) => add(moment.type, moment.time));

  // What the presentation area showed, in order: a screen sharing when it
  // begins, a slide when it comes up. The first slide is the start, not a
  // change
  let previous = null;
  (storage.slides || []).forEach((slide, index) => {
    if (slide.src === ID.SCREENSHARE) {
      if (previous !== ID.SCREENSHARE) add('screenshare', slide.timestamp);
    } else if (index > 0 && slide.src !== previous) {
      add('slide', slide.timestamp);
    }
    previous = slide.src;
  });

  return events.sort((a, b) => a.time - b.time);
};

// [{ time, position (0-1), type, counts: { chat: 3, … } }]
const buildMarkers = (duration, timeline = null) => {
  if (!duration) return [];

  const markers = [];
  collectEvents(duration, timeline).forEach((event) => {
    const position = event.time / duration;
    const last = markers[markers.length - 1];

    if (last && position - last.position < MARKER_BUCKET) {
      last.counts[event.type] = (last.counts[event.type] || 0) + 1;
      if (TYPES.indexOf(event.type) < TYPES.indexOf(last.type)) last.type = event.type;
    } else {
      markers.push({ counts: { [event.type]: 1 }, position, time: event.time, type: event.type });
    }
  });

  return markers;
};

// Positions (0-1) where the rail breaks: slide changes and screen sharing
const buildSegments = (duration) => {
  if (!duration) return [];

  const breaks = [];
  collectEvents(duration)
    .filter((event) => event.type === 'slide' || event.type === 'screenshare')
    .forEach((event) => {
      const position = event.time / duration;
      const last = breaks.length ? breaks[breaks.length - 1] : 0;
      if (position - last >= SEGMENT_MIN && 1 - position >= SEGMENT_MIN) breaks.push(position);
    });

  return breaks;
};

export {
  TYPES,
  buildMarkers,
  buildSegments,
};
