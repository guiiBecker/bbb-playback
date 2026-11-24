import React, { useMemo } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import { getCurrentDataIndex, getPollLabel } from 'utils/data';
import storage from 'utils/data/storage';
import { useFollow } from './follow';
import { formatTime, seekTo } from './utils';

const intlMessages = defineMessages({
  aria: { id: 'studio.polls.aria', defaultMessage: 'Polls' },
  // The classic player's, translated in many languages already
  poll: { id: 'player.chat.message.poll.name', defaultMessage: 'Poll result' },
  quiz: { id: 'player.chat.message.poll.quiz', defaultMessage: 'Quiz result' },
  yes: { id: 'player.chat.message.poll.option.yes', defaultMessage: 'Yes' },
  no: { id: 'player.chat.message.poll.option.no', defaultMessage: 'No' },
  abstention: { id: 'player.chat.message.poll.option.abstention', defaultMessage: 'Abstention' },
  true: { id: 'player.chat.message.poll.option.true', defaultMessage: 'True' },
  false: { id: 'player.chat.message.poll.option.false', defaultMessage: 'False' },
  votes: { id: 'studio.polls.votes', defaultMessage: '{count, plural, one {# vote} other {# votes}}' },
  responders: {
    id: 'studio.polls.responders',
    defaultMessage: '{count, plural, one {# participant answered} other {# participants answered}}',
  },
  correct: { id: 'studio.polls.correct', defaultMessage: 'Correct answer' },
  seek: { id: 'studio.chat.seek', defaultMessage: 'Go to {time}' },
});

const Answer = ({ answer, intl, responders, showCorrect, type }) => {
  const label = getPollLabel(answer.key, type);
  const share = responders ? answer.numVotes / responders : 0;
  const correct = showCorrect && answer.isCorrectAnswer;

  return (
    <li className={cx('studio-poll-answer', { correct })}>
      <div className="studio-poll-answer-row">
        <span className="studio-poll-answer-label">
          {label ? intl.formatMessage(intlMessages[label]) : answer.key}
          {correct ? (
            <>
              <span aria-hidden="true"> ✓</span>
              <span className="studio-visually-hidden">{`, ${intl.formatMessage(intlMessages.correct)}`}</span>
            </>
          ) : null}
        </span>
        <span className="studio-poll-answer-count">
          {intl.formatMessage(intlMessages.votes, { count: answer.numVotes })}
          {' · '}
          {intl.formatNumber(share, { maximumFractionDigits: 0, style: 'percent' })}
        </span>
      </div>
      <div aria-hidden="true" className="studio-poll-bar">
        <div style={{ width: `${share * 100}%` }} />
      </div>
    </li>
  );
};

const Poll = React.memo(({ current, intl, past, poll, pollId }) => {
  const time = formatTime(poll.timestamp);

  return (
    <li className={cx('studio-poll', { current, future: !past })} data-id={pollId}>
      <div className="studio-poll-header">
        <span className="studio-poll-kind">
          {intl.formatMessage(poll.isQuiz ? intlMessages.quiz : intlMessages.poll)}
        </span>
        <button
          aria-label={intl.formatMessage(intlMessages.seek, { time })}
          className="studio-poll-time"
          onClick={() => seekTo(poll.timestamp)}
          type="button"
        >
          {time}
        </button>
      </div>
      {poll.question ? <p className="studio-poll-question">{poll.question}</p> : null}
      <ul className="studio-poll-answers">
        {(poll.answers || []).map((answer) => (
          <Answer
            answer={answer}
            intl={intl}
            key={answer.id}
            responders={poll.responders}
            showCorrect={poll.showCorrectAnswer}
            type={poll.type}
          />
        ))}
      </ul>
      <p className="studio-poll-responders">
        {intl.formatMessage(intlMessages.responders, { count: poll.responders || 0 })}
      </p>
    </li>
  );
});

// The recording's polls with their results, following the playback like the
// chat: the ones still ahead are dimmed, the latest one is marked
const Polls = ({ time }) => {
  const intl = useIntl();
  const polls = useMemo(() => storage.polls || [], []);
  const currentIndex = getCurrentDataIndex(polls, time);
  const { listProps } = useFollow(currentIndex >= 0 ? `poll-${currentIndex}` : null);

  return (
    <ul
      aria-label={intl.formatMessage(intlMessages.aria)}
      className="studio-polls studio-list"
      {...listProps}
    >
      {polls.map((poll, index) => (
        <Poll
          current={index === currentIndex}
          intl={intl}
          // The polls carry no id of their own: their place in the recording
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          past={index <= currentIndex}
          poll={poll}
          pollId={`poll-${index}`}
        />
      ))}
    </ul>
  );
};

export default Polls;
