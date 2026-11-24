import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import cx from 'classnames';
import DOMPurify from 'dompurify';
import { defineMessages, useIntl } from 'react-intl';
import Avatar from 'components/utils/avatar';
import { getCurrentDataIndex } from 'utils/data';
import storage from 'utils/data/storage';
import player from 'utils/player';
import { formatTime, seekTo } from './utils';

const intlMessages = defineMessages({
  aria: { id: 'studio.chat.aria', defaultMessage: 'Chat messages' },
  empty: { id: 'studio.chat.empty', defaultMessage: 'No chat messages in this recording.' },
  edited: { id: 'studio.chat.edited', defaultMessage: '(edited)' },
  seek: { id: 'studio.chat.seek', defaultMessage: 'Go to {time}' },
  reply: { id: 'studio.chat.reply', defaultMessage: 'Show the replied message' },
});

const sanitize = (html) => ({ __html: DOMPurify.sanitize(html || '') });

const byCount = (a, b) => Number(b.count) - Number(a.count);

// How long the list stays where the user scrolled it before following again
const READING_PAUSE = 5000;

// Keys that scroll the list when it has the focus
const SCROLL_KEYS = ['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '];

// Puts the node a third of the way down the list, or at the top when it is too
// tall for that. Moves the list only: scrollIntoView would also scroll the page
// on narrow screens, where the panel sits below the player
const scrollWithin = (container, node) => {
  if (!container || !node) return;

  // The list is the nodes' offset parent (position: relative)
  const room = container.clientHeight / 3;
  const top = node.offsetTop - (node.offsetHeight > 2 * room ? 0 : room);
  const target = Math.max(0, Math.min(top, container.scrollHeight - container.clientHeight));
  if (Math.abs(container.scrollTop - target) > 1) {
    container.scrollTo({ behavior: 'smooth', top: target });
  }
};

const Message = React.memo(({ current, intl, item, onReply, past, repliedTo }) => {
  const time = formatTime(item.timestamp);
  const reactions = [...(item.reactions || [])].sort(byCount);

  return (
    <li
      className={cx('studio-message', { current, future: !past })}
      data-id={item.id}
    >
      <Avatar
        circle={!item.moderator}
        initials={item.initials}
        name={item.name}
      />
      <div className="studio-message-body">
        <div className="studio-message-header">
          <span className="studio-message-name">{item.name}</span>
          <button
            aria-label={intl.formatMessage(intlMessages.seek, { time })}
            className="studio-message-time"
            onClick={() => seekTo(item.timestamp)}
            type="button"
          >
            {time}
          </button>
          {item.lastEditedTimestamp ? (
            <span className="studio-message-edited">{intl.formatMessage(intlMessages.edited)}</span>
          ) : null}
        </div>
        {repliedTo ? (
          <button
            aria-label={intl.formatMessage(intlMessages.reply)}
            className="studio-message-reply"
            onClick={() => onReply(repliedTo.id)}
            type="button"
          >
            <span className="studio-message-reply-name">{repliedTo.name}</span>
            <span className="studio-message-reply-text" dangerouslySetInnerHTML={sanitize(repliedTo.message)} />
          </button>
        ) : null}
        <div
          className={cx('studio-message-text', { emphasized: item.emphasized })}
          dangerouslySetInnerHTML={sanitize(item.message)}
        />
        {reactions.length ? (
          <div className="studio-message-reactions">
            {reactions.map((reaction) => (
              <span className="studio-message-reaction" key={reaction.emoji}>
                <span aria-hidden="true">{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
});

// The recording's public chat. Every message is listed so it can be used to
// navigate; the ones still ahead of the playback are dimmed and the list
// follows the latest one, pausing for a while when the user scrolls it. Takes
// the player's time, so the state is right even when the tab opens while paused
const Chat = ({ time }) => {
  const intl = useIntl();
  const messages = useMemo(() => storage.chat || [], []);
  const byId = useMemo(() => new Map(messages.map((item) => [item.id, item])), [messages]);
  const currentIndex = getCurrentDataIndex(messages, time);
  const list = useRef(null);
  // When the user last scrolled the list themselves. Only user input counts:
  // the list's own smooth scrolling fires scroll events too
  const readAt = useRef(0);
  const onRead = useCallback(() => { readAt.current = Date.now(); }, []);
  const onKeyDown = useCallback((event) => {
    if (SCROLL_KEYS.includes(event.key) && event.target === event.currentTarget) onRead();
  }, [onRead]);
  // Grabbing the scrollbar: the press lands on the list itself, not a message
  const onPointerDown = useCallback((event) => {
    if (event.target === event.currentTarget) onRead();
  }, [onRead]);

  const nodeOf = useCallback((id) => (list.current
    ? list.current.querySelector(`[data-id="${CSS.escape(id)}"]`)
    : null), []);

  useEffect(() => {
    if (currentIndex < 0 || Date.now() - readAt.current < READING_PAUSE) return;
    scrollWithin(list.current, nodeOf(messages[currentIndex].id));
  }, [currentIndex, messages, nodeOf]);

  // Seeking (a message's time, the timeline) is a request to follow again
  useEffect(() => {
    const p = player.primary;
    if (!p) return undefined;

    const follow = () => { readAt.current = 0; };
    p.on('seeking', follow);
    return () => { if (!p.isDisposed()) p.off('seeking', follow); };
  }, []);

  const onReply = useCallback((id) => {
    const node = nodeOf(id);
    if (!node) return;

    onRead();
    scrollWithin(list.current, node);
    node.classList.add('highlight');
    setTimeout(() => node.classList.remove('highlight'), 1200);
  }, [nodeOf, onRead]);

  if (!messages.length) {
    return <p className="studio-empty">{intl.formatMessage(intlMessages.empty)}</p>;
  }

  return (
    <ul
      aria-label={intl.formatMessage(intlMessages.aria)}
      className="studio-chat"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onTouchMove={onRead}
      onWheel={onRead}
      ref={list}
      tabIndex={0}
    >
      {messages.map((item, index) => (
        <Message
          current={index === currentIndex}
          intl={intl}
          item={item}
          key={item.id}
          onReply={onReply}
          past={index <= currentIndex}
          repliedTo={item.replyToMessageId ? byId.get(item.replyToMessageId) : null}
        />
      ))}
    </ul>
  );
};

export default Chat;
