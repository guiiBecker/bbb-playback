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

// Everything with a time in the published recording: chat (slides_new.xml),
// slides and screen sharing (shapes.svg, deskshare.xml), polls (polls.json),
// external videos (external_videos.json), and raised hands and reactions
// (`timeline`: timeline.json, from the server's post_publish studio_data.rb).
// Of the chat only the moderators' messages: all of it would bury the
// timeline, and the chat tab lists the rest
const collectEvents = (duration, timeline) => {
  const events = [];
  // `name`: who did it, when the data says (raised hands, reactions)
  const add = (type, time, name = null) => {
    if (Number.isFinite(time) && time >= 0 && time <= duration) events.push({ name, time, type });
  };

  (storage.chat || [])
    .filter((message) => message.moderator)
    .forEach((message) => add('chat', message.timestamp));
  (storage.polls || []).forEach((poll) => add('poll', poll.timestamp));
  // A stop with no start (the recording began with the video already
  // stopped) publishes an entry with no URL: not a video
  (storage.videos || []).filter((video) => video.url).forEach((video) => add('video', video.timestamp));
  // Screen sharing: the presentation format's deskshare.xml, else where the
  // slides (slides.json) say the screen sharing was shown
  const shares = (storage.screenshare || []).length
    ? storage.screenshare
    : (storage.thumbnails || []).filter((thumbnail) => thumbnail.src === ID.SCREENSHARE);
  shares.forEach((share) => add('screenshare', share.timestamp));
  (Array.isArray(timeline) ? timeline : [])
    .filter((moment) => moment && (moment.type === 'hand' || moment.type === 'reaction'))
    .forEach((moment) => add(moment.type, moment.time, moment.name || null));

  // A slide change is a new image in shapes.svg; screen sharing shows up there
  // too, already counted above. The first image is the start, not a change
  let previous = null;
  (storage.thumbnails || []).forEach((thumbnail, index) => {
    const changed = thumbnail.src !== ID.SCREENSHARE && thumbnail.src !== previous;
    if (index > 0 && changed) add('slide', thumbnail.timestamp);
    previous = thumbnail.src;
  });

  return events.sort((a, b) => a.time - b.time);
};

// [{ time, position (0-1), type, counts: { chat: 3, … }, names: { hand: ['Ana'] },
// unnamed: { hand: 0 } }]: `names`, per type, who did it, each once; `unnamed`
// how many of them came without a name
const buildMarkers = (duration, timeline = null) => {
  if (!duration) return [];

  const markers = [];
  collectEvents(duration, timeline).forEach((event) => {
    const position = event.time / duration;
    const last = markers[markers.length - 1];

    let marker = last;
    if (last && position - last.position < MARKER_BUCKET) {
      last.counts[event.type] = (last.counts[event.type] || 0) + 1;
      if (TYPES.indexOf(event.type) < TYPES.indexOf(last.type)) last.type = event.type;
    } else {
      marker = {
        counts: { [event.type]: 1 }, names: {}, position, time: event.time, type: event.type, unnamed: {},
      };
      markers.push(marker);
    }
    if (event.name) {
      const names = marker.names[event.type] || [];
      if (!names.includes(event.name)) marker.names[event.type] = [...names, event.name];
    } else {
      marker.unnamed[event.type] = (marker.unnamed[event.type] || 0) + 1;
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
