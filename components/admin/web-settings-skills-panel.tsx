'use client'

import { useAtom } from 'jotai'
import { useState } from 'react'

import {
  webSettingsFormAtom,
  webSettingsLegacyMcpConfiguredAtom,
  webSettingsLegacyMcpGeneratedApiKeyAtom,
  webSettingsPublicOriginAtom,
  webSettingsSkillsAiAuthorizationsAtom,
  webSettingsSkillsApiKeyConfiguredAtom,
  webSettingsSkillsAuthModeAtom,
  webSettingsSkillsEnabledAtom,
  webSettingsSkillsGeneratedApiKeyAtom,
  webSettingsSkillsOauthConfiguredAtom,
  webSettingsSkillsOauthTokenTtlMinutesAtom,
  webSettingsSkillsRevokingAiClientIdAtom,
  webSettingsSkillsSavingAtom,
} from '@/components/admin/web-settings-store'
import { formatIsoDatetime } from '@/components/admin/web-settings-utils'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

type SaveSkillsConfigOptions = {
  rotateApiKey?: boolean
  rotateLegacyMcpKey?: boolean
}

type WebSettingsSkillsPanelProps = {
  onSaveSkillsConfig: (options: SaveSkillsConfigOptions) => Promise<void>
  onRevokeSkillsOauthByAiClientId: (aiClientId: string) => Promise<void>
  onCopyPlainText: (value: string, successText: string) => Promise<void>
}

