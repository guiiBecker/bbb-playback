import React, { useSyncExternalStore } from 'react';
import { defineMessages } from 'react-intl';
import storage from 'utils/data/storage';
import Polls from './polls';

// The apps of the panel's Apps tab, like the BigBlueButton client's apps
// gallery. Built-in apps register below; plugins are to register theirs the
// same way (the client's counterpart is pluginApi.setAppsGalleryItems).
//
// An app: {
//   id: unique, also the key of the gallery tile,
//   name: a string, or a react-intl message for built-in apps,
//   icon: an icon name from icon.js,
//   render: ({ time }) => its content in the panel, `time` the playback's,
//   available: () => whether this recording has anything for it (optional),
// }

const apps = new Map();
const listeners = new Set();
let snapshot = [];

const notify = () => {
  snapshot = [...apps.values()];
  listeners.forEach((listener) => listener());
};

const unregisterApp = (id) => {
  if (apps.delete(id)) notify();
};

// Adds or replaces an app; returns the function that removes it again
const registerApp = (app) => {
  apps.set(app.id, app);
  notify();

  return () => unregisterApp(app.id);
};

const subscribe = (listener) => {
  listeners.add(listener);

  return () => listeners.delete(listener);
};

// The registered apps that have something for this recording
const useApps = () => useSyncExternalStore(subscribe, () => snapshot)
  .filter((app) => !app.available || app.available());

const intlMessages = defineMessages({
  polls: { id: 'studio.apps.polls', defaultMessage: 'Polls' },
});

// Built into BigBlueButton, so built in here
registerApp({
  available: () => (storage.polls || []).length > 0,
  icon: 'poll',
  id: 'polls',
  name: intlMessages.polls,
  render: ({ time }) => <Polls time={time} />,
});

export {
  registerApp,
  unregisterApp,
  useApps,
};
