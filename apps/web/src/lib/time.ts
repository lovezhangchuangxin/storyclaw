import { i18n } from '@/i18n'

export function relativeTime(timestamp: number): string {
  const { t } = i18n.global
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo', { n: minutes })

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hoursAgo', { n: hours })

  const days = Math.floor(hours / 24)
  if (days < 30) return t('time.daysAgo', { n: days })

  const months = Math.floor(days / 30)
  if (months < 12) return t('time.monthsAgo', { n: months })

  return t('time.yearsAgo', { n: Math.floor(months / 12) })
}
