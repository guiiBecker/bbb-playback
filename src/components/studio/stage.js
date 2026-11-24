import React from 'react';
import cx from 'classnames';
import Content from 'components/player/content';
import Webcams from 'components/webcams';
import { useLayoutSwap } from 'components/utils/hooks';
import layout from 'utils/layout';
import { activeCue } from './transcript';

// The recorded transcription over the stage, as captions
const Captions = ({ cues, time }) => {
  const cue = activeCue(cues, time);
  if (!cue) return null;

  return (
    <div className="studio-captions">
      <span>{cue.text}</span>
    </div>
  );
};

// Presentation (or screenshare) in the middle, webcams in a column on the right.
// The recording keeps all webcams in a single video. `cues` is null while the
// captions are off
const Stage = ({ cues, hasVideo, ratio, time }) => {
  const { showPresentation } = useLayoutSwap();
  const presentation = !layout.single && showPresentation !== false;

  return (
    <section className={cx('studio-stage', { 'no-presentation': !presentation, 'no-video': !hasVideo })}>
      <div className="studio-content">
        <Content
          fullscreen={false}
          hidePresentation={!presentation}
          minimal
          search={[]}
          swap={false}
        />
      </div>
      <div className="studio-webcams" style={{ aspectRatio: presentation ? `${ratio}` : undefined }}>
        <Webcams minimal />
      </div>
      {cues ? <Captions cues={cues} time={time} /> : null}
    </section>
  );
};

export default Stage;
