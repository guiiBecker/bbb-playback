import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { defineMessages, useIntl } from 'react-intl';
import storage from 'utils/data/storage';

const intlMessages = defineMessages({
  aria: { id: 'studio.notes.aria', defaultMessage: 'Shared notes' },
  empty: { id: 'studio.notes.empty', defaultMessage: 'No shared notes in this recording.' },
  hint: { id: 'studio.notes.hint', defaultMessage: 'As they were when the meeting ended' },
});

// The shared notes as they were when the meeting ended. The archive step
// exports the pad once (notes.html), so there is no edit history to follow
// along the playback
const Notes = () => {
  const intl = useIntl();
  const { hasText, html } = useMemo(() => {
    const element = document.createElement('div');
    element.innerHTML = DOMPurify.sanitize(storage.notes || '');
    // Links open in a new tab, so following one does not leave the recording
    element.querySelectorAll('a[href]').forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });

    return { hasText: element.textContent.trim().length > 0, html: element.innerHTML };
  }, []);

  if (!hasText) {
    return <p className="studio-empty">{intl.formatMessage(intlMessages.empty)}</p>;
  }

  return (
    <div
      aria-label={intl.formatMessage(intlMessages.aria)}
      className="studio-notes"
      role="document"
      // The text can be longer than the panel: scrollable with the keyboard
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      <p className="studio-notes-hint">{intl.formatMessage(intlMessages.hint)}</p>
      {/* eslint-disable-next-line react/no-danger */}
      <div className="studio-notes-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

export default Notes;
