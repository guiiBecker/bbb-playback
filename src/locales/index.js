import { locale as config } from 'config';
import messages from './messages';
import { getSearchParam } from 'utils/params';

const RTL_LOCALES = ['ar', 'dv', 'fa', 'he'];
const FALLBACK_LOCALE = 'en';
const PARAM = 'locale';
const STORAGE_KEY = 'bbb-playback-locale';

const localeToFile = (locale) => locale.replace('-', '_');

const fileToLocale = (locale) => locale.replace('_', '-');

const setDirection = (language) => {
  if (RTL_LOCALES.includes(language)) {
    document.body.parentNode.setAttribute('dir', 'rtl');
  } else {
    document.body.parentNode.setAttribute('dir', 'ltr');
  }
};

// The messages file of a wanted locale: its own, else its language's; null
// when there is neither
const findFile = (locale) => {
  if (!locale) return null;

  const file = localeToFile(locale);
  if (messages[file]) return file;

  const [ language, ] = file.split('_');

  return messages[language] ? language : null;
};

// The locale chosen in the player on an earlier visit
const getSavedLocale = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return null;
  }
};

// The page follows the locale: the text direction and the document's language
const applyLocale = (locale) => {
  const [ language, ] = localeToFile(locale).split('_');

  setDirection(language);
  document.documentElement.setAttribute('lang', locale);
};

// The link's locale first, then the one chosen in the player, then the
// browser's
const getLocale = () => {
  const file = findFile(getSearchParam(PARAM))
    || findFile(getSavedLocale())
    || findFile(navigator.language)
    || config.default;
  const locale = fileToLocale(file);

  applyLocale(locale);

  return locale;
};

// A locale chosen in the player: kept for the next visit. A link that names a
// locale gets the new one, so reloading does not take the choice back
const saveLocale = (locale) => {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch (error) {
    // No storage (private mode): the choice lasts for this visit
  }

  const url = new URL(window.location.href);
  if (url.searchParams.has(PARAM)) {
    url.searchParams.set(PARAM, locale);
    window.history.replaceState(window.history.state, '', url);
  }

  applyLocale(locale);
};

// The locales with a messages file; with `key`, only those that translate it
const getLocales = (key = null) => Object.keys(messages)
  .filter((file) => !key || Object.prototype.hasOwnProperty.call(messages[file], key))
  .map(fileToLocale);

// A new object each time: what a locale leaves untranslated comes from the
// fallback, and the fallback's own messages stay as they are
const getMessages = (locale) => ({
  ...messages[FALLBACK_LOCALE],
  ...messages[localeToFile(locale)],
});

export {
  getLocale,
  getLocales,
  getMessages,
  saveLocale,
}
