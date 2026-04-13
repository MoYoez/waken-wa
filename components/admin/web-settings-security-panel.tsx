'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import {
  WebSettingsInset,
  WebSettingsRow,
} from '@/components/admin/web-settings-layout'
import { webSettingsFormAtom } from '@/components/admin/web-settings-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export function WebSettingsSecurityPanel() {
  const { t } = useT('admin')
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
    <WebSettingsInset className="space-y-4">
      <WebSettingsRow
        htmlFor="hcaptcha-toggle"
        title={t('webSettingsSecurity.hcaptchaTitle')}
        description={
          <>
            {t('webSettingsSecurity.hcaptchaDescriptionPrefix')}{' '}
            <a
              href="https://www.hcaptcha.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              hcaptcha.com
            </a>
            {t('webSettingsSecurity.hcaptchaDescriptionSuffix')}
          </>
        }
        className="px-0 py-0 sm:px-0"
        action={
          <Switch
            id="hcaptcha-toggle"
            checked={form.hcaptchaEnabled}
            onCheckedChange={(value) => patch('hcaptchaEnabled', value)}
          />
        }
      />

      <AnimatePresence initial={false}>
        {form.hcaptchaEnabled ? (
          <motion.div
            className="space-y-3 border-t border-border pt-3"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
            <div className="space-y-2">
              <Label htmlFor="hcaptcha-sitekey">{t('webSettingsSecurity.siteKeyLabel')}</Label>
              <Input
                id="hcaptcha-sitekey"
                value={form.hcaptchaSiteKey}
                onChange={(event) => patch('hcaptchaSiteKey', event.target.value)}
                placeholder="10000000-ffff-ffff-ffff-000000000001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hcaptcha-secretkey">
                {t('webSettingsSecurity.secretKeyLabel')}
              </Label>
              <Input
                id="hcaptcha-secretkey"
                value={form.hcaptchaSecretKey}
                onChange={(event) => patch('hcaptchaSecretKey', event.target.value)}
                placeholder={t('webSettingsSecurity.secretKeyPlaceholder')}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </WebSettingsInset>
  )
}
