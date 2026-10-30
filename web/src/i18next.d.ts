import 'i18next'
import type shared from './locales/zh-Hans.json'
import type site from '@/locales/zh-Hans.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    // The shared catalogue with the site's keys added (see i18n.ts).
    resources: { translation: typeof shared & typeof site }
    strictKeyChecks: true
  }
}
