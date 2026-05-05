import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'

export type SupportedLocale = 'zh-CN' | 'en-US'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-CN', 'en-US']

function detectBrowserLocale(): SupportedLocale {
  try {
    const nav = navigator.language
    if (nav.startsWith('zh')) return 'zh-CN'
    if (nav.startsWith('en')) return 'en-US'
  } catch {}
  return 'zh-CN'
}

function loadPersistedLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem('storyclaw:locale')
    if (stored === 'zh-CN' || stored === 'en-US') return stored
  } catch {}
  return detectBrowserLocale()
}

export const i18n = createI18n({
  legacy: false,
  locale: loadPersistedLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export function setLocale(locale: SupportedLocale) {
  ;(i18n.global.locale as any).value = locale
  try {
    localStorage.setItem('storyclaw:locale', locale)
  } catch {}
  document.documentElement.lang = locale
}

document.documentElement.lang = i18n.global.locale.value as string
