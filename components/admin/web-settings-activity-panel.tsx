'use client'

import { useAtom } from 'jotai'

import {
  webSettingsFormAtom,
  webSettingsInspirationDevicesAtom,
  webSettingsRedisCacheServerlessForcedAtom,
} from '@/components/admin/web-settings-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/lib/activity-api-constants'
import {
  ACTIVITY_UPDATE_MODE_OPTIONS,
  type ActivityUpdateMode,
} from '@/lib/activity-update-mode'
import {
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES,
  SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_PROCESS_STALE_MAX_SECONDS,
  SITE_CONFIG_PROCESS_STALE_MIN_SECONDS,
} from '@/lib/site-config-constants'
import { TIMEZONE_OPTIONS } from '@/lib/timezone'

function ToggleCard(props: {
  id: string
  title: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  const { id, title, description, checked, onCheckedChange } = props
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
      <div className="space-y-0.5 min-w-0">
        <Label htmlFor={id} className="font-normal cursor-pointer">
          {title}
        </Label>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </div>
  )
}

export function WebSettingsActivityPanel() {
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [redisCacheServerlessForced] = useAtom(webSettingsRedisCacheServerlessForcedAtom)
  const [inspirationDevices] = useAtom(webSettingsInspirationDevicesAtom)
  const patch = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-5">
      <ToggleCard
        id="global-mouse-tilt"
        title="全站页面视差倾斜"
        description="开启后整页随鼠标轻微 3D 倾斜；默认关闭。后台路由不受此影响；系统「减少动效」时自动启用。"
        checked={form.globalMouseTiltEnabled}
        onCheckedChange={(value) => patch('globalMouseTiltEnabled', value)}
      />

      {form.globalMouseTiltEnabled ? (
        <ToggleCard
          id="global-mouse-tilt-gyro"
          title="支持检测陀螺仪晃动"
          description="开启后在支持的移动设备上使用陀螺仪/设备方向驱动页面倾斜（可能需要系统权限）；不支持或未授权时会自动回退。"
          checked={form.globalMouseTiltGyroEnabled}
          onCheckedChange={(value) => patch('globalMouseTiltGyroEnabled', value)}
        />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="profile-online-accent">头像在线态强调色</Label>
        <p className="text-xs text-muted-foreground">
          留空则使用当前主题自带的在线颜色。仅影响首页头像圆环与右下角在线点。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="profile-online-accent"
            type="color"
            className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1 shadow-xs"
            value={form.profileOnlineAccentColor || '#22C55E'}
            onChange={(event) => patch('profileOnlineAccentColor', event.target.value.toUpperCase())}
            aria-label="Pick profile online accent color"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => patch('profileOnlineAccentColor', '')}>
            使用主题默认
          </Button>
        </div>
      </div>

      <ToggleCard
        id="profile-online-pulse"
        title="在线状态呼吸灯"
        description="开启时首页头像右下角在线点为呼吸动画；关闭后为静态实心点。系统「减少动效」时浏览器可能仍会减弱动画。"
        checked={form.profileOnlinePulseEnabled}
        onCheckedChange={(value) => patch('profileOnlinePulseEnabled', value)}
      />

      <ToggleCard
        id="hide-activity-media"
        title="不显示媒体播放"
        description="开启后首页「当前状态」卡片不再展示正在播放的曲目与歌手（上报数据仍会保存）。"
        checked={form.hideActivityMedia}
        onCheckedChange={(value) => patch('hideActivityMedia', value)}
      />

      <ToggleCard
        id="activity-reject-lockapp-sleep"
        title="休眠视作离线（拒绝 LockApp 进程上报）"
        description="开启后，若上报的进程名为 LockApp 上报程序（如 LockApp.exe），服务端将拒绝写入并不更新设备最后在线时间。"
        checked={form.activityRejectLockappSleep}
        onCheckedChange={(value) => patch('activityRejectLockappSleep', value)}
      />

      <div className="space-y-2">
        <Label htmlFor="display-timezone">显示时区</Label>
        <p className="text-xs text-muted-foreground">
          用于显示时间的时区设置，默认为中国标准时间 (GMT+8)。
        </p>
        <Select value={form.displayTimezone} onValueChange={(value) => patch('displayTimezone', value)}>
          <SelectTrigger id="display-timezone" className="w-full max-w-xs">
            <SelectValue placeholder="选择时区" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONE_OPTIONS.map((timezone) => (
              <SelectItem key={timezone.value} value={timezone.value}>
                {timezone.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label htmlFor="activity-update-mode">状态更新模式</Label>
        <p className="text-xs text-muted-foreground">
          选择用于获取活动状态更新的方式。不同模式在实时性和资源消耗之间有所权衡。
        </p>
        <RadioGroup
          value={form.activityUpdateMode}
          onValueChange={(value) => patch('activityUpdateMode', value as ActivityUpdateMode)}
          className="space-y-3"
        >
          {ACTIVITY_UPDATE_MODE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-start space-x-3">
              <RadioGroupItem value={option.value} id={`update-mode-${option.value}`} className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label htmlFor={`update-mode-${option.value}`} className="font-medium cursor-pointer">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">{option.description}</p>
                {option.warning ? (
                  <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      <span className="font-semibold">注意：</span>
                      {option.warning}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="use-nosql-as-cache-redis" className="font-normal cursor-pointer">
            UseNoSQLAsCache(Redis) - 使用 Redis 缓存
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            开启后，活动流、站点配置、JWT 密钥缓存、限流、设备与 API Token 校验等优先走 Redis；关闭后上述用途均不走 Redis。未配置或不可用时自动回退，不会中断服务。
          </p>
          {redisCacheServerlessForced ? (
            <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <p className="text-xs text-amber-700 leading-relaxed dark:text-amber-400">
                检测到 Serverless 环境（Vercel）：此项默认强制为开且无法在此关闭；若未配置 REDIS_URL，相关逻辑会跳过 Redis 并回退到数据库/内存。
              </p>
            </div>
          ) : null}
        </div>
        <Switch
          id="use-nosql-as-cache-redis"
          checked={form.useNoSqlAsCacheRedis}
          onCheckedChange={(value) => patch('useNoSqlAsCacheRedis', value)}
          disabled={redisCacheServerlessForced}
          className="shrink-0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="redis-cache-ttl-seconds">Redis 缓存 TTL（秒）</Label>
        <Input
          id="redis-cache-ttl-seconds"
          type="number"
          onWheel={(event) => event.currentTarget.blur()}
          min={1}
          max={REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS}
          value={form.redisCacheTtlSeconds}
          onChange={(event) =>
            patch('redisCacheTtlSeconds', Number(event.target.value || REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS))
          }
        />
        <p className="text-xs text-muted-foreground">
          聚合活动流（含数据库活动）在 Redis 中的缓存秒数。默认 3600（1 小时）；更短更实时，更长更省读库。
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="steam-enabled" className="text-base font-medium">
              Steam 状态
            </Label>
            <p className="text-xs text-muted-foreground">
              在此配置全站 Steam 账号与 API Key；在「设备管理」中为需要展示的设备打开「状态卡片显示 Steam 正在游玩」后，该设备在线且 Steam 回报在玩游戏时，会在首页状态卡片上与音乐信息一并显示。
            </p>
          </div>
          <Switch id="steam-enabled" checked={form.steamEnabled} onCheckedChange={(value) => patch('steamEnabled', value)} />
        </div>

        {form.steamEnabled ? (
          <div className="space-y-3 border-t border-border pt-2">
            <div className="space-y-2">
              <Label htmlFor="steam-id">Steam ID (64-bit)</Label>
              <Input
                id="steam-id"
                value={form.steamId}
                onChange={(event) => patch('steamId', event.target.value)}
                placeholder="例如: 76561198000000000"
              />
              <p className="text-xs text-muted-foreground">
                全站共用的 Steam 64-bit ID（非按设备填写），可在
                <a
                  href="https://steamid.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mx-1 text-primary hover:underline"
                >
                  steamid.io
                </a>
                查询。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="steam-api-key">Steam Web API Key（留空则不修改已保存的值）</Label>
              <Input
                id="steam-api-key"
                autoComplete="off"
                value={form.steamApiKey}
                onChange={(event) => patch('steamApiKey', event.target.value)}
                placeholder="在 Steam 开发者申请；也可使用环境变量 STEAM_API_KEY 作为后备"
              />
              <p className="text-xs text-muted-foreground">
                在{' '}
                <a
                  href="https://steamcommunity.com/dev/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  steamcommunity.com/dev/apikey
                </a>{' '}
                申请。保存后仅服务端使用，不会下发到前台。
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>历史窗口（分钟）</Label>
        <Input
          type="number"
          onWheel={(event) => event.currentTarget.blur()}
          min={SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES}
          max={SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES}
          value={form.historyWindowMinutes}
          onChange={(event) =>
            patch('historyWindowMinutes', Number(event.target.value || SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>进程超时判定（秒）</Label>
        <Input
          type="number"
          onWheel={(event) => event.currentTarget.blur()}
          min={SITE_CONFIG_PROCESS_STALE_MIN_SECONDS}
          max={SITE_CONFIG_PROCESS_STALE_MAX_SECONDS}
          value={form.processStaleSeconds}
          onChange={(event) =>
            patch('processStaleSeconds', Number(event.target.value || SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS))
          }
        />
        <p className="text-xs text-muted-foreground">
          超过该时长仍未收到该进程新活动时，将自动判定为已结束。默认 {SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS} 秒。
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.autoAcceptNewDevices}
            onChange={(event) => patch('autoAcceptNewDevices', event.target.checked)}
          />
          自动接收本地新设备（设备身份牌）
        </Label>
        <p className="text-xs text-muted-foreground">
          关闭后，未授权设备身份牌首次上报会进入待审核状态，需要在“设备管理”中手动通过。
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.inspirationDeviceRestrictionEnabled}
            onChange={(event) => patch('inspirationDeviceRestrictionEnabled', event.target.checked)}
          />
          仅允许所选设备通过 API Token 提交「灵感随想录」
        </Label>
        <p className="text-xs text-muted-foreground">
          关闭时：任意已绑定且激活、并使用同一 Token 的设备均可调用随想录接口。开启后：仅下方勾选的设备可提交；客户端请求需携带请求头{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">X-Device-Key</code>
          （值为该设备在后台的「设备身份牌」），或在 JSON 中传{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">generatedHashKey</code>
          。管理员在后台网页里提交不受此限制。
        </p>
        {form.inspirationDeviceRestrictionEnabled ? (
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border bg-background/50 p-3">
            {inspirationDevices.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无设备，请先在「设备管理」中添加。</p>
            ) : (
              inspirationDevices.map((device) => (
                <label key={device.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.inspirationAllowedDeviceHashes.includes(device.generatedHashKey)}
                    onChange={(event) => {
                      const key = device.generatedHashKey
                      const next = event.target.checked
                        ? Array.from(new Set([...form.inspirationAllowedDeviceHashes, key]))
                        : form.inspirationAllowedDeviceHashes.filter((item) => item !== key)
                      patch('inspirationAllowedDeviceHashes', next)
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{device.displayName}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {device.generatedHashKey.slice(0, 10)}…
                  </span>
                  {device.status !== 'active' ? (
                    <span className="shrink-0 text-xs text-amber-600">({device.status})</span>
                  ) : null}
                </label>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
