import { defineConfig } from 'next-i18next'

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: AppLanguage = 'zh-CN'

const i18nConfig = defineConfig({
  supportedLngs: [...SUPPORTED_LANGUAGES],
  fallbackLng: DEFAULT_LANGUAGE,
  cookieName: 'NEXT_LOCALE',
  headerName: 'x-i18next-current-language',
  defaultNS: 'common',
  ns: ['common', 'auth', 'admin'],
  localeInPath: false,
  nonExplicitSupportedLngs: true,
  localePath: '/locales',
  resourceLoader: (language, namespace) =>
    import(`./public/locales/${language}/${namespace}.json`).then((module) => module.default),
})

export default i18nConfig
