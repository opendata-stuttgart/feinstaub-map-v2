import * as translations from '../data/translations.js';

export function getFirstBrowserLanguage() {
    let nav = window.navigator,
        browserLanguagePropertyKeys = ['language', 'browserLanguage', 'systemLanguage', 'userLanguage'],
        i,
        language,
        len;

    if (Array.isArray(nav.languages)) {
        for (let i = 0, language, len; i < nav.languages.length; i++) {
            language = nav.languages[i];
            len = language.length;
            if (len) {
                return language;
            }
        }
    }

    // support for other well known properties in browsers
    for (const property of browserLanguagePropertyKeys) {
        language = nav[property];
        len = language.length;
        if (len) {
            return language;
        }
    }
    return language;
}

export function tr(lang, text) {
    if (typeof translations != 'undefined' && typeof translations[text] != 'undefined' && typeof translations[text][lang] != 'undefined') {
        return translations[text][lang];
    } else {
        return text;
    }
}