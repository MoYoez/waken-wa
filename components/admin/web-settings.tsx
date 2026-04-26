'use client'

import { Provider } from 'jotai'
import { createStore } from 'jotai/vanilla'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useMemo } from 'react'

import { AdminLanguageToggle } from '@/components/admin/admin-language-toggle'
import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import { AdminThemeColorControl } from '@/components/admin/admin-theme-color-control'
import { ImageCropDialog } from '@/components/admin/image-crop-dialog'
import { UnsavedChangesBar } from '@/components/admin/unsaved-changes-bar'
import { useWebSettingsController } from '@/components/admin/use-web-settings-controller'
import { WebSettingsActivityPanel } from '@/components/admin/web-settings-activity-panel'
import { WebSettingsBasicPanel } from '@/components/admin/web-settings-basic-panel'
import { WebSettingsCustomSurface } from '@/components/admin/web-settings-custom-surface'
import { WebSettingsHitokotoPanel } from '@/components/admin/web-settings-hitokoto-panel'
import {
  WebSettingsInset,
  WebSettingsRow,
  WebSettingsRows,
  WebSettingsSection,
} from '@/components/admin/web-settings-layout'
import { WebSettingsOpenApiPanel } from '@/components/admin/web-settings-openapi-panel'
import { WebSettingsPublicFontsPanel } from '@/components/admin/web-settings-public-fonts-panel'
import { WebSettingsRuleTools } from '@/components/admin/web-settings-rule-tools'
import { WebSettingsSecurityPanel } from '@/components/admin/web-settings-security-panel'
import { WebSettingsSkillsPanel } from '@/components/admin/web-settings-skills-panel'
import { ThemeModeToggle } from '@/components/theme-mode-toggle'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'

export function WebSettings() {
  const store = useMemo(() => createStore(), [])
  return (
    <Provider store={store}>
      <WebSettingsContent />
    </Provider>
  )
}

