'use client'

import Image from 'next/image'

import type { PatchSiteConfig, SiteConfig } from '@/components/admin/web-settings-types'
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
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'

type WebSettingsBasicPanelProps = {
  form: SiteConfig
  patch: PatchSiteConfig
  cropSourceUrl: string | null
  onFileSelected: (file?: File) => void
  onOpenCropDialog: () => void
}

export function WebSettingsBasicPanel({
  form,
  patch,
  cropSourceUrl,
  onFileSelected,
  onOpenCropDialog,
}: WebSettingsBasicPanelProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>网页标题（浏览器标签页）</Label>
        <Input
          value={form.pageTitle}
          maxLength={PAGE_TITLE_MAX_LEN}
          onChange={(event) => patch('pageTitle', event.target.value)}
          placeholder={DEFAULT_PAGE_TITLE}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>首页名称</Label>
          <Input value={form.userName} onChange={(event) => patch('userName', event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>首页简介</Label>
          <Input value={form.userBio} onChange={(event) => patch('userBio', event.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>首页备注</Label>
        <Input value={form.userNote} onChange={(event) => patch('userNote', event.target.value)} />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="hitokoto-home-note-basic" className="font-normal cursor-pointer">
            首页备注使用一言（hitokoto.cn）
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            开启后由访客浏览器请求 <code className="rounded bg-muted px-1">v1.hitokoto.cn</code>。
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
        <Label htmlFor="theme-preset-basic">主题预设</Label>
        <Select value={form.themePreset} onValueChange={(value) => patch('themePreset', value)}>
          <SelectTrigger id="theme-preset-basic" className="w-full">
            <SelectValue placeholder="选择主题预设" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basic - 默认主题</SelectItem>
            <SelectItem value="obsidian">Obsidian - 纯黑极简</SelectItem>
            <SelectItem value="mono">Mono - 纯白极简</SelectItem>
            <SelectItem value="midnight">Midnight - 深邃蓝紫</SelectItem>
            <SelectItem value="ocean">Ocean - 深海蓝绿</SelectItem>
            <SelectItem value="nord">Nord - 北欧冷淡</SelectItem>
            <SelectItem value="forest">Forest - 自然森林</SelectItem>
            <SelectItem value="sakura">Sakura - 柔和樱花</SelectItem>
            <SelectItem value="lavender">Lavender - 淡雅薰衣草</SelectItem>
            <SelectItem value="amber">Amber - 温暖琥珀</SelectItem>
            <SelectItem value="customSurface">Custom surface - 自定义背景 / 圆角 / 配色</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">自定义背景 / CSS / 规则等请去「进阶设置」。</p>
      </div>

      <div className="space-y-2">
        <Label>头像地址（URL / DataURL）</Label>
        <Input value={form.avatarUrl} onChange={(event) => patch('avatarUrl', event.target.value)} />
        <p className="text-xs text-muted-foreground">可直接填写图片链接，或通过下方上传并裁剪后自动生成。</p>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            onFileSelected(event.target.files?.[0])
            event.target.value = ''
          }}
          className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-muted/50 file:text-foreground hover:file:bg-muted file:cursor-pointer"
        />
        {cropSourceUrl ? (
          <button
            type="button"
            onClick={onOpenCropDialog}
            className="px-3 py-1.5 border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors"
          >
            重新打开裁剪
          </button>
        ) : null}
        {form.avatarUrl ? (
          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-3">
            <Image
              src={form.avatarUrl}
              alt="头像预览"
              width={40}
              height={40}
              className="w-10 h-10 rounded-full border border-border object-cover"
            />
            <span className="text-xs text-muted-foreground">头像预览</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>当前区块标题</Label>
          <Input value={form.currentlyText} onChange={(event) => patch('currentlyText', event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>随想录区块标题</Label>
          <Input value={form.earlierText} onChange={(event) => patch('earlierText', event.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>后台入口文案</Label>
        <Input value={form.adminText} onChange={(event) => patch('adminText', event.target.value)} />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.pageLockEnabled}
            onChange={(event) => patch('pageLockEnabled', event.target.checked)}
          />
          启用页面访问密码锁
        </Label>
        <Input
          type="password"
          placeholder="设置/更新页面访问密码（留空则不修改）"
          value={form.pageLockPassword}
          onChange={(event) => patch('pageLockPassword', event.target.value)}
        />
      </div>
    </div>
  )
}
