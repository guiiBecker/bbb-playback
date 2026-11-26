import React, { useRef } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import Webcams from 'components/webcams';
import { useDoubleTapSeek } from './gestures';
import Icon from './icon';
import { activeCue } from './transcript';
import {
  captionsPlace,
  MASTER_CLIP_PATH,
  MasterClip,
  MasterOverlay,
  masterAreas,
  useMasterFrame,
  useVideoSize,
} from './master';

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

// The recorded transcription as captions, over the video: at the bottom of
// the presentation's part of it (`place`, master.js), or without one at the
// bottom of the video
const Captions = ({ cues, place, time }) => {
  const cue = activeCue(cues, time);
  if (!cue) return null;

  const style = place ? {
    bottom: `calc(${place.bottom}px + var(--studio-captions-inset))`,
    left: `${place.center}px`,
    maxWidth: `calc(${place.width}px - 2 * var(--studio-captions-inset))`,
  } : undefined;

  return (
    <div className="studio-captions" style={style}>
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
  // The video's size: layout.json has it, else the video itself says it
  const size = useVideoSize(masterBox);
  const frame = useMasterFrame(
    masterBox,
    (layout && layout.width) || (size && size.width),
    (layout && layout.height) || (size && size.height),
    crop,
  );
  // The presentation and the webcam tiles are square in the video: it is
  // clipped to them with rounded corners, as the stage without a master
  // video had them
  const areas = masterAreas(layout, time, !!crop);

  return (
    <section className="studio-stage master" ref={stage}>
      <div className={cx('studio-master', { cropped: !!crop })} ref={masterBox}>
        <div
          className="studio-master-frame"
          style={frame ? {
            height: frame.height, left: frame.left, top: frame.top, width: frame.width,
          } : undefined}
        >
          <div className="studio-master-video" style={areas.length ? { clipPath: MASTER_CLIP_PATH } : undefined}>
            <Webcams minimal />
          </div>
          {areas.length ? <MasterClip areas={areas} layout={layout} /> : null}
          {layout && frame && !crop ? <MasterOverlay layout={layout} scale={frame.scale} time={time} /> : null}
          {/* Inside the video's frame, so they sit on the picture */}
          {cues ? <Captions cues={cues} place={captionsPlace(frame, layout)} time={time} /> : null}
        </div>
      </div>
      <SeekFeedback feedback={seekFeedback} />
    </section>
  );
};

export default Stage;
