import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ID } from 'utils/constants';
import Controls from './controls';
import Info from './info';
import Panel from './panel';
import Stage from './stage';
import { usePlayerState } from './hooks';
import './index.scss';

const intlMessages = defineMessages({
  aria: { id: 'player.wrapper.aria', defaultMessage: 'Player area' },
});

// Redesigned layout: side panel on the left; stage, controls and recording
// info on the right
const Studio = () => {
  const intl = useIntl();
  const state = usePlayerState();

  return (
    <div
      aria-label={intl.formatMessage(intlMessages.aria)}
      className="studio"
      id={ID.PLAYER}
    >
      <Panel time={state.time} />
      <main className="studio-main">
        <Stage hasVideo={state.hasVideo} ratio={state.ratio} />
        <Controls state={state} />
        <Info state={state} />
      </main>
    </div>
  );
};

export default Studio;
