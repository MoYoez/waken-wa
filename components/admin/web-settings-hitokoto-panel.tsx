'use client'

import type { PatchSiteConfig, SiteConfig } from '@/components/admin/web-settings-types'
import { Checkbox } from '@/components/ui/checkbox'
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

type WebSettingsHitokotoPanelProps = {
  form: SiteConfig
  patch: PatchSiteConfig
  onCategoriesChange: (next: string[]) => void
}

export function WebSettingsHitokotoPanel({
  form,
  patch,
  onCategoriesChange,
}: WebSettingsHitokotoPanelProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="page-loading-toggle" className="font-normal cursor-pointer">
              页面 Loading 动画
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              控制首页与灵感页初次进入时的加载过渡动画。
            </p>
          </div>
          <Switch
            id="page-loading-toggle"
            checked={form.pageLoadingEnabled}
            onCheckedChange={(value) => patch('pageLoadingEnabled', value)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="search-engine-indexing-toggle" className="font-normal cursor-pointer">
              允许搜索引擎收录
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              关闭后会向搜索引擎声明 noindex / nofollow。
            </p>
          </div>
          <Switch
            id="search-engine-indexing-toggle"
            checked={form.searchEngineIndexingEnabled}
            onCheckedChange={(value) => patch('searchEngineIndexingEnabled', value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="note-typewriter-toggle" className="font-normal cursor-pointer">
            个人备注打字机效果
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            为首页备注增加逐字显示效果，对静态备注和一言回退都生效。
          </p>
        </div>
        <Switch
          id="note-typewriter-toggle"
          checked={form.userNoteTypewriterEnabled}
          onCheckedChange={(value) => patch('userNoteTypewriterEnabled', value)}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="hitokoto-home-note" className="font-normal cursor-pointer">
          首页备注使用一言（hitokoto.cn）
        </Label>
        <Switch
          id="hitokoto-home-note"
          checked={form.userNoteHitokotoEnabled}
          onCheckedChange={(value) => patch('userNoteHitokotoEnabled', value)}
        />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        开启后由访客浏览器请求 <code className="rounded bg-muted px-1">v1.hitokoto.cn</code>；
        句子类型可多选；不选表示不限制类型（与官方默认一致）。
      </p>
      {form.userNoteHitokotoEnabled ? (
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="hitokoto-encode">返回编码 encode</Label>
            <Select
              value={form.userNoteHitokotoEncode}
              onValueChange={(value) => patch('userNoteHitokotoEncode', value === 'text' ? 'text' : 'json')}
            >
              <SelectTrigger id="hitokoto-encode" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">json（可带 uuid 跳转出处）</SelectItem>
                <SelectItem value="text">text（纯文本）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">一言不可用时使用备注回退</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                关闭后会直接显示“一言暂不可用”，不再自动使用上方静态备注。
              </p>
            </div>
            <Switch
              id="hitokoto-home-note-fallback"
              checked={form.userNoteHitokotoFallbackToNote}
              onCheckedChange={(value) => patch('userNoteHitokotoFallbackToNote', value)}
            />
          </div>

          <div className="space-y-2">
            <Label>句子类型 c（可多选）</Label>
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
                      onCategoriesChange(next)
                    }}
                  />
                  <span>
                    {option.id} · {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
