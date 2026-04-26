export {}

declare global {
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number
      totalJSHeapSize: number
      usedJSHeapSize: number
    }
    measureUserAgentSpecificMemory?: () => Promise<{
      bytes: number
    }>
  }

  interface Window {
    __wakenBrowserStartupLogKeys?: Set<string>
  }
}
