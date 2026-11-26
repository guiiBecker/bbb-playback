import React from 'react';
import { createRoot } from 'react-dom/client';
import Loader from 'components/loader';
import Router from 'components/router';
import { LocaleProvider } from 'locales/provider';
import { ROUTER } from 'utils/constants';
import { getStyle } from 'utils/params';
import './index.scss';

const style = getStyle();

const root = createRoot(document.getElementById('root'));

root.render(
  (
    <LocaleProvider>
      {style ? <link rel="stylesheet" type="text/css" href={style} /> : null}
      {ROUTER ? <Router /> : <Loader />}
    </LocaleProvider>
  )
);
