import { i18n } from '@/i18n'

export interface ReaderSettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  paragraphSpacing: number
  scrollMode: 'scroll' | 'paged'
}

export const FONT_OPTIONS = [
  {
    get label() {
      return i18n.global.t('settings.appearance.fontOptions.notoSerif')
    },
    value: '"Noto Serif SC", Georgia, serif',
  },
  {
    get label() {
      return i18n.global.t('settings.appearance.fontOptions.notoSans')
    },
    value: '"Noto Sans SC", Inter, system-ui, sans-serif',
  },
  { label: 'Inter', value: '"Inter", system-ui, sans-serif' },
  {
    get label() {
      return i18n.global.t('settings.appearance.fontOptions.system')
    },
    value: 'system-ui, sans-serif',
  },
]
