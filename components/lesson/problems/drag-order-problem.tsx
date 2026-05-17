'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Problem, DragOrderContent } from '@/lib/types/lesson'

interface SortableItemProps {
  id: string
  value: string
  disabled: boolean
}

function SortableItem({ id, value, disabled }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    disabled,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 p-3 bg-card border rounded-xl cursor-grab active:cursor-grabbing"
    >
      <span className="text-muted-foreground select-none">⋮⋮</span>
      <span>{value}</span>
    </div>
  )
}

interface Props {
  problem: Problem
  onSubmit: (answer: string[]) => void
  disabled: boolean
}

export default function DragOrderProblem({ problem, onSubmit, disabled }: Props) {
  const content = problem.content as DragOrderContent
  const [items, setItems] = useState(
    content.items.map((value, i) => ({ id: `item-${i}`, value }))
  )
  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems(prev => {
        const oldIdx = prev.findIndex(i => i.id === active.id)
        const newIdx = prev.findIndex(i => i.id === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-base">{content.question}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(item => (
              <SortableItem key={item.id} id={item.id} value={item.value} disabled={disabled} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        onClick={() => onSubmit(items.map(i => i.value))}
        disabled={disabled}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
      >
        제출
      </button>
    </div>
  )
}
