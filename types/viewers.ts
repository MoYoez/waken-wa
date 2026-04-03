export interface ViewerCountData {
  count: number
}

export interface ViewerCountResponse {
  success: boolean
  data?: ViewerCountData
  error?: string
}

