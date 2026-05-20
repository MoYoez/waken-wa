import { summarizeAppRuleGroup } from '@/components/admin/rule-tools-utils'
import { ListPaginationBar, SETTINGS_RULES_PAGE_SIZE } from '@/components/admin/web-settings-paging'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { RuleToolsRuleItem } from '@/types/rule-tools'

export function RuleToolsGroupList({
  mobile,
  isLoading,
  isFetching,
  hasPayload,
  busy,
  ruleSearchInput,
  pagedRuleItems,
  activeSelectedRuleId,
  totalRuleCount,
  resolvedGroupListPage,
  filteredRuleItemCount,
  t,
  setRuleSearchInput,
  setGroupListPage,
  setSelectedRuleId,
  onAddRuleGroup,
  onOpenMobileRuleEditor,
}: {
  mobile: boolean
  isLoading: boolean
  isFetching: boolean
  hasPayload: boolean
  busy: boolean
  ruleSearchInput: string
  pagedRuleItems: RuleToolsRuleItem[]
  activeSelectedRuleId: string | null
  totalRuleCount: number
  resolvedGroupListPage: number
  filteredRuleItemCount: number
  t: (key: string, values?: Record<string, unknown>) => string
  setRuleSearchInput: (value: string) => void
  setGroupListPage: (page: number) => void
  setSelectedRuleId: (id: string) => void
  onAddRuleGroup: (mobile: boolean) => void
  onOpenMobileRuleEditor: (item: RuleToolsRuleItem) => void
}) {
  const hasSearch = ruleSearchInput.trim().length > 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {t('webSettingsRuleTools.appRules.groupListTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('webSettingsRuleTools.appRules.groupListDescription')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!hasPayload || busy}
          onClick={() => onAddRuleGroup(mobile)}
        >
          {t('webSettingsRuleTools.appRules.addGroup')}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor={mobile ? 'app-rule-search-mobile' : 'app-rule-search-desktop'}>
          {t('common.search')}
        </Label>
        <Input
          id={mobile ? 'app-rule-search-mobile' : 'app-rule-search-desktop'}
          value={ruleSearchInput}
          onChange={(event) => {
            setRuleSearchInput(event.target.value)
            setGroupListPage(0)
          }}
          placeholder={t('webSettingsRuleTools.appRules.searchPlaceholder')}
        />
        {isFetching && !isLoading ? (
          <p className="text-xs text-muted-foreground">{t('common.refreshing')}</p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoading && !hasPayload ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-background/30 px-6 py-8 text-center">
            <p className="text-xs text-muted-foreground">{t('webSettings.loading')}</p>
          </div>
        ) : pagedRuleItems.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-background/30 px-6 py-8 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {hasSearch
                ? t('webSettingsRuleTools.appRules.noSearchResults')
                : t('webSettingsRuleTools.appRules.noGroups')}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-background/20 p-3">
              {pagedRuleItems.map((item) => {
                const isSelected = !mobile && activeSelectedRuleId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                      isSelected
                        ? 'border-primary/60 bg-background shadow-sm'
                        : 'border-border bg-background/60 hover:bg-background',
                    )}
                    onClick={() => {
                      if (mobile) {
                        onOpenMobileRuleEditor(item)
                        return
                      }
                      setSelectedRuleId(item.id)
                    }}
                  >
                    <p className="text-xs font-medium text-foreground/80">
                      {t('webSettingsRuleTools.appRules.ruleIndex', {
                        index: item.position + 1,
                        total: totalRuleCount,
                      })}
                    </p>
                    <p className="mt-1 break-all font-mono text-sm text-foreground">
                      {item.processMatch || t('webSettingsRuleTools.appRules.matchEmpty')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {summarizeAppRuleGroup(item, t)}
                    </p>
                  </button>
                )
              })}
            </div>
            <ListPaginationBar
              page={resolvedGroupListPage}
              pageSize={SETTINGS_RULES_PAGE_SIZE}
              total={filteredRuleItemCount}
              onPageChange={setGroupListPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
