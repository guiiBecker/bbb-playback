import {
  getLocale,
  getLocales,
  getMessages,
  saveLocale,
} from './index';

const visit = (search) => window.history.replaceState(null, '', `/playback/presentation/2.3/record-1${search}`);

beforeEach(() => {
  localStorage.clear();
  visit('');
});

describe('getLocale', () => {
  it('takes the browser\'s language when nothing else says', () => {
    expect(getLocale()).toBe('en');
  });

  it('takes the locale chosen in the player on an earlier visit', () => {
    saveLocale('pt-BR');

    expect(getLocale()).toBe('pt-BR');
  });

  it('takes the link\'s locale before the chosen one', () => {
    saveLocale('pt-BR');
    visit('?locale=fr');

    expect(getLocale()).toBe('fr');
  });

  it('falls back to the language of a locale without a file of its own', () => {
    visit('?locale=fr-CA');

    expect(getLocale()).toBe('fr');
  });

  it('skips a locale it does not know', () => {
    saveLocale('pt-BR');
    visit('?locale=xx');

    expect(getLocale()).toBe('pt-BR');
  });

  it('sets the document\'s language and direction', () => {
    visit('?locale=ar');
    getLocale();

    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});

describe('saveLocale', () => {
  it('puts the choice in a link that names a locale, and leaves other links alone', () => {
    visit('?t=27s');
    saveLocale('pt-BR');
    expect(window.location.search).toBe('?t=27s');

    visit('?locale=fr&t=27s');
    saveLocale('pt-BR');
    expect(window.location.search).toBe('?locale=pt-BR&t=27s');
    expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
  });
});

describe('getMessages', () => {
  it('fills what a locale leaves untranslated from English', () => {
    const messages = getMessages('fr');

    expect(messages['loader.wrapper.aria']).not.toBe(getMessages('en')['loader.wrapper.aria']);
    expect(messages['studio.tab.chapters']).toBe('Chapters');
  });

  it('leaves the other locales\' messages as they are', () => {
    expect(getMessages('pt-BR')['studio.tab.chapters']).toBe('Capítulos');
    expect(getMessages('en')['studio.tab.chapters']).toBe('Chapters');
    expect(getMessages('fr')['studio.tab.chapters']).toBe('Chapters');
  });
});

describe('getLocales', () => {
  it('lists every locale, or only those that translate a key', () => {
    expect(getLocales()).toEqual(expect.arrayContaining(['en', 'fr', 'pt-BR', 'zh-CN']));
    expect(getLocales('studio.tab.chat')).toEqual(expect.arrayContaining(['en', 'pt-BR']));
    expect(getLocales('studio.tab.chat')).not.toContain('fr');
  });
});
