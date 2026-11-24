import React from 'react';
import cx from 'classnames';
import Content from 'components/player/content';
import Webcams from 'components/webcams';
import { useLayoutSwap } from 'components/utils/hooks';
import layout from 'utils/layout';

// Presentation (or screenshare) in the middle, webcams in a column on the right.
// The recording keeps all webcams in a single video
const Stage = ({ hasVideo, ratio }) => {
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
    </section>
  );
};

export default Stage;
