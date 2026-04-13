import { useT } from 'next-i18next/client'

import { Button } from '@/components/ui/button'

/** Paginate tall rule cards. */
export const SETTINGS_RULES_PAGE_SIZE = 5
/** Paginate compact app-name rows */
export const SETTINGS_APP_LIST_PAGE_SIZE = 10

export function listMaxPage(total: number, pageSize: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.ceil(total / pageSize) - 1)
}

export function ListPaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (next: number) => void
}) {
  const { t } = useT('admin')
  if (total <= pageSize) return null
  const maxPage = listMaxPage(total, pageSize)
  const safePage = Math.min(page, maxPage)
  const start = safePage * pageSize + 1
  const end = Math.min((safePage + 1) * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <span>
        {t('common.countSummary', { total })} · {t('common.pageSummary', { start, end })}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={safePage <= 0}
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
        >
          {t('common.previousPage')}
        </Button>
        <span className="tabular-nums">
          {safePage + 1} / {maxPage + 1}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={safePage >= maxPage}
          onClick={() => onPageChange(Math.min(maxPage, safePage + 1))}
        >
          {t('common.nextPage')}
        </Button>
      </div>
    </div>
  )
}
