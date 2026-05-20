import { Button } from '@/components/ui/button'
import { DEVICE_LIST_PAGE_SIZE } from '@/constants/device'

type DeviceListPaginationT = (
  key: string,
  values?: Record<string, string | number>,
) => string

export function DeviceListPagination({
  total,
  itemCount,
  safePage,
  totalPages,
  t,
  onPageChange,
}: {
  total: number
  itemCount: number
  safePage: number
  totalPages: number
  t: DeviceListPaginationT
  onPageChange: (page: number) => void
}) {
  if (total <= 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 break-words">
        {t('common.countSummary', { total })}
        {itemCount > 0 ? (
          <>
            {' '}
            ·{' '}
            {t('common.pageSummary', {
              start: safePage * DEVICE_LIST_PAGE_SIZE + 1,
              end: safePage * DEVICE_LIST_PAGE_SIZE + itemCount,
            })}
          </>
        ) : null}
      </span>
      {total > DEVICE_LIST_PAGE_SIZE ? (
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:w-auto sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full sm:w-auto"
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
            disabled={safePage <= 0}
          >
            {t('common.previousPage')}
          </Button>
          <span className="text-center tabular-nums text-sm">
            {safePage + 1} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full sm:w-auto"
            onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage >= totalPages - 1}
          >
            {t('common.nextPage')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
