import React, { useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import Content from 'components/player/content';
import Webcams from 'components/webcams';
import { useLayoutSwap } from 'components/utils/hooks';
import { ID } from 'utils/constants';
import layout from 'utils/layout';
import { activeCue } from './transcript';

// The box a picture of `width` x `height` takes when fitted, centered, into
// `frame`: how the presentation fits its viewBox into the SVG
// (preserveAspectRatio xMidYMid meet) and a video its frames
const fit = (frame, width, height) => {
  if (!frame.width || !frame.height || !width || !height) return null;

  const scale = Math.min(frame.width / width, frame.height / height);

  return {
    height: height * scale,
    left: frame.left + (frame.width - width * scale) / 2,
    top: frame.top + (frame.height - height * scale) / 2,
    width: width * scale,
  };
};

// The screenshare's frames when it is on, else the slide
const findPicture = (content) => {
  const video = content.querySelector(`#${ID.SCREENSHARE} video`);
  const screenshare = video && fit(video.getBoundingClientRect(), video.videoWidth, video.videoHeight);
  if (screenshare) return screenshare;

  const svg = content.querySelector(`#${ID.PRESENTATION} svg`);
  const viewBox = svg && svg.viewBox && svg.viewBox.baseVal;

  return viewBox ? fit(svg.getBoundingClientRect(), viewBox.width, viewBox.height) : null;
};

// Where the slide or the screenshare sits in the content area, in pixels from
// its bottom edge and its left edge. Null when there is nothing to measure
// (logo, tldraw whiteboard): the captions then keep to the bottom of the area
const measurePicture = (content) => {
  const picture = findPicture(content);
  if (!picture) return null;

  const area = content.getBoundingClientRect();

  return {
    bottom: Math.round(area.bottom - (picture.top + picture.height)),
    center: Math.round(picture.left + picture.width / 2 - area.left),
    width: Math.round(picture.width),
  };
};

const samePicture = (a, b) => (a === b) || (a && b
  && a.bottom === b.bottom && a.center === b.center && a.width === b.width);

// Follows the picture's place: the stage resizing, zooming (the viewBox), the
// slide appearing, switching to the screenshare and its video loading
const usePicture = (content) => {
  const [picture, setPicture] = useState(null);

  useEffect(() => {
    const node = content.current;
    if (!node) return undefined;

    const update = () => {
      const next = measurePicture(node);
      setPicture((previous) => (samePicture(previous, next) ? previous : next));
    };

    const resize = new ResizeObserver(update);
    resize.observe(node);
    const mutation = new MutationObserver(update);
    mutation.observe(node, {
      attributeFilter: ['class', 'style', 'viewBox'],
      attributes: true,
      childList: true,
      subtree: true,
    });
    // Media events do not bubble, but reach the ancestors' capture listeners
    const media = ['loadedmetadata', 'resize'];
    media.forEach((event) => node.addEventListener(event, update, true));
    update();

    return () => {
      resize.disconnect();
      mutation.disconnect();
      media.forEach((event) => node.removeEventListener(event, update, true));
    };
  }, [content]);

  return picture;
};

// The recorded transcription as captions, at the bottom of the slide or the
// screenshare
const Captions = ({ cues, picture, time }) => {
  const cue = activeCue(cues, time);
  if (!cue) return null;

  const style = picture ? {
    bottom: `calc(${picture.bottom}px + var(--studio-captions-inset))`,
    left: `${picture.center}px`,
    maxWidth: `calc(${picture.width}px - 2 * var(--studio-captions-inset))`,
  } : undefined;

  return (
    <div className="studio-captions" style={style}>
      <span>{cue.text}</span>
    </div>
  );
};

// Whether the stage shows a presentation (or screenshare) beside the webcams.
// Without one the webcams are the content
const usePresentationShown = () => {
  const { showPresentation } = useLayoutSwap();

  return !layout.single && showPresentation !== false;
};

// Presentation (or screenshare) in the middle, webcams in a column on the right.
// The recording keeps all webcams in a single video. `cues` is null while the
// captions are off. With `webcamsOn` false the webcams column folds away and
// the presentation takes its room; the video stays, it carries the sound
const Stage = ({ cues, hasVideo, ratio, time, webcamsOn }) => {
  const presentation = usePresentationShown();
  const content = useRef(null);
  const picture = usePicture(content);

  return (
    <section
      className={cx('studio-stage', {
        'no-presentation': !presentation,
        'no-video': !hasVideo,
        'webcams-hidden': presentation && hasVideo && !webcamsOn,
      })}
    >
      <div className="studio-content" ref={content}>
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
      {cues ? <Captions cues={cues} picture={picture} time={time} /> : null}
    </section>
  );
};

export { usePresentationShown };

export default Stage;
