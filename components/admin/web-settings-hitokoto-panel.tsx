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
  WebSettingsRows,
} from '@/components/admin/web-settings-layout'
import { webSettingsFormAtom } from '@/components/admin/web-settings-store'
import { Checkbox } from '@/components/ui/checkbox'
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
import { HITOKOTO_CATEGORY_OPTIONS } from '@/lib/hitokoto'

export function WebSettingsHitokotoPanel() {
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
    <div className="space-y-4">
      <WebSettingsRows>
        <WebSettingsRow
          htmlFor="page-loading-toggle"
          title={t('webSettingsHitokoto.pageLoadingTitle')}
          description={t('webSettingsHitokoto.pageLoadingDescription')}
          action={
            <Switch
              id="page-loading-toggle"
              checked={form.pageLoadingEnabled}
              onCheckedChange={(value) => patch('pageLoadingEnabled', value)}
            />
          }
        />
        <WebSettingsRow
          htmlFor="search-engine-indexing-toggle"
          title={t('webSettingsHitokoto.searchEngineIndexingTitle')}
          description={t('webSettingsHitokoto.searchEngineIndexingDescription')}
          action={
            <Switch
              id="search-engine-indexing-toggle"
              checked={form.searchEngineIndexingEnabled}
              onCheckedChange={(value) => patch('searchEngineIndexingEnabled', value)}
            />
          }
        />
        <WebSettingsRow
          htmlFor="note-typewriter-toggle"
          title={t('webSettingsHitokoto.noteTypewriterTitle')}
          description={t('webSettingsHitokoto.noteTypewriterDescription')}
          action={
            <Switch
              id="note-typewriter-toggle"
              checked={form.userNoteTypewriterEnabled}
              onCheckedChange={(value) => patch('userNoteTypewriterEnabled', value)}
            />
          }
        />
        <WebSettingsRow
          htmlFor="hitokoto-home-note"
          title={t('webSettingsHitokoto.hitokotoTitle')}
          description={
            <>
              {t('webSettingsHitokoto.hitokotoDescriptionPrefix')}{' '}
              <code className="rounded bg-muted px-1">v1.hitokoto.cn</code>
              {t('webSettingsHitokoto.hitokotoDescriptionSuffix')}
            </>
          }
          action={
            <Switch
              id="hitokoto-home-note"
              checked={form.userNoteHitokotoEnabled}
              onCheckedChange={(value) => patch('userNoteHitokotoEnabled', value)}
            />
          }
        />
      </WebSettingsRows>

      <WebSettingsInset className="space-y-4">
        <WebSettingsRows className="rounded-lg">
          <WebSettingsRow
            htmlFor="user-note-signature-font-toggle"
            title={t('webSettingsBasic.userNoteSignatureFontTitle')}
            description={t('webSettingsBasic.userNoteSignatureFontDescription')}
            action={
              <Switch
                id="user-note-signature-font-toggle"
                checked={form.userNoteSignatureFontEnabled}
                onCheckedChange={(value) => patch('userNoteSignatureFontEnabled', value)}
              />
            }
          />
        </WebSettingsRows>

        <AnimatePresence initial={false}>
          {form.userNoteSignatureFontEnabled ? (
            <motion.div
              className="space-y-2"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              <Label htmlFor="user-note-signature-font-family">
                {t('webSettingsBasic.userNoteSignatureFontFamilyLabel')}
              </Label>
              <Input
                id="user-note-signature-font-family"
                value={form.userNoteSignatureFontFamily}
                onChange={(event) =>
                  patch('userNoteSignatureFontFamily', event.target.value.slice(0, 160))
                }
                placeholder={t('webSettingsBasic.userNoteSignatureFontFamilyPlaceholder')}
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('webSettingsBasic.userNoteSignatureFontFamilyHint')}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </WebSettingsInset>

      <AnimatePresence initial={false}>
        {form.userNoteHitokotoEnabled ? (
          <motion.div
            className="space-y-4"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
            <WebSettingsInset className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hitokoto-encode">{t('webSettingsHitokoto.encodeLabel')}</Label>
                <Select
                  value={form.userNoteHitokotoEncode}
                  onValueChange={(value) =>
                    patch('userNoteHitokotoEncode', value === 'text' ? 'text' : 'json')
                  }
                >
                  <SelectTrigger id="hitokoto-encode" className="w-full sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">{t('webSettingsHitokoto.encodeOptions.json')}</SelectItem>
                    <SelectItem value="text">{t('webSettingsHitokoto.encodeOptions.text')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <WebSettingsRows className="rounded-lg">
                <WebSettingsRow
                  htmlFor="hitokoto-home-note-fallback"
                  title={t('webSettingsHitokoto.fallbackTitle')}
                  description={t('webSettingsHitokoto.fallbackDescription')}
                  action={
                    <Switch
                      id="hitokoto-home-note-fallback"
                      checked={form.userNoteHitokotoFallbackToNote}
                      onCheckedChange={(value) =>
                        patch('userNoteHitokotoFallbackToNote', value)
                      }
                    />
                  }
                />
              </WebSettingsRows>

              <div className="space-y-2">
                <Label>{t('webSettingsHitokoto.categoriesLabel')}</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {HITOKOTO_CATEGORY_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                    >
                      <Checkbox
                        checked={form.userNoteHitokotoCategories.includes(option.id)}
                        onCheckedChange={(value) => {
                          const checked = value === true
                          const next = checked
                            ? Array.from(new Set([...form.userNoteHitokotoCategories, option.id]))
                            : form.userNoteHitokotoCategories.filter((item) => item !== option.id)
                          patch('userNoteHitokotoCategories', next)
                        }}
                      />
                      <span>
                        {option.id} · {t(`webSettingsHitokoto.categories.${option.id}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </WebSettingsInset>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
