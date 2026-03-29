/**
 * Loads hCaptcha with render=explicit and the official URL onload callback.
 * DOM script.onload fires too early; see https://docs.hcaptcha.com/configuration#javascript-api
 */

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: string | HTMLElement, params: Record<string, unknown>) => string
      reset: (widgetId: string) => void
      getResponse: (widgetId: string) => string
    }
  }
}

const HCAPTCHA_ONLOAD_GLOBAL = '__wakenWaHcaptchaApiOnLoad'

let scriptPromise: Promise<void> | null = null

function waitUntilHCaptchaReady(timeoutMs = 20_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (window.hcaptcha) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('hCaptcha API load timeout'))
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

/** Resolves when window.hcaptcha is ready to call render(). */
export function loadHCaptchaApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.hcaptcha) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  const existing = document.querySelector<HTMLScriptElement>(
    'script[src*="js.hcaptcha.com/1/api.js"]',
  )
  if (existing) {
    scriptPromise = waitUntilHCaptchaReady().catch((err) => {
      scriptPromise = null
      throw err
    })
    return scriptPromise
  }

  scriptPromise = new Promise((resolve, reject) => {
    const onReady = () => {
      if (window.hcaptcha) resolve()
      else {
        scriptPromise = null
        reject(new Error('hCaptcha API missing after onload'))
      }
    }

    const w = window as unknown as Record<string, unknown>
    const prev = w[HCAPTCHA_ONLOAD_GLOBAL]
    w[HCAPTCHA_ONLOAD_GLOBAL] = () => {
      if (typeof prev === 'function') (prev as () => void)()
      onReady()
    }

    const s = document.createElement('script')
    s.async = true
    s.defer = true
    s.src = `https://js.hcaptcha.com/1/api.js?onload=${HCAPTCHA_ONLOAD_GLOBAL}&render=explicit`
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('hCaptcha script failed to load'))
    }
    document.head.appendChild(s)
  })

  return scriptPromise
}
