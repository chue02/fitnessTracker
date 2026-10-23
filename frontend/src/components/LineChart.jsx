import { useState } from 'react'
import { formatDuration, isoDate, parseIso, round } from '../format.js'

// Drawn in a fixed coordinate space and scaled to the card's width by the
// viewBox, so there's nothing to measure.
const W = 600
const H = 170
const PAD = { top: 14, right: 16, bottom: 26, left: 56 }
const DAY_MS = 24 * 60 * 60 * 1000
// Tick steps for durations, in seconds, so axes read 7:30 / 8:00, not 7:27.
const TIME_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200]

// "Mar 3", or "Mar 3, 25" when the chart spans more than one year.
const shortDate = (iso, withYear) =>
  parseIso(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear && { year: '2-digit' }),
  })

// 3–5 round tick values covering [min, max]: 2.5 / 5 / 10 / 25 … steps, or
// clock-friendly ones for durations.
function niceTicks(min, max, time) {
  const span = max - min || Math.max(1, max * 0.1)
  const raw = span / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const steps = time ? TIME_STEPS : [1, 2.5, 5, 10].map((m) => m * mag)
  const step = steps.find((s) => s >= raw) ?? steps[steps.length - 1]
  const lo = Math.floor((min - span * 0.1) / step) * step
  const hi = Math.ceil((max + span * 0.1) / step) * step
  const ticks = []
  for (let v = Math.max(0, lo); v <= hi + step / 2; v += step) ticks.push(round(v, 2))
  return ticks
}

// A single-series line over dates, shared by every chart in the app: y-axis
// ticks, a hover/focus tooltip per point, and two drawing modes.
//
// `points` are { date, value, tip } oldest first, where `tip` is the hover
// text. `label` names the series for screen readers.
//   - `step` draws a staircase: each value holds until the next one (a PR
//     stands until it's beaten). Off, points are joined directly.
//   - `extendToToday` runs the line on past the last point to today, for a
//     value that's still current (the latest PR). The axis then ends "Today".
//   - `time` treats values as seconds (ticks read as m:ss).
//   - `lowerIsBetter` flips the axis so an improvement still climbs — for
//     pace, faster is up.
export default function LineChart({
  points: data,
  label,
  step = false,
  extendToToday = false,
  time = false,
  lowerIsBetter = false,
  today = isoDate(new Date()),
}) {
  const [active, setActive] = useState(null)
  const fmt = (v) => (time ? formatDuration(Math.round(v)) : v.toLocaleString())

  const points = data.map((d) => ({ d, t: parseIso(d.date).getTime(), v: d.value }))

  const t0 = points[0].t
  const tLast = points[points.length - 1].t
  const tEnd = extendToToday ? Math.max(parseIso(today).getTime(), tLast) : tLast
  // A single day still needs some width to draw across.
  const tSpan = Math.max(tEnd - t0, DAY_MS)

  const values = points.map((p) => p.v)
  const ticks = niceTicks(Math.min(...values), Math.max(...values), time)
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]

  const x = (t) => PAD.left + ((t - t0) / tSpan) * (W - PAD.left - PAD.right)
  const y = (v) => {
    const f = (v - yMin) / (yMax - yMin || 1)
    return PAD.top + (lowerIsBetter ? f : 1 - f) * (H - PAD.top - PAD.bottom)
  }

  const endIso = isoDate(new Date(tEnd))
  const multiYear = data[0].date.slice(0, 4) !== endIso.slice(0, 4)
  const date = (iso) => shortDate(iso, multiYear)

  let path = ''
  points.forEach((p, i) => {
    if (i === 0) path += `M${x(p.t)},${y(p.v)}`
    else path += step ? `H${x(p.t)}V${y(p.v)}` : `L${x(p.t)},${y(p.v)}`
  })
  if (tEnd > tLast) path += `H${x(tEnd)}`

  const hovered = active === null ? null : points[active]

  return (
    <div className="line-chart" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} over time`}>
        {ticks.map((v) => (
          <g key={v}>
            <line className="line-chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="line-chart-axis" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        ))}
        <text className="line-chart-axis" x={PAD.left} y={H - 6} textAnchor="start">
          {date(data[0].date)}
        </text>
        <text className="line-chart-axis" x={W - PAD.right} y={H - 6} textAnchor="end">
          {tEnd > tLast ? 'Today' : date(data[data.length - 1].date)}
        </text>

        <path className="line-chart-line" d={path} />

        {points.map((p, i) => (
          <g
            key={`${p.d.date}-${i}`}
            className="line-chart-point"
            tabIndex={0}
            aria-label={`${date(p.d.date)}: ${p.d.tip}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            {/* Invisible, larger hit target so the dot is easy to hover. */}
            <circle cx={x(p.t)} cy={y(p.v)} r={14} fill="transparent" />
            <circle className="line-chart-dot" cx={x(p.t)} cy={y(p.v)} r={active === i ? 6 : 4.5} />
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          className="line-chart-tip"
          // Kept off the card's edges so the box isn't cut off at either end.
          style={{
            left: `${Math.min(Math.max((x(hovered.t) / W) * 100, 12), 88)}%`,
            top: `${(y(hovered.v) / H) * 100}%`,
          }}
        >
          <div className="line-chart-tip-value">{hovered.d.tip}</div>
          <div className="muted">{date(hovered.d.date)}</div>
        </div>
      )}
    </div>
  )
}
