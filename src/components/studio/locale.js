import React, { useState } from 'react';
import cx from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import { getLocales } from 'locales';
import { useLocale } from 'locales/provider';
import { useDisclosure } from './disclosure';
import Icon from './icon';

const intlMessages = defineMessages({
  label: { id: 'studio.locale.label', defaultMessage: 'Interface language' },
  button: { id: 'studio.locale.button', defaultMessage: 'Interface language: {language}' },
});

// "Deutsch", "Português (Brasil)": a language in its own words, as the people
// looking for it read it
const nameOf = (locale) => {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale);

    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch (error) {
    return locale;
  }
};

// The languages the redesigned player is translated into: the locales that
// have its strings. The other locale files only translate the classic player
const LANGUAGES = getLocales('studio.tab.chat')
  .map((locale) => ({ locale, name: nameOf(locale) }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Lucide's globe (ISC License). Its parts apart, so the meridian can turn
const Globe = ({ turning }) => (
  <svg
    aria-hidden="true"
    className={cx('studio-globe', { turning })}
    focusable="false"
    // Inline, so the presentation's global `svg` rule cannot resize it
    style={{ height: 18, width: 18 }}
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path className="studio-globe-meridian" d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
  </svg>
);

// The interface language: a globe that opens the list of languages (a
// disclosure, see disclosure.js). Not the captions' language, which the
// transcription tab has. Nothing to choose with a single language
const LocaleSwitcher = () => {
  const intl = useIntl();
  const { locale, setLocale } = useLocale();
  // The globe turns each time the list opens and when a language is chosen
  const [turns, setTurns] = useState(0);
  const {
    button,
    close,
    id,
    list,
    onBlur,
    onKeyDown,
    open,
    root,
    toggle,
  } = useDisclosure();

  if (LANGUAGES.length < 2) return null;

  const current = LANGUAGES.find((language) => language.locale === locale);
  const label = intl.formatMessage(intlMessages.button, { language: current ? current.name : locale });

  const select = (next) => {
    if (next !== locale) setLocale(next);
    setTurns((count) => count + 1);
    close();
  };

  return (
    // The handlers watch the keys and the focus of the buttons inside
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="studio-locale" onBlur={onBlur} onKeyDown={onKeyDown} ref={root}>
      <button
        aria-controls={open ? id : undefined}
        aria-expanded={open}
        aria-label={label}
        className="studio-locale-button"
        onClick={() => {
          if (!open) setTurns((count) => count + 1);
          toggle();
        }}
        ref={button}
        title={label}
        type="button"
      >
        {/* A new element for each turn, so it plays again */}
        <Globe key={turns} turning={turns > 0} />
      </button>
      {open ? (
        <ul aria-label={intl.formatMessage(intlMessages.label)} className="studio-locale-list" id={id} ref={list}>
          {LANGUAGES.map((language) => (
            <li key={language.locale}>
              <button
                aria-pressed={language.locale === locale}
                className="studio-locale-option"
                // Each name is in its own language: read out as such
                lang={language.locale}
                onClick={() => select(language.locale)}
                type="button"
              >
                <span>{language.name}</span>
                {language.locale === locale ? <Icon name="check" size={16} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default LocaleSwitcher;
