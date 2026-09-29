import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// One draggable row in a dnd-kit SortableContext. `children` is a render
// function handed the drag handle, so each caller decides where it sits. Only
// the handle starts a drag: the rest of the card stays clickable/typeable and
// scrolls normally on touch.
export default function SortableItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="drag-handle"
      aria-label="Drag to reorder"
      title="Drag to reorder"
      // Don't let a drag's trailing click expand/collapse the card underneath.
      onClick={(e) => e.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  )

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'dragging' : undefined}>
      {children(handle)}
    </div>
  )
}
