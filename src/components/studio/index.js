import React, { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ID } from 'utils/constants';
import storage from 'utils/data/storage';
import Controls from './controls';
import Info from './info';
import Panel from './panel';
import Stage from './stage';
import { pickLocale, useTranscript } from './transcript';
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
  const captions = storage.captions || [];
  const [locale, setLocale] = useState(() => pickLocale(captions, intl.locale));
  const [captionsOn, setCaptionsOn] = useState(true);
  const transcript = useTranscript(locale);
  const hasCaptions = transcript.cues.length > 0;

  return (
    <div
      aria-label={intl.formatMessage(intlMessages.aria)}
      className="studio"
      id={ID.PLAYER}
    >
      <Panel
        captions={captions}
        locale={locale}
        setLocale={setLocale}
        time={state.time}
        transcript={transcript}
      />
      <main className="studio-main">
        <Stage
          cues={captionsOn ? transcript.cues : null}
          hasVideo={state.hasVideo}
          ratio={state.ratio}
          time={state.time}
        />
        <Controls
          captions={{ available: hasCaptions, on: captionsOn, toggle: () => setCaptionsOn((on) => !on) }}
          state={state}
        />
        <Info state={state} />
      </main>
    </div>
  );
};

export default Studio;
