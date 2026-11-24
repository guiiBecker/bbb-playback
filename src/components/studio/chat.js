import React, { useCallback, useMemo } from 'react';
import cx from 'classnames';
import DOMPurify from 'dompurify';
import { defineMessages, useIntl } from 'react-intl';
import Avatar from 'components/utils/avatar';
import { getCurrentDataIndex } from 'utils/data';
import storage from 'utils/data/storage';
import { useFollow } from './follow';
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
  const { listProps, reveal } = useFollow(currentIndex >= 0 ? messages[currentIndex].id : null);

  const onReply = useCallback((id) => {
    const node = reveal(id);
    if (!node) return;

    node.classList.add('highlight');
    setTimeout(() => node.classList.remove('highlight'), 1200);
  }, [reveal]);

  if (!messages.length) {
    return <p className="studio-empty">{intl.formatMessage(intlMessages.empty)}</p>;
  }

  return (
    <ul
      aria-label={intl.formatMessage(intlMessages.aria)}
      className="studio-chat studio-list"
      {...listProps}
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
