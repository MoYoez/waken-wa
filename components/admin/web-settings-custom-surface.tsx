'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import { WebSettingsInset } from '@/components/admin/web-settings-layout'
import { webSettingsFormAtom } from '@/components/admin/web-settings-store'
import type { ThemeCustomSurfaceForm } from '@/components/admin/web-settings-types'
import { hasThemeImageSourceConfigured } from '@/components/admin/web-settings-utils'
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
import { THEME_CUSTOM_SURFACE_DEFAULTS } from '@/lib/theme-custom-surface'
import { extractThemeSurfaceFromImage } from '@/lib/theme-image-palette'
import { resolveThemeSurfaceActiveImage } from '@/lib/theme-image-source'

export function WebSettingsCustomSurface() {
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const value = form.themeCustomSurface
  const [backgroundImageInput, setBackgroundImageInput] = useState('')
  const [themePreviewImageUrl, setThemePreviewImageUrl] = useState('')
  const [themePreviewLoading, setThemePreviewLoading] = useState(false)
  const [themePaletteApplying, setThemePaletteApplying] = useState(false)
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  const setThemeCustomSurface = (next: ThemeCustomSurfaceForm) => {
    setForm((prev) => ({ ...prev, themeCustomSurface: next }))
  }

  const patchThemeSurface = <K extends keyof ThemeCustomSurfaceForm>(
    key: K,
    fieldValue: ThemeCustomSurfaceForm[K],
  ) => {
    setThemeCustomSurface({ ...value, [key]: fieldValue })
  }

  const patchThemeSurfaceImageAware = (patches: Partial<ThemeCustomSurfaceForm>) => {
    const nextThemeCustomSurface = {
      ...value,
      ...patches,
    }
    const hadImageSource = hasThemeImageSourceConfigured(value)
    const hasImageSource = hasThemeImageSourceConfigured(nextThemeCustomSurface)
    if (!hadImageSource && hasImageSource) {
      nextThemeCustomSurface.hideFloatingOrbs = true
      nextThemeCustomSurface.transparentAnimatedBg = true
    }
    setThemeCustomSurface(nextThemeCustomSurface)
  }

  const currentThemePreviewHint = useMemo(() => {
    if (value.backgroundImageMode === 'manual') {
      return value.backgroundImageUrl.trim()
    }
    if (value.backgroundImageMode === 'randomPool') {
      return value.backgroundImagePool[0] ?? ''
    }
    return value.backgroundRandomApiUrl.trim()
  }, [
    value.backgroundImageMode,
    value.backgroundImagePool,
    value.backgroundImageUrl,
    value.backgroundRandomApiUrl,
  ])

  useEffect(() => {
    setThemePreviewImageUrl('')
    setThemePreviewLoading(false)
  }, [
    value.backgroundImageMode,
    value.backgroundImageUrl,
    value.backgroundImagePool,
    value.backgroundRandomApiUrl,
  ])

  useEffect(() => {
    if (value.backgroundImageMode === 'manual') {
      setBackgroundImageInput(value.backgroundImageUrl)
      return
    }
    if (value.backgroundImageMode === 'randomApi') {
      setBackgroundImageInput(value.backgroundRandomApiUrl)
      return
    }
    setBackgroundImageInput('')
  }, [
    value.backgroundImageMode,
    value.backgroundImageUrl,
    value.backgroundRandomApiUrl,
  ])

  const resolveThemePreviewImage = async () => {
    setThemePreviewLoading(true)
    try {
      const url = await resolveThemeSurfaceActiveImage(value)
      setThemePreviewImageUrl(url)
      if (!url) {
        toast.error('当前背景源还没有可用图片')
      }
      return url
    } catch {
      toast.error('预览背景解析失败')
      return ''
    } finally {
      setThemePreviewLoading(false)
    }
  }

  const applyPaletteFromCurrentThemeImage = async () => {
    setThemePaletteApplying(true)
    try {
      const imageUrl = themePreviewImageUrl || (await resolveThemePreviewImage())
      if (!imageUrl) return
      const nextTheme = await extractThemeSurfaceFromImage(imageUrl)
      setThemeCustomSurface({
        ...value,
        ...nextTheme,
        paletteLiveScope: value.paletteLiveScope,
        paletteLiveEnabled: value.paletteLiveEnabled,
      })
      setThemePreviewImageUrl(imageUrl)
      toast.success('已按当前背景生成整套主题色，请记得保存')
    } catch {
      toast.error('取色失败：图片可能不支持跨域像素读取')
    } finally {
      setThemePaletteApplying(false)
    }
  }

  const addThemeBackgroundImage = () => {
    const nextValue = backgroundImageInput.trim()
    if (!nextValue) return

    if (value.backgroundImageMode === 'randomPool') {
      const exists = value.backgroundImagePool.some((item) => item === nextValue)
      if (exists) {
        toast.error('该图片已在随机池中')
        return
      }
      patchThemeSurfaceImageAware({
        backgroundImagePool: [...value.backgroundImagePool, nextValue],
      })
      setBackgroundImageInput('')
      return
    }

    patchThemeSurfaceImageAware({ backgroundImageUrl: nextValue })
    setBackgroundImageInput(nextValue)
  }

  const onThemeBackgroundFileSelected = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        toast.error('读取图片失败')
        return
      }
      if (value.backgroundImageMode === 'randomPool') {
        patchThemeSurfaceImageAware({
          backgroundImagePool: [...value.backgroundImagePool, result],
        })
      } else {
        patchThemeSurfaceImageAware({ backgroundImageUrl: result })
      }
      setBackgroundImageInput('')
      setThemePreviewImageUrl(result)
    }
    reader.onerror = () => {
      toast.error('读取图片失败')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        留空则使用内置暖色默认。支持 oklch()、#hex、linear-gradient、以及安全的{' '}
        <code className="rounded bg-muted px-1">url()</code>
        背景图：可使用 <code className="rounded bg-muted px-1">https://…</code>、
        <code className="rounded bg-muted px-1">http://…</code>、站内路径{' '}
        <code className="rounded bg-muted px-1">/images/bg.jpg</code>、相对路径{' '}
        <code className="rounded bg-muted px-1">./a.png</code>，或{' '}
        <code className="rounded bg-muted px-1">data:image/…;base64,…</code>
        （勿在地址里含未转义的右括号）。仍会过滤尖括号、花括号、@import 等。
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        上面列出的多行是「各字段示例」，请分别填进对应输入框，不要把整段粘进某一个框。
        <code className="rounded bg-muted px-1">url(&quot;…&quot;)</code> 与后面的渐变要写在「动效背景层」里，用英文逗号连成一条{' '}
        <code className="rounded bg-muted px-1">background</code> 值（第一层画在最上）。
        「整页 background」写在 <code className="rounded bg-muted px-1">body</code> 上，与「页面底色」分开。
        主题预设必须选 Custom surface，保存后才会注入首页。
      </p>
      <WebSettingsInset className="space-y-4">
        <div className="space-y-2">
          <Label>背景来源</Label>
          <Select
            value={value.backgroundImageMode}
            onValueChange={(nextValue) =>
              patchThemeSurface(
                'backgroundImageMode',
                nextValue === 'randomPool' || nextValue === 'randomApi' ? nextValue : 'manual',
              )
            }
          >
            <SelectTrigger className="w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">固定图片</SelectItem>
              <SelectItem value="randomPool">随机图片池</SelectItem>
              <SelectItem value="randomApi">随机图片 API</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground leading-relaxed">
            固定图片会直接作为 <code className="rounded bg-muted px-1">body background</code>；
            随机图片池与随机 API 支持前台实时换图，也能联动实时取色。
          </p>
        </div>

        <AnimatePresence initial={false} mode="wait">
          {value.backgroundImageMode === 'manual' ? (
            <motion.div
              key="theme-surface-manual"
              className="space-y-3"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
            <div className="space-y-2">
              <Label>固定背景图片 URL / DataURL</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Input
                  value={backgroundImageInput}
                  onChange={(e) => {
                    setBackgroundImageInput(e.target.value)
                    patchThemeSurfaceImageAware({ backgroundImageUrl: e.target.value })
                  }}
                  placeholder="https://… / /images/bg.jpg / data:image/..."
                  className="min-w-0 basis-full flex-1 font-mono text-xs sm:min-w-[18rem] sm:basis-auto"
                />
                <Button type="button" variant="outline" onClick={() => setThemePreviewImageUrl(backgroundImageInput.trim())}>
                  使用此图预览
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>从本地导入背景图</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  onThemeBackgroundFileSelected(e.target.files?.[0])
                  e.target.value = ''
                }}
                className="w-full cursor-pointer text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted/50 file:px-2.5 sm:file:px-3 file:py-1.5 file:text-foreground hover:file:bg-muted"
              />
            </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="wait">
          {value.backgroundImageMode === 'randomPool' ? (
            <motion.div
              key="theme-surface-random-pool"
              className="space-y-3"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
            <div className="space-y-2">
              <Label>随机图片池</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={backgroundImageInput}
                  onChange={(e) => setBackgroundImageInput(e.target.value)}
                  placeholder="添加 URL / DataURL 到随机图片池"
                  className="min-w-0 basis-full flex-1 font-mono text-xs sm:min-w-[18rem] sm:basis-auto"
                />
                <Button type="button" onClick={addThemeBackgroundImage}>
                  添加到图片池
                </Button>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                onThemeBackgroundFileSelected(e.target.files?.[0])
                e.target.value = ''
              }}
              className="w-full cursor-pointer text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted/50 file:px-2.5 sm:file:px-3 file:py-1.5 file:text-foreground hover:file:bg-muted"
            />
            {value.backgroundImagePool.length > 0 ? (
              <motion.div
                className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-background/60 p-2.5 sm:p-3"
                layout
              >
                <AnimatePresence initial={false}>
                  {value.backgroundImagePool.map((item, index) => (
                    <motion.div
                      key={`${item.slice(0, 32)}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-2.5 py-2 sm:px-3"
                      variants={sectionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={sectionTransition}
                      layout
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-xs text-foreground"
                        onClick={() => setThemePreviewImageUrl(item)}
                      >
                        {item}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() =>
                          patchThemeSurface(
                            'backgroundImagePool',
                            value.backgroundImagePool.filter((_, i) => i !== index),
                          )
                        }
                      >
                        删除
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <p className="text-xs text-muted-foreground">随机图片池为空时，前台不会有可切换图片。</p>
            )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="wait">
          {value.backgroundImageMode === 'randomApi' ? (
            <motion.div
              key="theme-surface-random-api"
              className="space-y-3"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
            <div className="space-y-2">
              <Label>随机图片 API</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={backgroundImageInput}
                  onChange={(e) => {
                    setBackgroundImageInput(e.target.value)
                    patchThemeSurfaceImageAware({
                      backgroundRandomApiUrl: e.target.value,
                    })
                  }}
                  placeholder="https://api.example.com/random-image"
                  className="min-w-0 basis-full flex-1 font-mono text-xs sm:min-w-[18rem] sm:basis-auto"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => void resolveThemePreviewImage()}
                >
                  拉取一张预览图
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                优先支持直接返回图片，或返回包含 <code className="rounded bg-muted px-1">url</code> /
                <code className="rounded bg-muted px-1">image</code> /
                <code className="rounded bg-muted px-1">urls.regular</code> 的 JSON。
              </p>
            </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void resolveThemePreviewImage()}
                disabled={themePreviewLoading}
              >
                {themePreviewLoading ? '生成预览中…' : '生成当前背景预览'}
              </Button>
              <Button
                type="button"
                onClick={() => void applyPaletteFromCurrentThemeImage()}
                disabled={themePaletteApplying || themePreviewLoading}
              >
                {themePaletteApplying ? '取色中…' : '根据当前背景取色'}
              </Button>
            </div>
            <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">启用实时取色</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  仅对随机图片池 / 随机图片 API 生效。首屏先用已保存主题，图片加载完成后再覆盖成当前图片的配色。
                </p>
              </div>
              <Switch
                checked={value.paletteLiveEnabled}
                onCheckedChange={(checked) => patchThemeSurface('paletteLiveEnabled', checked)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>取色模式</Label>
                <Select
                  value={value.paletteMode}
                  onValueChange={(nextValue) =>
                    patchThemeSurface(
                      'paletteMode',
                      nextValue === 'applyFromCurrent' || nextValue === 'liveFromImage'
                        ? nextValue
                        : 'manual',
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">手动维护</SelectItem>
                    <SelectItem value="applyFromCurrent">按钮覆盖当前主题</SelectItem>
                    <SelectItem value="liveFromImage">随机图实时取色</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>实时取色范围</Label>
                <Select
                  value={value.paletteLiveScope}
                  onValueChange={(nextValue) =>
                    patchThemeSurface(
                      'paletteLiveScope',
                      nextValue === 'randomOnly' ? nextValue : 'randomOnly',
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="randomOnly">仅随机图片源</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="break-all text-xs text-muted-foreground leading-relaxed">
              最近一次按钮取色的图片：{value.paletteSeedImageUrl || '暂无'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">当前背景预览</p>
              <p className="break-all text-xs text-muted-foreground">
                {themePreviewImageUrl || currentThemePreviewHint || '还没有可预览的图片'}
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
              <AnimatePresence initial={false} mode="wait">
                {themePreviewImageUrl ? (
                  <motion.div
                    key="theme-preview-image"
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin preview supports arbitrary URLs/data URLs */}
                    <img
                      src={themePreviewImageUrl}
                      alt="背景预览"
                      className="h-48 w-full object-cover"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="theme-preview-empty"
                    className="flex h-48 items-center justify-center px-3 sm:px-4 text-center text-xs text-muted-foreground"
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={sectionTransition}
                  >
                    点击“生成当前背景预览”后，这里会显示本次用于取色的背景图。
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                ['background', value.background],
                ['primary', value.primary],
                ['accent', value.accent],
                ['card', value.card],
              ].map(([label, color]) => (
                <div key={label} className="space-y-1">
                  <div
                    className="h-10 rounded-md border border-border/60"
                    style={{ background: String(color || 'transparent') }}
                  />
                  <p className="truncate text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WebSettingsInset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>页面底色（仅 background-color / 令牌）</Label>
          <p className="text-xs text-muted-foreground">
            对应 <code className="rounded bg-muted px-1">--background</code>、
            <code className="rounded bg-muted px-1">--color-background</code>
            ，供 Tailwind <code className="rounded bg-muted px-1">bg-background</code> 等使用；不会生成{' '}
            <code className="rounded bg-muted px-1">background:</code> 简写。全屏的{' '}
            <code className="rounded bg-muted px-1">.animated-bg</code> 叠在{' '}
            <code className="rounded bg-muted px-1">body</code> 上面：若下面「动效背景层」留空，仍会使用内置暖色渐变盖住这里，看起来像「没改底色」。
          </p>
          <Input
            value={value.background}
            onChange={(e) => patchThemeSurface('background', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.background}
            className="max-w-xl font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>主色 (--primary)</Label>
          <Input
            value={value.primary}
            onChange={(e) => patchThemeSurface('primary', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.primary}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>正文色 (--foreground)</Label>
          <Input
            value={value.foreground}
            onChange={(e) => patchThemeSurface('foreground', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.foreground}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>次级底色 (--secondary)</Label>
          <Input
            value={value.secondary}
            onChange={(e) => patchThemeSurface('secondary', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.secondary}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>强调色 (--accent)</Label>
          <Input
            value={value.accent}
            onChange={(e) => patchThemeSurface('accent', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.accent}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>卡片底色 (--card)</Label>
          <Input
            value={value.card}
            onChange={(e) => patchThemeSurface('card', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.card}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>边框 (--border)</Label>
          <Input
            value={value.border}
            onChange={(e) => patchThemeSurface('border', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.border}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>弱化底色 (--muted)</Label>
          <Input
            value={value.muted}
            onChange={(e) => patchThemeSurface('muted', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.muted}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>次要文字 (--muted-foreground)</Label>
          <Input
            value={value.mutedForeground}
            onChange={(e) => patchThemeSurface('mutedForeground', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.mutedForeground}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>在线强调 (--online)</Label>
          <Input
            value={value.online}
            onChange={(e) => patchThemeSurface('online', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.online}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>全局圆角 (--radius)</Label>
          <Input
            value={value.radius}
            onChange={(e) => patchThemeSurface('radius', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.radius}
            className="max-w-xs font-mono text-xs"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>整页 background（body）</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          注入为 <code className="rounded bg-muted px-1">body</code> 的{' '}
          <code className="rounded bg-muted px-1">background:</code> 简写（渐变、
          <code className="rounded bg-muted px-1">url()</code>、多图层）。与上一项「页面底色」独立；留空则不写。
        </p>
        <textarea
          rows={4}
          value={value.bodyBackground}
          onChange={(e) => patchThemeSurface('bodyBackground', e.target.value)}
          placeholder='e.g. url("https://…") center/cover no-repeat, linear-gradient(168deg, oklch(0.98 0.01 82), oklch(0.94 0.02 78))'
          className="w-full rounded-md border bg-background px-2.5 py-2 text-xs font-mono leading-relaxed sm:px-3"
        />
      </div>
      <div className="space-y-2">
        <Label>动效背景层 (.animated-bg)</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          固定全屏、在正文后面；留空时使用下方三组默认颜色生成的首页渐变。只想让「页面底色」或「整页 background」露出来请勾选下一项。
        </p>
        <Label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={value.transparentAnimatedBg}
            onChange={(e) => patchThemeSurface('transparentAnimatedBg', e.target.checked)}
          />
          <span className="text-sm">关闭动效渐变层（本层透明，只见页面底色 / body 背景）</span>
        </Label>
        <textarea
          rows={5}
          value={value.animatedBg}
          onChange={(e) => patchThemeSurface('animatedBg', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBg}
          disabled={value.transparentAnimatedBg}
          className="w-full rounded-md border bg-background px-2.5 py-2 text-xs font-mono leading-relaxed disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>默认动效色 1</Label>
          <Input
            value={value.animatedBgTint1}
            onChange={(e) => patchThemeSurface('animatedBgTint1', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint1}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>默认动效色 2</Label>
          <Input
            value={value.animatedBgTint2}
            onChange={(e) => patchThemeSurface('animatedBgTint2', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint2}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>默认动效色 3</Label>
          <Input
            value={value.animatedBgTint3}
            onChange={(e) => patchThemeSurface('animatedBgTint3', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint3}
            className="font-mono text-xs"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>浮动光斑 1</Label>
          <Input
            value={value.floatingOrbColor1}
            onChange={(e) => patchThemeSurface('floatingOrbColor1', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor1}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>浮动光斑 2</Label>
          <Input
            value={value.floatingOrbColor2}
            onChange={(e) => patchThemeSurface('floatingOrbColor2', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor2}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>浮动光斑 3</Label>
          <Input
            value={value.floatingOrbColor3}
            onChange={(e) => patchThemeSurface('floatingOrbColor3', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor3}
            className="font-mono text-xs"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>首页卡片叠层色</Label>
          <Input
            value={value.homeCardOverlay}
            onChange={(e) => patchThemeSurface('homeCardOverlay', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardOverlay}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>首页卡片暗色叠层</Label>
          <Input
            value={value.homeCardOverlayDark}
            onChange={(e) => patchThemeSurface('homeCardOverlayDark', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardOverlayDark}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>首页卡片内高光</Label>
          <Input
            value={value.homeCardInsetHighlight}
            onChange={(e) => patchThemeSurface('homeCardInsetHighlight', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardInsetHighlight}
            className="max-w-xl font-mono text-xs"
          />
        </div>
      </div>
      <Label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={value.hideFloatingOrbs}
          onChange={(e) => patchThemeSurface('hideFloatingOrbs', e.target.checked)}
        />
        <span className="text-sm">隐藏浮动光斑（更干净的静态渐变背景）</span>
      </Label>
    </div>
  )
}
