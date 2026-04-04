'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import { webSettingsFormAtom } from '@/components/admin/web-settings-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export function WebSettingsSecurityPanel() {
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const prefersReducedMotion = Boolean(useReducedMotion())
  const patch = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="hcaptcha-toggle" className="font-normal cursor-pointer">
          启用 hCaptcha 登录验证
        </Label>
        <Switch
          id="hcaptcha-toggle"
          checked={form.hcaptchaEnabled}
          onCheckedChange={(value) => patch('hcaptchaEnabled', value)}
        />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        开启后，后台登录页将显示 hCaptcha 人机验证。需前往{' '}
        <a
          href="https://www.hcaptcha.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          hcaptcha.com
        </a>{' '}
        注册并获取 Site Key 和 Secret Key。
      </p>
      <AnimatePresence initial={false}>
        {form.hcaptchaEnabled ? (
          <motion.div
            className="space-y-3 pt-1"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
          <div className="space-y-2">
            <Label htmlFor="hcaptcha-sitekey">Site Key</Label>
            <Input
              id="hcaptcha-sitekey"
              value={form.hcaptchaSiteKey}
              onChange={(event) => patch('hcaptchaSiteKey', event.target.value)}
              placeholder="10000000-ffff-ffff-ffff-000000000001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hcaptcha-secretkey">Secret Key（留空则不修改已保存的值）</Label>
            <Input
              id="hcaptcha-secretkey"
              value={form.hcaptchaSecretKey}
              onChange={(event) => patch('hcaptchaSecretKey', event.target.value)}
              placeholder="留空则保留之前配置的 Secret Key"
            />
          </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
