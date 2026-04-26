export type BrowserStartupScope = 'home' | 'inspiration'

export type BrowserMemoryInfo = {
  label: string
  usedBytes: number
  totalBytes?: number
}

export type BrowserStartupLogOptions = {
  appVersion: string
  scope: BrowserStartupScope
}
