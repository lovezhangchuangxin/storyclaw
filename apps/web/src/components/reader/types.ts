export interface ReaderSettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  paragraphSpacing: number
  scrollMode: 'scroll' | 'paged' | 'auto'
  autoScrollSpeed: number
}

export const FONT_OPTIONS = [
  { label: '思源宋体', value: '"Noto Serif SC", Georgia, serif' },
  { label: '思源黑体', value: '"Noto Sans SC", Inter, system-ui, sans-serif' },
  { label: 'Inter', value: '"Inter", system-ui, sans-serif' },
  { label: '系统默认', value: 'system-ui, sans-serif' },
]
