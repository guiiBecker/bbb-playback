import React, { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useApps } from './apps';
import Icon from './icon';

const intlMessages = defineMessages({
  aria: { id: 'studio.apps.aria', defaultMessage: 'Apps' },
  back: { id: 'studio.apps.back', defaultMessage: 'Back to the apps' },
  backLabel: { id: 'studio.apps.backLabel', defaultMessage: 'Apps' },
  empty: { id: 'studio.apps.empty', defaultMessage: 'No apps for this recording.' },
});

// The Apps tab: a gallery of tiles like the BigBlueButton client's apps
// gallery; a tile opens its app in the panel, with a way back. Opening moves
// the focus to that way back, going back returns it to the tile
const AppsPanel = ({ time }) => {
  const intl = useIntl();
  const apps = useApps();
  const [openId, setOpenId] = useState(null);
  const back = useRef(null);
  const gallery = useRef(null);
  const lastOpened = useRef(null);

  const nameOf = (app) => (typeof app.name === 'string' ? app.name : intl.formatMessage(app.name));
  const open = apps.find((app) => app.id === openId);

  useEffect(() => {
    if (openId && back.current) {
      back.current.focus();
    } else if (!openId && lastOpened.current && gallery.current) {
      const tile = gallery.current.querySelector(`[data-id="${CSS.escape(lastOpened.current)}"]`);
      if (tile) tile.focus();
    }
  }, [openId]);

  if (open) {
    return (
      <div className="studio-app">
        <div className="studio-app-header">
          <button
            aria-label={intl.formatMessage(intlMessages.back)}
            className="studio-app-back"
            onClick={() => setOpenId(null)}
            ref={back}
            type="button"
          >
            <Icon name="chevronLeft" size={18} />
            {intl.formatMessage(intlMessages.backLabel)}
          </button>
          <h2 className="studio-app-title">{nameOf(open)}</h2>
        </div>
        <div className="studio-app-body">{open.render({ time })}</div>
      </div>
    );
  }

  if (!apps.length) {
    return <p className="studio-empty">{intl.formatMessage(intlMessages.empty)}</p>;
  }

  return (
    <ul aria-label={intl.formatMessage(intlMessages.aria)} className="studio-apps" ref={gallery}>
      {apps.map((app) => (
        <li key={app.id}>
          <button
            className="studio-app-tile"
            data-id={app.id}
            onClick={() => {
              lastOpened.current = app.id;
              setOpenId(app.id);
            }}
            type="button"
          >
            <span aria-hidden="true" className="studio-app-icon">
              <Icon name={app.icon} size={22} />
            </span>
            <span className="studio-app-name">{nameOf(app)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default AppsPanel;
