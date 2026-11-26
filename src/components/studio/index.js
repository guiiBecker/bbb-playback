import React, { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ID } from 'utils/constants';
import storage from 'utils/data/storage';
import Controls from './controls';
import Panel from './panel';
import Stage from './stage';
import { useMasterLayout } from './master';
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
  const player = usePlayerState();
  // The recording's own length until the media reports one (or when it cannot
  // be decoded), so the timeline and its markers are there from the start
  const { end, name, start } = storage.metadata;
  const state = { ...player, duration: player.duration || Math.max(0, (end - start) / 1000) };
  const captions = storage.captions || [];
  const [locale, setLocale] = useState(() => pickLocale(captions, intl.locale));
  const [captionsOn, setCaptionsOn] = useState(true);
  const transcript = useTranscript(locale);
  const hasCaptions = transcript.cues.length > 0;
  // The webcams are on by default; turning them off shows only the
  // presentation part of the video, so the button needs layout.json to say
  // where that is
  const [webcamsOn, setWebcamsOn] = useState(true);
  const layout = useMasterLayout();
  const webcamsToggle = Boolean(layout && layout.content);
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
        {/* Phones only, see index.scss. Hidden from screen readers: the
            panel's heading below says the same */}
        <p aria-hidden="true" className="studio-player-title">{name}</p>
        <Stage
          cues={captionsOn ? transcript.cues : null}
          layout={layout}
          time={state.time}
          webcamsOn={webcamsOn}
        />
        <Controls
          captions={{ available: hasCaptions, on: captionsOn, toggle: () => setCaptionsOn((on) => !on) }}
          fullscreen={fullscreen}
          state={state}
          webcams={{ available: webcamsToggle, on: webcamsOn, toggle: () => setWebcamsOn((on) => !on) }}
        />
      </main>
    </div>
  );
};

export default Studio;
