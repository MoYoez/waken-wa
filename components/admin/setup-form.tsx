'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useT } from 'next-i18next/client'
import { useEffect, useState } from 'react'

import { loginAdmin, setupAdminSite } from '@/components/admin/admin-query-mutations'
import { FileSelectTrigger } from '@/components/admin/file-select-trigger'
import { ImageCropDialog } from '@/components/admin/image-crop-dialog'
import { Switch } from '@/components/ui/switch'
import { isRemoteAvatarUrl, resolveAvatarUrl } from '@/lib/avatar-url'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import { SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES } from '@/lib/site-config-constants'
import type { SetupInitialConfig } from '@/types/components'

export type { SetupInitialConfig } from '@/types/components'

interface SetupFormProps {
  needAdminSetup: boolean
  initialConfig?: SetupInitialConfig
}

export function SetupForm({ needAdminSetup, initialConfig }: SetupFormProps) {
  const { t } = useT('admin')
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pageTitle, setPageTitle] = useState(
    initialConfig?.pageTitle ?? DEFAULT_PAGE_TITLE
  )
  const [userName, setUserName] = useState(initialConfig?.userName ?? '')
  const [userBio, setUserBio] = useState(initialConfig?.userBio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialConfig?.avatarUrl ?? '')
  const [avatarFetchByServerEnabled, setAvatarFetchByServerEnabled] = useState(
    initialConfig?.avatarFetchByServerEnabled === true,
  )
  const [userNote, setUserNote] = useState(initialConfig?.userNote ?? '')
  const [historyWindowMinutes, setHistoryWindowMinutes] = useState(
    initialConfig?.historyWindowMinutes ?? SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  )
  const [currentlyText, setCurrentlyText] = useState(initialConfig?.currentlyText ?? '')
  const [earlierText, setEarlierText] = useState(initialConfig?.earlierText ?? '')
  const [adminText, setAdminText] = useState(initialConfig?.adminText ?? '')
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const avatarUsesRemoteUrl = isRemoteAvatarUrl(avatarUrl)
  const avatarPreviewUrl = resolveAvatarUrl(avatarUrl)

  useEffect(() => {
    return () => {
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl)
      }
    }
  }, [cropSourceUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (needAdminSetup && password !== confirmPassword) {
      setError(t('setup.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      await setupAdminSite({
        needAdminSetup,
        username,
        password,
        pageTitle: pageTitle.slice(0, PAGE_TITLE_MAX_LEN),
        userName,
        userBio,
        avatarUrl,
        avatarFetchByServerEnabled:
          avatarUsesRemoteUrl && avatarFetchByServerEnabled,
        userNote,
        historyWindowMinutes,
        currentlyText,
        earlierText,
        adminText,
      })
      if (needAdminSetup) {
        await loginAdmin(username, password)
      }
      router.push('/admin')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.networkErrorRetry')
      if (needAdminSetup && message.includes(t('mutation.autoLoginFailedManual'))) {
        setError(t('setup.setupSucceededBut', { message }))
        router.push('/admin/login')
        router.refresh()
        return
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card/90 backdrop-blur-sm p-6 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-wide text-foreground">{t('setup.title')}</h1>
          <p className="text-xs text-muted-foreground mt-2">
            {needAdminSetup ? t('setup.subtitleWithAdmin') : t('setup.subtitleWithoutAdmin')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 max-h-[78vh] overflow-y-auto pr-1">
          {needAdminSetup && (
            <>
              <div className="space-y-2">
                <label htmlFor="username" className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t('setup.adminUsernameLabel')}
                </label>
                <p className="text-[11px] text-muted-foreground">{t('setup.adminUsernameHint')}</p>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoComplete="username"
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t('setup.adminPasswordLabel')}
                </label>
                <p className="text-[11px] text-muted-foreground">{t('setup.adminPasswordHint')}</p>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('setup.adminPasswordPlaceholder')}
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t('setup.confirmAdminPasswordLabel')}
                </label>
                <p className="text-[11px] text-muted-foreground">{t('setup.confirmAdminPasswordHint')}</p>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('setup.confirmAdminPasswordPlaceholder')}
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-sm"
                />
              </div>
            </>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              {t('setup.homepageProfile')}
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{t('setup.pageTitleLabel')}</label>
                <p className="text-[11px] text-muted-foreground">
                  {t('setup.pageTitleHint', { max: PAGE_TITLE_MAX_LEN })}
                </p>
                <input
                  type="text"
                  value={pageTitle}
                  maxLength={PAGE_TITLE_MAX_LEN}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder={DEFAULT_PAGE_TITLE}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{t('setup.userNameLabel')}</label>
                <p className="text-[11px] text-muted-foreground">{t('setup.userNameHint')}</p>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={t('setup.userNamePlaceholder')}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{t('setup.userBioLabel')}</label>
                <p className="text-[11px] text-muted-foreground">{t('setup.userBioHint')}</p>
                <input
                  type="text"
                  value={userBio}
                  onChange={(e) => setUserBio(e.target.value)}
                  placeholder={t('setup.userBioPlaceholder')}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{t('setup.userNoteLabel')}</label>
                <p className="text-[11px] text-muted-foreground">{t('setup.userNoteHint')}</p>
                <textarea
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder={t('setup.userNotePlaceholder')}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{t('setup.avatarUrlLabel')}</label>
                <p className="text-[11px] text-muted-foreground">{t('setup.avatarUrlHint')}</p>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder={t('setup.avatarUrlPlaceholder')}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              {avatarUsesRemoteUrl ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-medium text-foreground">{t('setup.remoteAvatarFetchTitle')}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t('setup.remoteAvatarFetchDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={avatarFetchByServerEnabled}
                    onCheckedChange={setAvatarFetchByServerEnabled}
                    className="shrink-0"
                  />
                </div>
              ) : null}
              <FileSelectTrigger
                accept="image/*"
                buttonLabel={t('common.selectFile')}
                emptyLabel={t('common.noFileSelected')}
                onSelect={async (file) => {
                  setError('')
                  if (!file) return
                  if (cropSourceUrl) {
                    URL.revokeObjectURL(cropSourceUrl)
                  }
                  const objectUrl = URL.createObjectURL(file)
                  setCropSourceUrl(objectUrl)
                  setCropDialogOpen(true)
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('setup.imageUploadHint')}
              </p>
              {avatarPreviewUrl && (
                <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-3">
                  <Image
                    src={avatarPreviewUrl}
                    alt="avatar preview"
                    width={40}
                    height={40}
                    loading="eager"
                    className="w-10 h-10 rounded-full border border-border object-cover"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t('setup.avatarPreview', {
                      fetch:
                        avatarUsesRemoteUrl && avatarFetchByServerEnabled
                          ? t('setup.avatarPreviewFetchSuffix')
                          : '',
                    })}
                  </span>
                </div>
              )}
              {cropSourceUrl && (
                <button
                  type="button"
                  onClick={() => setCropDialogOpen(true)}
                  className="px-3 py-2 border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors"
                >
                  {t('setup.openCropDialog')}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">{t('setup.historyWindowLabel')}</label>
                  <p className="text-[11px] text-muted-foreground">
                    {t('setup.historyWindowHint', {
                      minutes: SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
                    })}
                  </p>
                  <input
                    type="number"
                    onWheel={(e) => e.currentTarget.blur()}
                    min={10}
                    max={1440}
                    step={10}
                    value={historyWindowMinutes}
                    onChange={(e) =>
                      setHistoryWindowMinutes(
                        Number(e.target.value || SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES),
                      )
                    }
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">{t('setup.currentSectionLabel')}</label>
                  <p className="text-[11px] text-muted-foreground">{t('setup.currentSectionHint')}</p>
                  <input
                    type="text"
                    value={currentlyText}
                    onChange={(e) => setCurrentlyText(e.target.value)}
                    placeholder={t('setup.currentSectionPlaceholder')}
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">{t('setup.earlierSectionLabel')}</label>
                  <p className="text-[11px] text-muted-foreground">{t('setup.earlierSectionHint')}</p>
                  <input
                    type="text"
                    value={earlierText}
                    onChange={(e) => setEarlierText(e.target.value)}
                    placeholder={t('setup.earlierSectionPlaceholder')}
                    className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{t('setup.adminEntryLabel')}</label>
                <p className="text-[11px] text-muted-foreground">{t('setup.adminEntryHint')}</p>
                <input
                  type="text"
                  value={adminText}
                  onChange={(e) => setAdminText(e.target.value)}
                  placeholder={t('setup.adminEntryPlaceholder')}
                  className="w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
          >
            {loading
              ? t('setup.saving')
              : needAdminSetup
                ? t('setup.createAdminAndSave')
                : t('setup.saveConfig')}
          </button>
        </form>
      </div>
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
        title={t('setup.cropAvatarTitle')}
        description={t('setup.cropAvatarDescription')}
        onComplete={(dataUrl) => {
          setAvatarUrl(dataUrl)
        }}
      />
    </div>
  )
}
