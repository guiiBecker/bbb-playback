import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { IntlProvider } from 'react-intl';
import {
  getLocale,
  getMessages,
  saveLocale,
} from './index';

const LocaleContext = createContext({
  locale: 'en',
  setLocale: () => {},
});

// react-intl's provider with a locale that can change while the player runs:
// `useLocale` gives the current one and the function to choose another
const LocaleProvider = ({ children }) => {
  const [locale, setCurrent] = useState(getLocale);

  const setLocale = useCallback((next) => {
    saveLocale(next);
    setCurrent(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  const messages = useMemo(() => getMessages(locale), [locale]);

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider
        locale={locale}
        messages={messages}
      >
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
};

const useLocale = () => useContext(LocaleContext);

export {
  LocaleProvider,
  useLocale,
};
