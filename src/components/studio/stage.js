import React, { useRef } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import Webcams from 'components/webcams';
import { useDoubleTapSeek } from './gestures';
import Icon from './icon';
import { activeCue } from './transcript';
import { MasterOverlay, useMasterFrame } from './master';

const intlMessages = defineMessages({
  // The back and forward buttons' labels
  backward: { id: 'studio.controls.backward', defaultMessage: 'Back {seconds} seconds' },
  forward: { id: 'studio.controls.forward', defaultMessage: 'Forward {seconds} seconds' },
});

// What a double tap did: a ripple on that side with the seconds jumped so
// far, and the same said to screen readers
const SeekFeedback = ({ feedback }) => {
  const intl = useIntl();
  const said = feedback
    ? intl.formatMessage(intlMessages[feedback.side], { seconds: feedback.total })
    : '';

  return (
    <>
      {feedback ? (
        // A new element for each tap, so the ripple plays again
        <div aria-hidden="true" className={cx('studio-seek-feedback', feedback.side)} key={feedback.id}>
          <Icon name={feedback.side} size={28} />
          <span>{intl.formatNumber(feedback.total, { style: 'unit', unit: 'second', unitDisplay: 'narrow' })}</span>
        </div>
      ) : null}
      <span className="studio-visually-hidden" role="status">{said}</span>
    </>
  );
};

// The recorded transcription as captions, at the bottom of the stage
const Captions = ({ cues, time }) => {
  const cue = activeCue(cues, time);
  if (!cue) return null;

  return (
    <div className="studio-captions">
      <span>{cue.text}</span>
    </div>
  );
};

// The recording's MP4, which has it all (slides, webcams, screen sharing): it
// is the stage and the clock; names and who is talking are drawn over it
// (`layout`, layout.json). With `webcamsOn` false it shows only the
// presentation part of it. `cues` is null while the captions are off
const Stage = ({
  cues,
  layout,
  time,
  webcamsOn,
}) => {
  const stage = useRef(null);
  const seekFeedback = useDoubleTapSeek(stage);
  const masterBox = useRef(null);
  // Webcams hidden: only the presentation / screen sharing part of the video
  const crop = layout && layout.content && !webcamsOn ? layout.content : null;
  const frame = useMasterFrame(masterBox, layout && layout.width, layout && layout.height, crop);

  return (
    <section className="studio-stage master" ref={stage}>
      <div className={cx('studio-master', { cropped: !!crop })} ref={masterBox}>
        <div
          className="studio-master-frame"
          style={frame ? {
            height: frame.height, left: frame.left, top: frame.top, width: frame.width,
          } : undefined}
        >
          <Webcams minimal />
          {frame && !crop ? <MasterOverlay layout={layout} scale={frame.scale} time={time} /> : null}
        </div>
      </div>
      {cues ? <Captions cues={cues} time={time} /> : null}
      <SeekFeedback feedback={seekFeedback} />
    </section>
  );
};

export default Stage;