function WebSettingsContent() {
  const { t: tCommon } = useT('common')
  const { t } = useT('admin')
  const prefersReducedMotion = Boolean(useReducedMotion())
  const {
    applyImportConfig,
    confirmImportConfig,
    copyExportConfig,
    copyPlainText,
    cropDialogOpen,
    cropSourceUrl,
    cropTarget,
    form,
    importConfigDialogOpen,
    importConfigInput,
    loading,
    revertUnsavedWebSettings,
    revokeSkillsOauthByAiClientId,
    save,
    saveSkillsConfig,
    saving,
    setCropDialogOpen,
    setCropSourceUrl,
    setCropTarget,
    setForm,
    setImportConfigDialogOpen,
    setImportConfigInput,
    webSettingsDirty,
  } = useWebSettingsController()
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 12,
    exitY: 8,
    scale: 0.996,
  })
  const avatarUsesRemoteUrl = isRemoteAvatarUrl(form.avatarUrl)

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('webSettings.loading')}</div>
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-5 sm:rounded-xl sm:border sm:bg-card sm:p-6 [&_label[data-slot=label]]:leading-5">
        <section className="space-y-3">
          <div className="rounded-2xl border border-border/60 bg-muted/[0.06] px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <div className="max-w-2xl space-y-1">
                <h3 className="text-sm font-semibold tracking-wide text-foreground">
                  {t('webSettings.adminAppearanceTitle')}
                </h3>
                <p className="text-xs leading-6 text-muted-foreground">
                  {t('webSettings.adminAppearanceDescription')}
                </p>
              </div>
              <div className="hidden items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/70 px-4 py-3 lg:flex">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {t('webSettings.adminThemeModeLabel')}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t('webSettings.adminThemeModeHint')}
                  </p>
                </div>
                <ThemeModeToggle className="shrink-0" />
              </div>
              <AdminThemeColorControl
                themeColor={form.adminThemeColor}
                backgroundColor={form.adminBackgroundColor}
                onThemeColorChange={(value) =>
                  setForm((prev) => ({ ...prev, adminThemeColor: value }))
                }
                onBackgroundColorChange={(value) =>
                  setForm((prev) => ({ ...prev, adminBackgroundColor: value }))
                }
              />
            </div>
          </div>
          <div className="hidden rounded-2xl border border-border/60 bg-muted/[0.06] px-5 py-5 lg:block">
            <div className="space-y-4">
              <div className="max-w-2xl space-y-1">
                <h3 className="text-sm font-semibold tracking-wide text-foreground">
                  {tCommon('admin.language.title')}
                </h3>
                <p className="text-xs leading-6 text-muted-foreground">
                  {tCommon('admin.language.description')}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <AdminLanguageToggle />
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="basic" className="space-y-4 sm:space-y-5">
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-fit">
            <TabsTrigger value="basic" className="w-full">
              {t('webSettings.tabs.basic')}
            </TabsTrigger>
            <TabsTrigger value="advanced" className="w-full">
              {t('webSettings.tabs.advanced')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 sm:space-y-5">
            <WebSettingsBasicPanel />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 sm:space-y-5">
            <WebSettingsSection
              title={t('webSettings.sections.platform.title')}
              description={t('webSettings.sections.platform.description')}
            >
              {avatarUsesRemoteUrl ? (
                <WebSettingsRows>
                  <WebSettingsRow
                    htmlFor="avatar-fetch-by-server"
                    title={t('webSettings.remoteAvatar.title')}
                    description={
                      <>
                        {t('webSettings.remoteAvatar.descriptionPrefix')}{' '}
                        <code className="rounded bg-muted px-1">/api/avatar</code>
                        {t('webSettings.remoteAvatar.descriptionSuffix')}
                      </>
                    }
                    action={
                      <Switch
                        id="avatar-fetch-by-server"
                        checked={form.avatarFetchByServerEnabled}
                        onCheckedChange={(value) =>
                          setForm((prev) => ({ ...prev, avatarFetchByServerEnabled: value }))
                        }
                        className="shrink-0"
                      />
                    }
                  />
                </WebSettingsRows>
              ) : null}
              <WebSettingsSkillsPanel
                onSaveSkillsConfig={(options) => saveSkillsConfig(options)}
                onRevokeSkillsOauthByAiClientId={revokeSkillsOauthByAiClientId}
                onCopyPlainText={copyPlainText}
              />

              <div className="grid gap-4 xl:grid-cols-2">
                <WebSettingsOpenApiPanel />
                <WebSettingsSecurityPanel />
              </div>
            </WebSettingsSection>

            <WebSettingsSection
              title={t('webSettings.sections.frontend.title')}
              description={t('webSettings.sections.frontend.description')}
            >
              <WebSettingsHitokotoPanel />
              <WebSettingsPublicFontsPanel />

              <AnimatePresence initial={false}>
                {form.themePreset === 'customSurface' ? (
                  <motion.div
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                    layout
                  >
                    <WebSettingsCustomSurface />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <WebSettingsInset className="space-y-2">
                <Label>{t('webSettings.customCss.label')}</Label>
                <textarea
                  rows={8}
                  value={form.customCss}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, customCss: event.target.value }))
                  }
                  className="w-full rounded-md border bg-background px-2.5 py-2 text-sm font-mono sm:px-3"
                  placeholder={t('webSettings.customCss.placeholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('webSettings.customCss.hint')}
                </p>
              </WebSettingsInset>
            </WebSettingsSection>

            <WebSettingsSection
              title={t('webSettings.sections.runtime.title')}
              description={t('webSettings.sections.runtime.description')}
            >
              <WebSettingsActivityPanel />
              <WebSettingsRuleTools />
            </WebSettingsSection>

            <WebSettingsSection
              title={t('webSettings.sections.importExport.title')}
              description={t('webSettings.sections.importExport.description')}
              bodyClassName="space-y-4 sm:border-dashed sm:bg-background/40"
            >
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => void copyExportConfig()}>
                  {t('webSettings.importExport.copyBundle')}
                </Button>
                <Button type="button" variant="outline" onClick={() => void applyImportConfig()}>
                  {t('webSettings.importExport.applyBundle')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('webSettings.importExport.hint')}
              </p>
            </WebSettingsSection>
          </TabsContent>
        </Tabs>

        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={(open) => {
            setCropDialogOpen(open)
            if (!open) {
              setCropTarget('avatar')
              setCropSourceUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return null
              })
            }
          }}
          sourceUrl={cropSourceUrl}
          aspectMode="square"
          outputSize={128}
          outputFormat="png"
          title={
            cropTarget === 'siteIcon'
              ? t('setup.cropSiteIconTitle')
              : t('setup.cropAvatarTitle')
          }
          description={
            cropTarget === 'siteIcon'
              ? t('setup.cropSiteIconDescription')
              : t('setup.cropAvatarDescription')
          }
          onComplete={(dataUrl) =>
            setForm((prev) => ({
              ...prev,
              ...(cropTarget === 'siteIcon'
                ? { siteIconUrl: dataUrl }
                : { avatarUrl: dataUrl }),
            }))
          }
        />
      </div>

      <Dialog open={importConfigDialogOpen} onOpenChange={setImportConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('webSettings.importDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('webSettings.importDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="import-config-input">{t('webSettings.importDialog.bundleLabel')}</Label>
            <Input
              id="import-config-input"
              value={importConfigInput}
              onChange={(event) => setImportConfigInput(event.target.value)}
              placeholder={t('webSettings.importDialog.placeholder')}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">{t('webSettings.importDialog.hint')}</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportConfigDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={confirmImportConfig}>
              {t('webSettings.importDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnsavedChangesBar
        open={webSettingsDirty}
        saving={saving}
        onSave={save}
        onRevert={revertUnsavedWebSettings}
        saveLabel={t('webSettings.saveConfig')}
        revertLabel={t('unsavedChanges.revert')}
      />
    </>
  )
}
