import React, { useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import storage from 'utils/data/storage';

const TABS = ['transcription', 'chat', 'chapters', 'questions'];

const intlMessages = defineMessages({
  transcription: { id: 'studio.tab.transcription', defaultMessage: 'Transcription' },
  chat: { id: 'studio.tab.chat', defaultMessage: 'Chat' },
  chapters: { id: 'studio.tab.chapters', defaultMessage: 'Chapters' },
  questions: { id: 'studio.tab.questions', defaultMessage: 'Questions' },
  tabs: { id: 'studio.tabs.aria', defaultMessage: 'Recording content' },
});

// Header, tabs, the selected tab's content and a footer for actions. The tab
// contents and the footer actions come in later steps
const Panel = () => {
  const intl = useIntl();
  const [tab, setTab] = useState(TABS[0]);
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

      <div className="studio-panel-body" data-tab={tab} role="tabpanel" />

      <footer className="studio-panel-footer" />
    </aside>
  );
};

export default Panel;
