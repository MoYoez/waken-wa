'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useT } from 'next-i18next/client'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import { FileSelectTrigger } from '@/components/admin/file-select-trigger'
import {
  webSettingsCropDialogOpenAtom,
  webSettingsCropSourceUrlAtom,
  webSettingsCropTargetAtom,
  webSettingsFormAtom,
} from '@/components/admin/web-settings-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { isRemoteAvatarUrl, resolveAvatarUrl } from '@/lib/avatar-url'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'

export function WebSettingsBasicPanel() {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [cropSourceUrl, setCropSourceUrl] = useAtom(webSettingsCropSourceUrlAtom)
  const [, setCropDialogOpen] = useAtom(webSettingsCropDialogOpenAtom)
  const [, setCropTarget] = useAtom(webSettingsCropTargetAtom)
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
  const avatarUsesRemoteUrl = isRemoteAvatarUrl(form.avatarUrl)
  const avatarPreviewUrl = resolveAvatarUrl(
    form.avatarUrl,
    avatarUsesRemoteUrl && form.avatarFetchByServerEnabled,
    'admin-preview',
  )
  const siteIconPreviewUrl = form.siteIconUrl.trim()

  const openCropDialogForFile = (file: File, target: 'avatar' | 'siteIcon') => {
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    const objectUrl = URL.createObjectURL(file)
    setCropSourceUrl(objectUrl)
    setCropTarget(target)
    setCropDialogOpen(true)
  }

  const onAvatarSelected = (file?: File) => {
    if (!file) return
    openCropDialogForFile(file, 'avatar')
  }

  const onSiteIconSelected = (file?: File) => {
    if (!file) return
    openCropDialogForFile(file, 'siteIcon')
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="space-y-2">
        <Label>{t('webSettingsBasic.pageTitleLabel')}</Label>
        <Input
          value={form.pageTitle}
          maxLength={PAGE_TITLE_MAX_LEN}
          onChange={(event) => patch('pageTitle', event.target.value)}
          placeholder={DEFAULT_PAGE_TITLE}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsBasic.siteIconUrlLabel')}</Label>
        <Input
          value={form.siteIconUrl}
          onChange={(event) => patch('siteIconUrl', event.target.value)}
          placeholder={t('webSettingsBasic.siteIconUrlPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">{t('webSettingsBasic.siteIconUrlHint')}</p>
        <FileSelectTrigger
          accept="image/*"
          buttonLabel={t('common.selectFile')}
          emptyLabel={t('common.noFileSelected')}
          onSelect={onSiteIconSelected}
        />
        <AnimatePresence initial={false}>
          {siteIconPreviewUrl ? (
            <motion.div
              className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-3"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              <Image
                src={siteIconPreviewUrl}
                alt={t('webSettingsBasic.siteIconPreviewAlt')}
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-lg border border-border object-cover"
              />
              <span className="text-xs text-muted-foreground">
                {t('webSettingsBasic.siteIconPreview')}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-2">
          <Label>{t('webSettingsBasic.userNameLabel')}</Label>
          <Input value={form.userName} onChange={(event) => patch('userName', event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsBasic.userBioLabel')}</Label>
          <Input value={form.userBio} onChange={(event) => patch('userBio', event.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsBasic.userNoteLabel')}</Label>
        <Input value={form.userNote} onChange={(event) => patch('userNote', event.target.value)} />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="hitokoto-home-note-basic" className="font-normal cursor-pointer">
            {t('webSettingsBasic.hitokotoTitle')}
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('webSettingsBasic.hitokotoDescriptionPrefix')}{' '}
            <code className="rounded bg-muted px-1">v1.hitokoto.cn</code>。
          </p>
        </div>
        <Switch
          id="hitokoto-home-note-basic"
          checked={form.userNoteHitokotoEnabled}
          onCheckedChange={(value) => patch('userNoteHitokotoEnabled', value)}
          className="shrink-0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="theme-preset-basic">{t('webSettingsBasic.themePresetLabel')}</Label>
        <Select value={form.themePreset} onValueChange={(value) => patch('themePreset', value)}>
          <SelectTrigger id="theme-preset-basic" className="w-full">
            <SelectValue placeholder={t('webSettingsBasic.themePresetPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">{t('webSettingsBasic.themePresets.basic')}</SelectItem>
            <SelectItem value="obsidian">{t('webSettingsBasic.themePresets.obsidian')}</SelectItem>
            <SelectItem value="mono">{t('webSettingsBasic.themePresets.mono')}</SelectItem>
            <SelectItem value="midnight">{t('webSettingsBasic.themePresets.midnight')}</SelectItem>
            <SelectItem value="ocean">{t('webSettingsBasic.themePresets.ocean')}</SelectItem>
            <SelectItem value="nord">{t('webSettingsBasic.themePresets.nord')}</SelectItem>
            <SelectItem value="forest">{t('webSettingsBasic.themePresets.forest')}</SelectItem>
            <SelectItem value="sakura">{t('webSettingsBasic.themePresets.sakura')}</SelectItem>
            <SelectItem value="lavender">{t('webSettingsBasic.themePresets.lavender')}</SelectItem>
            <SelectItem value="amber">{t('webSettingsBasic.themePresets.amber')}</SelectItem>
            <SelectItem value="customSurface">{t('webSettingsBasic.themePresets.customSurface')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t('webSettingsBasic.themePresetHint')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsBasic.avatarUrlLabel')}</Label>
        <Input value={form.avatarUrl} onChange={(event) => patch('avatarUrl', event.target.value)} />
        <p className="text-xs text-muted-foreground">{t('webSettingsBasic.avatarUrlHint')}</p>
        <FileSelectTrigger
          accept="image/*"
          buttonLabel={t('common.selectFile')}
          emptyLabel={t('common.noFileSelected')}
          onSelect={onAvatarSelected}
        />
        <AnimatePresence initial={false}>
          {cropSourceUrl ? (
            <motion.div
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              <button
                type="button"
                onClick={() => setCropDialogOpen(true)}
                className="px-3 py-1.5 border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors"
              >
                {t('webSettingsBasic.reopenCrop')}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {avatarPreviewUrl ? (
            <motion.div
              className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-3"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              <Image
                src={avatarPreviewUrl}
                alt={t('webSettingsBasic.avatarPreviewAlt')}
                width={40}
                height={40}
                loading="eager"
                className="w-10 h-10 rounded-full border border-border object-cover"
              />
              <span className="text-xs text-muted-foreground">
                {t('webSettingsBasic.avatarPreview')}
                {form.avatarFetchByServerEnabled && avatarUsesRemoteUrl
                  ? t('webSettingsBasic.avatarPreviewFetchSuffix')
                  : ''}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-2">
          <Label>{t('webSettingsBasic.currentlyTextLabel')}</Label>
          <Input value={form.currentlyText} onChange={(event) => patch('currentlyText', event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsBasic.earlierTextLabel')}</Label>
          <Input value={form.earlierText} onChange={(event) => patch('earlierText', event.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsBasic.adminTextLabel')}</Label>
        <Input value={form.adminText} onChange={(event) => patch('adminText', event.target.value)} />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.pageLockEnabled}
            onChange={(event) => patch('pageLockEnabled', event.target.checked)}
          />
          {t('webSettingsBasic.pageLockEnabledLabel')}
        </Label>
        <Input
          type="password"
          placeholder={t('webSettingsBasic.pageLockPasswordPlaceholder')}
          value={form.pageLockPassword}
          onChange={(event) => patch('pageLockPassword', event.target.value)}
        />
      </div>
    </div>
  )
}
