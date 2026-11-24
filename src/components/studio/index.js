import React, { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ID } from 'utils/constants';
import storage from 'utils/data/storage';
import Controls from './controls';
import Panel from './panel';
import Stage from './stage';
import { pickLocale, useTranscript } from './transcript';
import { useFullscreen, usePlayerState } from './hooks';
import './index.scss';

const intlMessages = defineMessages({
  aria: { id: 'player.wrapper.aria', defaultMessage: 'Player area' },
});

// Redesigned layout: side panel with the recording's details on the left; on
// the right one dark player, the stage above the controls
const Studio = () => {
  const intl = useIntl();
  const state = usePlayerState();
  const captions = storage.captions || [];
  const [locale, setLocale] = useState(() => pickLocale(captions, intl.locale));
  const [captionsOn, setCaptionsOn] = useState(true);
  const transcript = useTranscript(locale);
  const hasCaptions = transcript.cues.length > 0;
  // Fullscreen covers the stage and the controls only, see index.scss
  const main = useRef(null);
  const fullscreen = useFullscreen(main);

  return (
    <div
      aria-label={intl.formatMessage(intlMessages.aria)}
      className="studio"
      id={ID.PLAYER}
    >
      <Panel
        captions={captions}
        duration={state.duration}
        locale={locale}
        setLocale={setLocale}
        time={state.time}
        transcript={transcript}
      />
      <main className="studio-main" ref={main}>
        <Stage
          cues={captionsOn ? transcript.cues : null}
          hasVideo={state.hasVideo}
          ratio={state.ratio}
          time={state.time}
        />
        <Controls
          captions={{ available: hasCaptions, on: captionsOn, toggle: () => setCaptionsOn((on) => !on) }}
          fullscreen={fullscreen}
          state={state}
        />
      </main>
    </div>
  );
};

export default Studio;
