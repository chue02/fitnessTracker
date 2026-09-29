import { useRef } from 'react'
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDndMonitor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const INTERACTIVE = 'button, input, select, textarea, a, label, [contenteditable]'

// Whether the point (x, y) is on `el`'s own text. A styled chip (pill, muscle
// tag — anything with a border or background) counts as content across its
// whole box; for plain text blocks only the rendered glyphs count, so the
// blank space after a short line (e.g. a set summary) is still a grip.
function isOnOwnText(el, x, y) {
  const texts = [...el.childNodes].filter(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
  )
  if (texts.length === 0) return false
  const cs = getComputedStyle(el)
  if (parseFloat(cs.borderTopWidth) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') return true
  if (x == null) return true
  const range = document.createRange()
  const pad = 2
  return texts.some((n) => {
    range.selectNodeContents(n)
    return [...range.getClientRects()].some(
      (r) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad
    )
  })
}

// Whether a press may start a drag. The whole card is draggable, but only from
// its empty space: controls keep working and text stays selectable. The handle
// is always a valid grip.
function isDragSurface(event) {
  const el = event.target
  if (!(el instanceof Element)) return false
  if (el.closest('[data-drag-handle]')) return true
  if (el.closest(INTERACTIVE)) return false
  const point = event.touches?.[0] ?? event
  return !isOnOwnText(el, point.clientX, point.clientY)
}

// Wrap a dnd-kit sensor so it only activates from a drag surface.
function surfaceOnly(Sensor) {
  return class extends Sensor {
    static activators = Sensor.activators.map(({ eventName, handler }) => ({
      eventName,
      handler: (event, options) => isDragSurface(event.nativeEvent) && handler(event, options),
    }))
  }
}

const SurfaceMouseSensor = surfaceOnly(MouseSensor)
const SurfaceTouchSensor = surfaceOnly(TouchSensor)
const SurfaceKeyboardSensor = surfaceOnly(KeyboardSensor)

// Sensors for a list of SortableItems. Mouse drags start after a few pixels so
// a plain click still clicks. Touch needs a short press-and-hold, so a swipe
// across a card still scrolls the page.
export function useReorderSensors() {
  return useSensors(
    useSensor(SurfaceMouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(SurfaceTouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(SurfaceKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
}

// Apply a finished drag to a list of blocks keyed by `key`.
export function moveByKey(items, { active, over }) {
  if (!over || active.id === over.id) return items
  const from = items.findIndex((it) => it.key === active.id)
  const to = items.findIndex((it) => it.key === over.id)
  return arrayMove(items, from, to)
}

// One draggable card in a dnd-kit SortableContext. `children` is a render
// function handed the drag handle, so each caller decides where it sits.
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

  // Releasing a mouse drag fires a click on the card under the pointer; swallow
  // it so a condensed card doesn't expand just because it was moved.
  const lastDragEnd = useRef(0)
  useDndMonitor({
    onDragEnd: () => (lastDragEnd.current = Date.now()),
    onDragCancel: () => (lastDragEnd.current = Date.now()),
  })
  function swallowClickAfterDrag(e) {
    if (Date.now() - lastDragEnd.current < 150) e.stopPropagation()
  }

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }

  // Focus/ARIA live on the handle so keyboard users have something to tab to;
  // the pointer listeners live on the whole card.
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="drag-handle"
      data-drag-handle
      aria-label="Drag to reorder"
      title="Drag to reorder"
      onClick={(e) => e.stopPropagation()}
      {...attributes}
    >
      ⠿
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={'sortable-item' + (isDragging ? ' dragging' : '')}
      onClickCapture={swallowClickAfterDrag}
      {...listeners}
    >
      {children(handle)}
    </div>
  )
}
