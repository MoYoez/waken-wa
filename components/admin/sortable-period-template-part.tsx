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

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SchedulePeriodPart, SchedulePeriodTemplateItem } from '@/lib/schedule-courses'

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
      className="grid gap-2 sm:grid-cols-[minmax(0,2.25rem)_minmax(0,9rem)_auto_auto_auto] sm:items-center"
    >
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted/80 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        value={row.label}
        onChange={(e) => patchItem(row.id, { label: e.target.value })}
        placeholder="如：1-2节"
        className="h-9"
      />
      <Input
        type="time"
        step={60}
        value={row.startTime}
        onChange={(e) => patchItem(row.id, { startTime: e.target.value })}
        className="h-9 w-[7.5rem] font-mono"
      />
      <Input
        type="time"
        step={60}
        value={row.endTime}
        onChange={(e) => patchItem(row.id, { endTime: e.target.value })}
        className="h-9 w-[7.5rem] font-mono"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => removeItem(row.id)}
      >
        删除
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
        <div className="space-y-2">
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
