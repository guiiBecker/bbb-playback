import React, { useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import storage from 'utils/data/storage';
import Chat from './chat';
import Notes from './notes';
import Transcript from './transcript';

const TABS = ['transcription', 'chat', 'notes', 'chapters', 'questions'];

const intlMessages = defineMessages({
  transcription: { id: 'studio.tab.transcription', defaultMessage: 'Transcription' },
  chat: { id: 'studio.tab.chat', defaultMessage: 'Chat' },
  notes: { id: 'studio.tab.notes', defaultMessage: 'Notes' },
  chapters: { id: 'studio.tab.chapters', defaultMessage: 'Chapters' },
  questions: { id: 'studio.tab.questions', defaultMessage: 'Questions' },
  tabs: { id: 'studio.tabs.aria', defaultMessage: 'Recording content' },
});

// Opens on the transcription, or on the chat when only the chat has content
const initialTab = (captions) => {
  if (!captions.length && storage.chat && storage.chat.length) return 'chat';

  return TABS[0];
};

// Header, tabs, the selected tab's content and a footer for actions.
// Transcription, chat and notes are in place; the other tabs and the footer actions
// come in later steps
const Panel = ({ captions, locale, setLocale, time, transcript }) => {
  const intl = useIntl();
  const [tab, setTab] = useState(() => initialTab(captions));
  const { name, start } = storage.metadata;

  return (
    <aside className="studio-panel">
      <header className="studio-panel-header">
        <span className="studio-logo" aria-hidden="true" />
        <h1 className="studio-room">{name}</h1>
        <span className="studio-date">
          {intl.formatDate(new Date(start), { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
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
      </div>

      <footer className="studio-panel-footer" />
    </aside>
  );
};

export default Panel;
