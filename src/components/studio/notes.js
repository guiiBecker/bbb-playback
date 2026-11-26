import React, { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { defineMessages, useIntl } from 'react-intl';
import { buildFileURL } from 'utils/data';
import storage from 'utils/data/storage';
import notesToMarkdown from './notes-markdown';

const intlMessages = defineMessages({
  aria: { id: 'studio.notes.aria', defaultMessage: 'Shared notes' },
  empty: { id: 'studio.notes.empty', defaultMessage: "We didn't find shared notes in this recording." },
  hint: { id: 'studio.notes.hint', defaultMessage: 'As they were when the meeting ended' },
  markdown: { id: 'studio.notes.download.markdown', defaultMessage: 'Download the notes as Markdown' },
  pdf: { id: 'studio.notes.download.pdf', defaultMessage: 'Download the notes as PDF' },
  exportMarkdown: { id: 'studio.notes.export.markdown', defaultMessage: 'Export MD' },
  exportPdf: { id: 'studio.notes.export.pdf', defaultMessage: 'Export PDF' },
});

// The recording's name as a file name: "<name> - notes.<extension>"
const notesFileName = (extension) => {
  const name = (storage.metadata.name || 'recording').replace(/[^\w\- ]+/g, '').trim() || 'recording';

  return `${name} - notes.${extension}`;
};

// Whether the recording has its notes as a PDF (notes.pdf, BigBlueButton's own
// export of the pad). Not a page: a server's fallback for unknown paths says
// 200 too
const usePdf = () => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const src = buildFileURL('notes.pdf');
    fetch(src, { method: 'HEAD' })
      .then((response) => {
        const type = (response.headers.get('content-type') || '').toLowerCase();
        if (!cancelled && response.ok && type.includes('pdf')) setUrl(src);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  return url;
};

// The notes' two downloads: Markdown, converted here from the HTML export, and
// the PDF BigBlueButton exported, when the recording has it
const NotesFooter = ({ html }) => {
  const intl = useIntl();
  const pdf = usePdf();

  const downloadMarkdown = () => {
    const blob = new Blob([notesToMarkdown(html)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = notesFileName('md');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="studio-notes-footer">
      <button
        aria-label={intl.formatMessage(intlMessages.markdown)}
        className="studio-notes-download"
        onClick={downloadMarkdown}
        title={intl.formatMessage(intlMessages.markdown)}
        type="button"
      >
        <span>{intl.formatMessage(intlMessages.exportMarkdown)}</span>
      </button>
      {pdf ? (
        <a
          aria-label={intl.formatMessage(intlMessages.pdf)}
          className="studio-notes-download"
          download={notesFileName('pdf')}
          href={pdf}
          title={intl.formatMessage(intlMessages.pdf)}
        >
          <span>{intl.formatMessage(intlMessages.exportPdf)}</span>
        </a>
      ) : null}
    </div>
  );
};

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
    <>
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
      <NotesFooter html={html} />
    </>
  );
};

export default Notes;