export function WebSettingsSkillsPanel({
  onSaveSkillsConfig,
  onRevokeSkillsOauthByAiClientId,
  onCopyPlainText,
}: WebSettingsSkillsPanelProps) {
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [skillsSaving] = useAtom(webSettingsSkillsSavingAtom)
  const [skillsEnabled, setSkillsEnabled] = useAtom(webSettingsSkillsEnabledAtom)
  const [skillsAuthMode, setSkillsAuthMode] = useAtom(webSettingsSkillsAuthModeAtom)
  const [skillsApiKeyConfigured] = useAtom(webSettingsSkillsApiKeyConfiguredAtom)
  const [skillsOauthConfigured] = useAtom(webSettingsSkillsOauthConfiguredAtom)
  const [skillsOauthTokenTtlMinutes, setSkillsOauthTokenTtlMinutes] = useAtom(
    webSettingsSkillsOauthTokenTtlMinutesAtom,
  )
  const [skillsAiAuthorizations] = useAtom(webSettingsSkillsAiAuthorizationsAtom)
  const [skillsRevokingAiClientId] = useAtom(webSettingsSkillsRevokingAiClientIdAtom)
  const [skillsGeneratedApiKey] = useAtom(webSettingsSkillsGeneratedApiKeyAtom)
  const [legacyMcpConfigured] = useAtom(webSettingsLegacyMcpConfiguredAtom)
  const [legacyMcpGeneratedApiKey] = useAtom(webSettingsLegacyMcpGeneratedApiKeyAtom)
  const [publicOrigin] = useAtom(webSettingsPublicOriginAtom)
  const [skillsAiAuthDialogOpen, setSkillsAiAuthDialogOpen] = useState(false)
  const [revokeDialogAiClientId, setRevokeDialogAiClientId] = useState('')
  const aiToolMode = form.aiToolMode
  const mcpThemeToolsEnabled = form.mcpThemeToolsEnabled

  const mdUrl = publicOrigin ? `${publicOrigin}/api/llm/md` : '/api/llm/md'
  const directUrl = skillsAuthMode
    ? publicOrigin
      ? `${publicOrigin}/api/llm/direct?mode=${skillsAuthMode}`
      : `/api/llm/direct?mode=${skillsAuthMode}`
    : ''
  const legacyMcpApiKeyUrl = publicOrigin ? `${publicOrigin}/api/llm/mcp/apikey` : '/api/llm/mcp/apikey'
  const legacyMcpEndpointUrl = publicOrigin ? `${publicOrigin}/api/llm/mcp` : '/api/llm/mcp'

  const handleConfirmRevoke = async () => {
    if (!revokeDialogAiClientId) return
    await onRevokeSkillsOauthByAiClientId(revokeDialogAiClientId)
    setRevokeDialogAiClientId('')
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label className="font-normal">允许 AI 调试</Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            启用后，AI 可按你选择的模式进行调试。关闭后，Skills 与 MCP 都不会生效。
          </p>
        </div>
        <Switch
          checked={skillsEnabled}
          onCheckedChange={(value) => setSkillsEnabled(Boolean(value))}
          disabled={skillsSaving}
          className="shrink-0"
        />
      </div>

      <div className="space-y-2">
        <Label>调试模式</Label>
        <Select
          value={aiToolMode}
          onValueChange={(value) =>
            setForm((prev) => ({
              ...prev,
              aiToolMode: value === 'mcp' ? 'mcp' : 'skills',
              mcpThemeToolsEnabled:
                value === 'mcp' ? prev.mcpThemeToolsEnabled : false,
            }))
          }
          disabled={!skillsEnabled}
        >
          <SelectTrigger className="w-full sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skills">Skill</SelectItem>
            <SelectItem value="mcp">MCP</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground leading-relaxed">
          选择 AI 调试时使用的工具链。切换后需要点击页面底部保存网页配置。
        </p>
        <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
          当前已选择 {aiToolMode === 'mcp' ? 'MCP' : 'Skill'}
        </div>
      </div>

      {skillsEnabled && aiToolMode === 'skills' ? (
        <div className="space-y-4 rounded-md border border-border/60 bg-muted/20 px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>认证模式</Label>
              <Select
                value={skillsAuthMode || ''}
                onValueChange={(value) => {
                  const mode = value === 'oauth' || value === 'apikey' ? value : ''
                  setSkillsAuthMode(mode)
                }}
                disabled={skillsSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择 OAuth / APIKEY" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oauth">OAuth 授权链接（有效期可配置）</SelectItem>
                  <SelectItem value="apikey">APIKEY 认证（默认无限）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>授权状态</Label>
              <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
                {skillsAuthMode === 'oauth' ? (
                  <>
                    OAuth：{skillsOauthConfigured ? '已授权' : '未授权'}
                    {' '}· 以 AI 标识维度签发，可并存多个 token
                  </>
                ) : skillsAuthMode === 'apikey' ? (
                  <>APIKEY：{skillsApiKeyConfigured ? '已配置' : '未配置（请生成/轮换）'}</>
                ) : (
                  <>未选择认证模式</>
                )}
              </div>
            </div>
          </div>

          {skillsAuthMode === 'apikey' ? (
            <div className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Label className="text-sm font-normal">APIKEY</Label>
                  <p className="text-xs text-muted-foreground">
                    默认无限期；仅本次显示明文，请复制后妥善保存（后端仅存 hash）。
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={skillsSaving}
                  onClick={() => void onSaveSkillsConfig({ rotateApiKey: true })}
                >
                  {skillsSaving ? '处理中…' : '生成 / 轮换 Key'}
                </Button>
              </div>

              {skillsGeneratedApiKey ? (
                <div className="space-y-2">
                  <Label className="text-xs">本次生成的 Key（请立即复制）</Label>
                  <Input value={skillsGeneratedApiKey} readOnly className="font-mono text-xs" />
                </div>
              ) : null}
            </div>
          ) : null}

          {skillsAuthMode === 'oauth' ? (
            <div className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Label className="text-sm font-normal">OAuth Key 有效期</Label>
                  <p className="text-xs text-muted-foreground">
                    code 兑换后的 key 有效期（分钟）。范围 5-1440。
                  </p>
                </div>
              </div>
              <div className="max-w-xs space-y-2">
                <Input
                  type="number"
                  onWheel={(event) => event.currentTarget.blur()}
                  min={5}
                  max={1440}
                  step={1}
                  value={skillsOauthTokenTtlMinutes}
                  onChange={(event) =>
                    setSkillsOauthTokenTtlMinutes(
                      Math.min(1440, Math.max(5, Math.round(Number(event.target.value) || 60))),
                    )
                  }
                  disabled={skillsSaving}
                />
                <p className="text-[11px] text-muted-foreground">
                  当前设置：{skillsOauthTokenTtlMinutes} 分钟
                </p>
              </div>
            </div>
          ) : null}

          {skillsAuthMode ? (
            <div className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-3">
              <Label className="text-xs">固定技能说明（完整链接）</Label>
              <div className="flex gap-2">
                <Input value={mdUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void onCopyPlainText(mdUrl, '已复制 skills.md 链接')}
                >
                  一键复制
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                AI 必须先读取该文档；如使用 OAuth，必须声明并持续使用一个自己的固定 AI 名字。
              </p>

              <Label className="text-xs">Skills 直连链接（验证/指引）</Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                该链接用于验证 token 是否可用，并返回 AI 需要的{' '}
                <code className="rounded bg-muted px-1">LLM-Skills-*</code> 请求头模板。
                APIKEY 模式请在请求头填写 <code className="rounded bg-muted px-1">LLM-Skills-Token</code>；
                OAuth 模式必须先确定一个自己的固定 AI 名字，再由 AI 自己携带该名字请求；这里不预填 AI 名字。
              </p>
              <div className="flex gap-2">
                <Input value={directUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void onCopyPlainText(directUrl, '已复制 Skills 直连链接')}
                >
                  一键复制
                </Button>
              </div>
            </div>
          ) : null}

          {skillsAuthMode === 'oauth' ? (
            <div className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Label className="text-xs">AI 授权情况</Label>
                  <p className="text-[11px] text-muted-foreground">
                    按 AI 标识展示；仅显示脱敏状态，不显示 code/key 明文。
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSkillsAiAuthDialogOpen(true)}
                >
                  查看授权情况
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                当前记录数：{skillsAiAuthorizations.length}（点击「查看授权情况」在弹窗中管理）
              </p>
              <Dialog open={skillsAiAuthDialogOpen} onOpenChange={setSkillsAiAuthDialogOpen}>
                <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>AI 授权情况</DialogTitle>
                    <DialogDescription>
                      按 AI 标识查看授权统计与有效 token，可在此执行按 AI 撤销授权。
                    </DialogDescription>
                  </DialogHeader>
                  {skillsAiAuthorizations.length > 0 ? (
                    <div className="max-h-[60vh] overflow-auto space-y-2 pr-1">
                      {skillsAiAuthorizations.map((item) => (
                        <div
                          key={item.aiClientId}
                          className="rounded-md border border-border/60 bg-muted/20 px-3 py-3 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <code className="text-xs rounded bg-muted px-1.5 py-0.5">{item.aiClientId}</code>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={skillsSaving || skillsRevokingAiClientId === item.aiClientId}
                              onClick={() => setRevokeDialogAiClientId(item.aiClientId)}
                            >
                              {skillsRevokingAiClientId === item.aiClientId ? '撤销中…' : '撤销该 AI 授权'}
                            </Button>
                          </div>
                          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                            <span>待确认 code：{item.pendingCodeCount}</span>
                            <span>已确认未兑换 code：{item.approvedCodeCount}</span>
                            <span>有效 token：{item.activeTokenCount}</span>
                          </div>
                          <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                            <span>最近确认：{formatIsoDatetime(item.lastApprovedAt)}</span>
                            <span>最近兑换：{formatIsoDatetime(item.lastExchangedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无 AI 授权记录</p>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setSkillsAiAuthDialogOpen(false)}>
                      关闭
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog
                open={Boolean(revokeDialogAiClientId)}
                onOpenChange={(open) => {
                  if (!open) setRevokeDialogAiClientId('')
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>确认撤销 AI OAuth 授权</DialogTitle>
                    <DialogDescription>
                      将撤销该 AI 标识下所有仍有效的 OAuth token。此操作会立即生效。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                    AI 标识：<code>{revokeDialogAiClientId || '—'}</code>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRevokeDialogAiClientId('')}
                      disabled={skillsSaving || Boolean(skillsRevokingAiClientId)}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleConfirmRevoke()}
                      disabled={!revokeDialogAiClientId || skillsSaving || Boolean(skillsRevokingAiClientId)}
                    >
                      确认撤销
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : null}
        </div>
      ) : null}

      {skillsEnabled && aiToolMode === 'mcp' ? (
        <div className="space-y-4 rounded-md border border-border/60 bg-muted/20 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="font-normal">启用 MCP</Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                使用数据库中的 deprecated 字段 <code className="rounded bg-muted px-1">mcpThemeToolsEnabled</code>{' '}
                控制是否启用。默认只接受独立 MCP API Key。
              </p>
            </div>
            <Switch
              checked={mcpThemeToolsEnabled}
              onCheckedChange={(value) =>
                setForm((prev) => ({ ...prev, mcpThemeToolsEnabled: Boolean(value) }))
              }
              className="shrink-0"
            />
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
            选中 MCP 后，Skills HTTP 调试接口会自动关闭；切回 Skill 后，MCP 也会自动关闭。
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>MCP 状态</Label>
              <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
                {mcpThemeToolsEnabled ? 'MCP 已启用' : 'MCP 未启用'}
                {' '}· API Key：{legacyMcpConfigured ? '已配置' : '未配置（请生成/轮换）'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>认证模式</Label>
              <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
                API Key Only
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Label className="text-sm font-normal">独立 MCP API Key</Label>
                <p className="text-xs text-muted-foreground">
                  仅供旧式 MCP endpoint 和专用校验接口使用，和 Skills API Key 分离。
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={skillsSaving}
                onClick={() => void onSaveSkillsConfig({ rotateLegacyMcpKey: true })}
              >
                {skillsSaving ? '处理中…' : '生成 / 轮换 Key'}
              </Button>
            </div>

            {legacyMcpGeneratedApiKey ? (
              <div className="space-y-2">
                <Label className="text-xs">本次生成的 MCP Key（请立即复制）</Label>
                <Input value={legacyMcpGeneratedApiKey} readOnly className="font-mono text-xs" />
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-3">
            <Label className="text-xs">MCP API Key 校验地址</Label>
            <div className="flex gap-2">
              <Input value={legacyMcpApiKeyUrl} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void onCopyPlainText(legacyMcpApiKeyUrl, '已复制 MCP API Key 校验地址')}
              >
                一键复制
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-3">
            <Label className="text-xs">MCP Endpoint</Label>
            <div className="flex gap-2">
              <Input value={legacyMcpEndpointUrl} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void onCopyPlainText(legacyMcpEndpointUrl, '已复制 MCP endpoint')}
              >
                一键复制
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              默认使用 <code className="rounded bg-muted px-1">Authorization: Bearer YOUR_LEGACY_MCP_APIKEY</code>{' '}
              认证。切换开关后，记得点击页面底部保存网页配置。
            </p>
          </div>
        </div>
      ) : null}

      {!skillsEnabled ? (
        <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
          当前未开启“允许 AI 调试”，因此不会展示当前模式的详细配置。
        </div>
      ) : null}
    </div>
  )
}
