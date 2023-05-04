import * as translations from '../data/translations.js';

export function getFirstBrowserLanguage() {
  const nav = window.navigator;
  const browserLanguagePropertyKeys = ['language', 'browserLanguage', 'systemLanguage', 'userLanguage'];

  if (Array.isArray(nav.languages)) {
    for (const language of nav.languages) {
      if (language.length) {
        return language;
      }
    }
  }

  for (const property of browserLanguagePropertyKeys) {
    const language = nav[property];
    if (language.length) {
      return language;
    }
  }

  return '';
}

export function tr(lang, text) {
  if (translations && text in translations && lang in translations[text]) {
    return translations[text][lang];
  }

  return text;
}