import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { en } from './en';
import { ru } from './ru';

const deviceLang = getLocales()[0]?.languageCode ?? 'en';
const defaultLang = deviceLang === 'ru' ? 'ru' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: defaultLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
