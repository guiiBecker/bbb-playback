import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { buildFileURL } from 'utils/data';
import storage from 'utils/data/storage';

// Avatars shown before the "+N" count
const MAX_AVATARS = 5;

const intlMessages = defineMessages({
  more: { id: 'studio.attendees.more', defaultMessage: '+{count} attended' },
  total: { id: 'studio.attendees.total', defaultMessage: '{count, plural, one {# participant} other {# participants}}' },
  open: { id: 'studio.attendees.open', defaultMessage: 'See all participants' },
  title: { id: 'studio.attendees.title', defaultMessage: 'Participants ({count})' },
  close: { id: 'studio.attendees.close', defaultMessage: 'Close' },
  moderator: { id: 'studio.attendees.moderator', defaultMessage: 'Moderator' },
  unnamed: {
    id: 'studio.attendees.unnamed',
    defaultMessage: '{count, plural, one {# more participant has} other {# more participants have}} no name in this recording.',
  },
});

// "Marina Duarte" -> "MD", "Atila" -> "AT"
const getInitials = (name) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// Who wrote in the chat, in the order they first did
const chatWriters = () => {
  const names = [];
  (storage.chat || []).forEach(({ name }) => {
    if (name && !names.includes(name)) names.push(name);
  });

  return names.map((name) => ({ name }));
};

// participants.json, written by the server's post_publish participants.rb,
// has everyone; without it, the names the recording has are the chat's
// writers, and metadata.xml gives how many took part
const useAttendees = () => {
  const [published, setPublished] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(buildFileURL('participants.json'))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setPublished(data.filter((p) => p && p.name));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    const people = published && published.length ? published : chatWriters();

    return { people, total: Math.max(storage.metadata.participants || 0, people.length) };
  }, [published]);
};

const Avatar = ({ name }) => (
  <span aria-hidden="true" className="studio-avatar">{getInitials(name)}</span>
);

// The full list, opened from the attendees row. Closes on Escape, on a click
// outside or on its button, and gives the focus back to the row
const ParticipantsDialog = ({ intl, onClose, people, total }) => {
  const dialog = useRef(null);
  const unnamed = total - people.length;

  // Once, on opening: the panel re-renders while the recording plays
  useEffect(() => {
    dialog.current.focus();
  }, []);

  useEffect(() => {
    const node = dialog.current;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event) => {
      if (!node.contains(event.target) && !event.target.closest('.studio-attendees-trigger')) onClose();
    };

    // Capture: the whiteboard stops the pointer events on the slide
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose]);

  const title = intl.formatMessage(intlMessages.title, { count: total });

  return (
    <div aria-label={title} className="studio-participants" ref={dialog} role="dialog" tabIndex={-1}>
      <div className="studio-participants-header">
        <h2>{title}</h2>
        <button
          aria-label={intl.formatMessage(intlMessages.close)}
          className="studio-participants-close"
          onClick={onClose}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <ul className="studio-participants-list">
        {people.map((person, index) => (
          // Two people can share a name: the index keeps them apart
          // eslint-disable-next-line react/no-array-index-key
          <li key={`${person.name}-${index}`}>
            <Avatar name={person.name} />
            <span className="studio-participants-name">{person.name}</span>
            {person.role === 'MODERATOR' ? (
              <span className="studio-participants-role">{intl.formatMessage(intlMessages.moderator)}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {unnamed > 0 ? (
        <p className="studio-participants-note">{intl.formatMessage(intlMessages.unnamed, { count: unnamed })}</p>
      ) : null}
    </div>
  );
};

// Who took part: avatars and a count; a click opens the full list
const Attendees = () => {
  const intl = useIntl();
  const { people, total } = useAttendees();
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const close = useCallback(() => {
    setOpen(false);
    if (trigger.current) trigger.current.focus();
  }, []);

  if (!total) return null;

  if (!people.length) {
    return <p className="studio-attendees">{intl.formatMessage(intlMessages.total, { count: total })}</p>;
  }

  const shown = people.slice(0, MAX_AVATARS);
  const more = total - shown.length;

  return (
    <div className="studio-attendees">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${intl.formatMessage(intlMessages.open)}: ${intl.formatMessage(intlMessages.total, { count: total })}`}
        className="studio-attendees-trigger"
        onClick={() => setOpen((value) => !value)}
        ref={trigger}
        title={shown.map((person) => person.name).join(', ')}
        type="button"
      >
        <span className="studio-avatars">
          {shown.map((person, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <Avatar key={`${person.name}-${index}`} name={person.name} />
          ))}
        </span>
        {more > 0 ? <span>{intl.formatMessage(intlMessages.more, { count: more })}</span> : null}
      </button>
      {open ? <ParticipantsDialog intl={intl} onClose={close} people={people} total={total} /> : null}
    </div>
  );
};

// No props: the panel re-renders on every time update, this does not need to
export default React.memo(Attendees);
