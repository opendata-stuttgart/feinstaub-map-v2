import * as translations from './translations.js';

export function getFirstBrowserLanguage() {
    var nav = window.navigator,
        browserLanguagePropertyKeys = ['language', 'browserLanguage', 'systemLanguage', 'userLanguage'],
        i,
        language,
        len;

    // support for HTML 5.1 "navigator.languages"
    if (Array.isArray(nav.languages)) {
        for (i = 0; i < nav.languages.length; i++) {
            language = nav.languages[i];
            len = language.length;
            if (len) {
                return language;
            }
        }
    }

    // support for other well known properties in browsers
    for (i = 0; i < browserLanguagePropertyKeys.length; i++) {
        language = nav[browserLanguagePropertyKeys[i]];
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
};

