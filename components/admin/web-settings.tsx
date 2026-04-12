'use client'

import { Provider } from 'jotai'
import { createStore } from 'jotai/vanilla'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
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
  const prefersReducedMotion = Boolean(useReducedMotion())
  const {
    applyImportConfig,
    confirmImportConfig,
    copyExportConfig,
    copyPlainText,
    cropDialogOpen,
    cropSourceUrl,
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
    return <div className="text-sm text-muted-foreground">加载配置中...</div>
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-5 sm:rounded-xl sm:border sm:bg-card sm:p-6">
        <section className="hidden rounded-2xl border border-border/60 bg-muted/[0.06] px-4 py-4 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-1">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">后台外观</h3>
            <p className="text-xs leading-6 text-muted-foreground">
              这里切换的是当前设备上的后台明暗模式，不会改动前台站点主题，也不会影响访客看到的页面风格。
            </p>
          </div>
          <div className="shrink-0">
            <ThemeModeToggle />
          </div>
        </section>

        <Tabs defaultValue="basic" className="space-y-4 sm:space-y-5">
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-fit">
            <TabsTrigger value="basic" className="w-full">
              基础设置
            </TabsTrigger>
            <TabsTrigger value="advanced" className="w-full">
              进阶设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 sm:space-y-5">
            <WebSettingsBasicPanel />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 sm:space-y-5">
            <WebSettingsSection
              title="平台与访问"
              description="控制调试能力、接口开放范围、头像资源代理与后台访问验证。"
            >
              {avatarUsesRemoteUrl ? (
                <WebSettingsRows>
                  <WebSettingsRow
                    htmlFor="avatar-fetch-by-server"
                    title="检测到远程头像 URL，是否允许通过服务器获取头像？"
                    description={
                      <>
                        开启后首页与后台预览会改为请求本站{' '}
                        <code className="rounded bg-muted px-1">/api/avatar</code>
                        ，访客浏览器不再直接访问第三方图床。
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
              title="前台展示"
              description="调整首页观感、文案来源、主题细节与自定义样式。"
            >
              <WebSettingsHitokotoPanel />

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
                <Label>自定义 CSS 覆写（主界面）</Label>
                <textarea
                  rows={8}
                  value={form.customCss}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, customCss: event.target.value }))
                  }
                  className="w-full rounded-md border bg-background px-2.5 py-2 text-sm font-mono sm:px-3"
                  placeholder="示例：:root { --primary: oklch(0.5 0.2 30); }"
                />
                <p className="text-xs text-muted-foreground">
                  保存后会注入页面并覆盖默认样式，可用于快速主题定制。
                </p>
              </WebSettingsInset>
            </WebSettingsSection>

            <WebSettingsSection
              title="运行与采集"
              description="控制活动流、缓存、设备接入和前台状态展示行为。"
            >
              <WebSettingsActivityPanel />
              <WebSettingsRuleTools />
            </WebSettingsSection>

            <WebSettingsSection
              title="导入导出"
              description="用于迁移或快速接入当前网页配置，不影响底部的统一保存流程。"
              bodyClassName="space-y-4 sm:border-dashed sm:bg-background/40"
            >
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => void copyExportConfig()}>
                  一键复制接入配置（Base64）
                </Button>
                <Button type="button" variant="outline" onClick={() => void applyImportConfig()}>
                  一键写入配置
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                「一键写入配置」会尝试从剪贴板读取 Base64，并在弹窗中确认。仅合并导出包中的网页字段到本页表单，不包含 Token；
                写入后请用底部悬浮条保存。
              </p>
            </WebSettingsSection>
          </TabsContent>
        </Tabs>

        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={(open) => {
            setCropDialogOpen(open)
            if (!open) {
              setCropSourceUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return null
              })
            }
          }}
          sourceUrl={cropSourceUrl}
          aspectMode="square"
          outputSize={128}
          title="裁剪头像"
          description="拖动选区或边角调整范围，确认后生成 128×128 头像。"
          onComplete={(dataUrl) => setForm((prev) => ({ ...prev, avatarUrl: dataUrl }))}
        />
      </div>

      <Dialog open={importConfigDialogOpen} onOpenChange={setImportConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入网页配置</DialogTitle>
            <DialogDescription>
              将用导入包中的「网页配置」覆盖当前表单（不含页面锁密码、不含 API Token）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="import-config-input">Base64 接入配置</Label>
            <Input
              id="import-config-input"
              value={importConfigInput}
              onChange={(event) => setImportConfigInput(event.target.value)}
              placeholder="粘贴「一键复制接入配置」导出的 Base64 全文"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">导入时会自动忽略空格与换行。</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportConfigDialogOpen(false)}
            >
              取消
            </Button>
            <Button type="button" onClick={confirmImportConfig}>
              导入并覆盖网页配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnsavedChangesBar
        open={webSettingsDirty}
        saving={saving}
        onSave={save}
        onRevert={revertUnsavedWebSettings}
        saveLabel="保存配置"
        revertLabel="撤销"
      />
    </>
  )
}
