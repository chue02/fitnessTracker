import { useState } from 'react'
import { isoDate, lbToKg, parseIso, round } from '../format.js'

// Drawn in a fixed coordinate space and scaled to the card's width by the
// viewBox, so there's nothing to measure.
const W = 600
const H = 170
const PAD = { top: 14, right: 16, bottom: 26, left: 44 }
const DAY_MS = 24 * 60 * 60 * 1000

const shortDate = (iso) =>
  parseIso(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })

// 3–5 round tick values covering [min, max] (2.5 / 5 / 10 / 25 … steps).
function niceTicks(min, max) {
  const span = max - min || Math.max(1, max * 0.1)
  const raw = span / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const lo = Math.floor((min - span * 0.1) / step) * step
  const hi = Math.ceil((max + span * 0.1) / step) * step
  const ticks = []
  for (let v = Math.max(0, lo); v <= hi + step / 2; v += step) ticks.push(round(v, 2))
  return ticks
}

// A lift's PR progression as a step line: each record holds until the next one
// beats it, and the last runs on to today because it still stands. Values are
// lb-normalized (records can mix units) and shown in the user's unit.
export default function PrChart({ records, unit = 'lb', today = isoDate(new Date()) }) {
  const [active, setActive] = useState(null)

  const value = (r) => (unit === 'kg' ? lbToKg(r.lb) : round(r.lb, 1))
  const points = records.map((r) => ({ r, t: parseIso(r.date).getTime(), v: value(r) }))

  const t0 = points[0].t
  const tEnd = Math.max(parseIso(today).getTime(), points[points.length - 1].t)
  // A lone record set today still needs some width to draw across.
  const tSpan = Math.max(tEnd - t0, DAY_MS)
  const ticks = niceTicks(Math.min(...points.map((p) => p.v)), Math.max(...points.map((p) => p.v)))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]

  const x = (t) => PAD.left + ((t - t0) / tSpan) * (W - PAD.left - PAD.right)
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom)

  let path = ''
  points.forEach((p, i) => {
    path += i === 0 ? `M${x(p.t)},${y(p.v)}` : `H${x(p.t)}V${y(p.v)}`
  })
  path += `H${x(tEnd)}`

  const hovered = active === null ? null : points[active]

  return (
    <div className="pr-chart" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`PR progression in ${unit}`}>
        {ticks.map((v) => (
          <g key={v}>
            <line className="pr-chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="pr-chart-axis" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <text className="pr-chart-axis" x={PAD.left} y={H - 6} textAnchor="start">
          {shortDate(records[0].date)}
        </text>
        <text className="pr-chart-axis" x={W - PAD.right} y={H - 6} textAnchor="end">
          {tEnd > points[points.length - 1].t ? 'Today' : shortDate(records[records.length - 1].date)}
        </text>

        <path className="pr-chart-line" d={path} />

        {points.map((p, i) => (
          <g
            key={`${p.r.date}-${i}`}
            className="pr-chart-point"
            tabIndex={0}
            aria-label={`${shortDate(p.r.date)}: ${p.v} ${unit}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            {/* Invisible, larger hit target so the dot is easy to hover. */}
            <circle cx={x(p.t)} cy={y(p.v)} r={14} fill="transparent" />
            <circle className="pr-chart-dot" cx={x(p.t)} cy={y(p.v)} r={active === i ? 6 : 4.5} />
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          className="pr-chart-tip"
          // Kept off the card's edges so the box isn't cut off at either end.
          style={{
            left: `${Math.min(Math.max((x(hovered.t) / W) * 100, 12), 88)}%`,
            top: `${(y(hovered.v) / H) * 100}%`,
          }}
        >
          <div className="pr-chart-tip-value">
            {hovered.r.weight} {hovered.r.weightUnit} × {hovered.r.reps}
          </div>
          <div className="muted">{shortDate(hovered.r.date)}</div>
        </div>
      )}
    </div>
  )
}
