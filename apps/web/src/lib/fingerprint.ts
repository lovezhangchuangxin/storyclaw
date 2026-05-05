const STORAGE_KEY = 'storyclaw:device_fingerprint'

function canvasHash(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('StoryClaw_FP', 2, 15)
    ctx.fillStyle = 'rgba(102,204,0,0.7)'
    ctx.fillText('StoryClaw_FP', 4, 17)
    const data = canvas.toDataURL()
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
    }
    return hash.toString(36)
  } catch {
    return ''
  }
}

function collectSignals(): string {
  const parts = [
    canvasHash(),
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.hardwareConcurrency?.toString() ?? '',
    navigator.userAgent,
  ]
  return parts.join('|')
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function getDeviceFingerprint(): Promise<string> {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) return cached

    const signals = collectSignals()
    const fp = await sha256(signals)
    localStorage.setItem(STORAGE_KEY, fp)
    return fp
  } catch {
    return ''
  }
}
