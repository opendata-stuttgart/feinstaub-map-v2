import * as translations from '../data/translations.js';

export function getFirstBrowserLanguage() {
    const nav = window.navigator;
    const browserLanguagePropertyKeys = ['language', 'browserLanguage', 'systemLanguage', 'userLanguage'];

    for (const lang of nav.languages) {
        if (lang.length > 0) {
            return lang;
        }
    }

    for (const property of browserLanguagePropertyKeys) {
        const lang = nav[property];
        if (lang.length > 0) {
            return lang;
        }
    }

    return '';
}

export function tr(lang, text) {
    const langExists = translations[text] && translations[text][lang];
    return langExists ? translations[text][lang] : text;
}