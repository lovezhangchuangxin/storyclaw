export interface ReaderSettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  paragraphSpacing: number
  textColor: string
  backgroundColor: string
  scrollMode: 'scroll' | 'paged' | 'auto'
  autoScrollSpeed: number
}

export interface ReaderTheme {
  id: string
  name: string
  backgroundColor: string
  textColor: string
  accentColor: string
}

export const PRESET_THEMES: ReaderTheme[] = [
  {
    id: 'serene',
    name: '静谧',
    backgroundColor: '#F5F0E8',
    textColor: '#333333',
    accentColor: '#8B7355',
  },
  {
    id: 'ink-night',
    name: '墨夜',
    backgroundColor: '#1A1A2E',
    textColor: '#E0D9C5',
    accentColor: '#C9A96E',
  },
  {
    id: 'morning',
    name: '清晨',
    backgroundColor: '#FAFAF5',
    textColor: '#2C3E50',
    accentColor: '#5B8C5A',
  },
  {
    id: 'parchment',
    name: '羊皮',
    backgroundColor: '#F4E4C1',
    textColor: '#3E2723',
    accentColor: '#8D6E63',
  },
  {
    id: 'pure',
    name: '纯净',
    backgroundColor: '#FFFFFF',
    textColor: '#222222',
    accentColor: '#4A90D9',
  },
  {
    id: 'gray',
    name: '灰调',
    backgroundColor: '#F0F0F0',
    textColor: '#444444',
    accentColor: '#777777',
  },
]

export const FONT_OPTIONS = [
  { label: '思源宋体', value: '"Noto Serif SC", Georgia, serif' },
  { label: '思源黑体', value: '"Noto Sans SC", Inter, system-ui, sans-serif' },
  { label: 'Inter', value: '"Inter", system-ui, sans-serif' },
  { label: '系统默认', value: 'system-ui, sans-serif' },
]
