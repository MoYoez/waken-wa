import { toast } from 'sonner'

type ToastSwitchOptions = {
  /** Hint that changes are local until the user saves site config. */
  remindSave?: boolean
}

/** Short feedback when toggling a boolean control in the admin UI. */
export function toastSwitchLabel(label: string, on: boolean, options?: ToastSwitchOptions) {
  toast.success(on ? `${label}：已开启` : `${label}：已关闭`, {
    duration: 2200,
    ...(options?.remindSave ? { description: '保存后写入站点配置' } : {}),
  })
}

type ToastFormSettingOptions = {
  remindSave?: boolean
  duration?: number
}

/** Single-choice or small form edits (e.g. Select / Radio) in admin drafts. */
export function toastFormSetting(message: string, options?: ToastFormSettingOptions) {
  toast.success(message, {
    duration: options?.duration ?? 2200,
    ...(options?.remindSave ? { description: '保存后写入站点配置' } : {}),
  })
}
