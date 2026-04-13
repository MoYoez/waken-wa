'use client'

import type { DragEndEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useT } from 'next-i18next/client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SchedulePeriodPart, SchedulePeriodTemplateItem } from '@/lib/schedule-courses'
import { cn } from '@/lib/utils'

type SortablePeriodTemplatePartProps = {
  part: SchedulePeriodPart
  rows: SchedulePeriodTemplateItem[]
  onReorderOrderedIds: (part: SchedulePeriodPart, orderedIds: string[]) => void
  patchItem: (id: string, patch: Partial<SchedulePeriodTemplateItem>) => void
  removeItem: (id: string) => void
}

function SortablePeriodRow({
  row,
  patchItem,
  removeItem,
}: {
  row: SchedulePeriodTemplateItem
  patchItem: (id: string, patch: Partial<SchedulePeriodTemplateItem>) => void
  removeItem: (id: string) => void
}) {
  const { t } = useT('admin')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 1 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid gap-1.5 rounded-lg border border-border/50 bg-muted/15 p-2 sm:gap-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0',
        // Mobile: row1 = grip | label | delete; row2 = start | end under label/delete columns
        'max-sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]',
        'sm:grid-cols-[minmax(0,2.25rem)_minmax(0,9rem)_auto_auto_auto] sm:items-center',
      )}
    >
      <button
        type="button"
        className={cn(
          'flex shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted/80 active:cursor-grabbing',
          'row-start-1 col-start-1 sm:row-start-1 sm:col-start-1',
          'h-8 w-8 sm:h-9 sm:w-9',
        )}
        aria-label={t('sortablePeriodTemplate.dragToReorder')}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
      <Input
        value={row.label}
        onChange={(e) => patchItem(row.id, { label: e.target.value })}
        placeholder={t('sortablePeriodTemplate.labelPlaceholder')}
        className={cn(
          'h-8 min-w-0 px-2.5 text-sm sm:h-9 sm:px-3',
          'row-start-1 col-start-2 sm:row-start-1 sm:col-start-2',
        )}
      />
      <Input
        type="time"
        step={60}
        value={row.startTime}
        onChange={(e) => patchItem(row.id, { startTime: e.target.value })}
        className={cn(
          'h-8 min-w-0 px-2.5 font-mono text-sm sm:h-9 sm:px-3',
          'row-start-2 col-start-2 w-full sm:row-start-1 sm:col-start-3 sm:w-[7.5rem]',
        )}
      />
      <Input
        type="time"
        step={60}
        value={row.endTime}
        onChange={(e) => patchItem(row.id, { endTime: e.target.value })}
        className={cn(
          'h-8 min-w-0 px-2.5 font-mono text-sm sm:h-9 sm:px-3',
          'row-start-2 col-start-3 w-full sm:row-start-1 sm:col-start-4 sm:w-[7.5rem]',
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 shrink-0 px-2 text-xs text-destructive sm:px-3 sm:text-sm',
          'row-start-1 col-start-3 justify-self-end sm:row-start-1 sm:col-start-5 sm:justify-self-start',
        )}
        onClick={() => removeItem(row.id)}
      >
        {t('common.delete')}
      </Button>
    </div>
  )
}

export function SortablePeriodTemplatePart({
  part,
  rows,
  onReorderOrderedIds,
  patchItem,
  removeItem,
}: SortablePeriodTemplatePartProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const ids = rows.map((r) => r.id)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const nextIds = arrayMove(ids, oldIndex, newIndex)
    onReorderOrderedIds(part, nextIds)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5 sm:space-y-2">
          {rows.map((row) => (
            <SortablePeriodRow
              key={row.id}
              row={row}
              patchItem={patchItem}
              removeItem={removeItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
