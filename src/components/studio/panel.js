import React, { useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import storage from 'utils/data/storage';
import AppsPanel from './apps-panel';
import Attendees from './attendees';
import Chat from './chat';
import Notes from './notes';
import Transcript from './transcript';

// Plugins (questions and others) get their place in the apps tab (apps.js)
const TABS = ['transcription', 'chat', 'notes', 'chapters', 'apps'];

const intlMessages = defineMessages({
  minutes: { id: 'studio.info.minutes', defaultMessage: '{minutes} min' },
  transcription: { id: 'studio.tab.transcription', defaultMessage: 'Transcription' },
  chat: { id: 'studio.tab.chat', defaultMessage: 'Chat' },
  notes: { id: 'studio.tab.notes', defaultMessage: 'Notes' },
  chapters: { id: 'studio.tab.chapters', defaultMessage: 'Chapters' },
  apps: { id: 'studio.tab.apps', defaultMessage: 'Apps' },
  tabs: { id: 'studio.tabs.aria', defaultMessage: 'Recording content' },
});

// Opens on the transcription, or on the chat when only the chat has content
const initialTab = (captions) => {
  if (!captions.length && storage.chat && storage.chat.length) return 'chat';

  return TABS[0];
};

// Header with the recording (name, date and time, duration, participants),
// tabs, the selected tab's content and a footer for actions. Transcription,
// chat, notes and apps are in place; chapters and the footer actions come in
// later steps
const Panel = ({ captions, duration, locale, setLocale, time, transcript }) => {
  const intl = useIntl();
  const [tab, setTab] = useState(() => initialTab(captions));
  const { end, name, start } = storage.metadata;
  // The media's own duration; the recording's start/end until the media loads
  const length = duration || Math.max(0, (end - start) / 1000);

  return (
    <aside className="studio-panel">
      <header className="studio-panel-header">
        <h1 className="studio-room">{name}</h1>
        <p className="studio-date">
          <span>{intl.formatDate(new Date(start), { dateStyle: 'medium', timeStyle: 'short' })}</span>
          <span aria-hidden="true">·</span>
          <span>{intl.formatMessage(intlMessages.minutes, { minutes: Math.max(1, Math.round(length / 60)) })}</span>
        </p>
        <Attendees />
      </header>

      <div aria-label={intl.formatMessage(intlMessages.tabs)} className="studio-tabs" role="tablist">
        {TABS.map((value) => (
          <button
            aria-selected={tab === value}
            className={cx('studio-tab', { active: tab === value })}
            key={value}
            onClick={() => setTab(value)}
            role="tab"
            type="button"
          >
            {intl.formatMessage(intlMessages[value])}
          </button>
        ))}
      </div>

      <div className="studio-panel-body" data-tab={tab} role="tabpanel">
        {tab === 'transcription' ? (
          <Transcript
            captions={captions}
            cues={transcript.cues}
            locale={locale}
            setLocale={setLocale}
            status={transcript.status}
            time={time}
          />
        ) : null}
        {tab === 'chat' ? <Chat time={time} /> : null}
        {tab === 'notes' ? <Notes /> : null}
        {tab === 'apps' ? <AppsPanel time={time} /> : null}
      </div>

      <footer className="studio-panel-footer" />
    </aside>
  );
};

export default Panel;
