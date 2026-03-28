import type { SetupInitialConfig } from './components'

export type AdminSetupSnapshot = {
  isConfigOK: boolean
  hasAdmin: boolean
  initialConfig?: SetupInitialConfig
}
