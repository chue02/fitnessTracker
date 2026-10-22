import { useState } from 'react'
import ResistanceTag from './ResistanceTag.jsx'

const COLUMNS = 6

// The five stat columns, each with a short explanation surfaced on hover.
// WAVG is the one that genuinely needs explaining: it's volume per rep, so a
// heavy set of 5 counts for more than a light set of 5 — not a flat mean of
// the set weights.
const STAT_COLUMNS = [
  {
    key: 'maxLb',
    label: 'Max lb',
    title: 'Heaviest set',
    body: 'The single heaviest load lifted. Sets logged in kg are converted to pounds; calisthenics sets count the bodyweight recorded with that workout plus any added weight.',
  },
  {
    key: 'wtdAvgLb',
    label: 'WAVG',
    title: 'Weighted average load',
    body: 'Total volume ÷ total reps, so heavier sets pull the average up more than light ones.',
  },
  {
    key: 'sets',
    label: 'Sets',
    title: 'Sets logged',
    body: 'Working sets only — warmups are excluded from every column here.',
  },
  { key: 'reps', label: 'Reps', title: 'Total reps', body: 'Every rep across those sets, added up.' },
  {
    key: 'avgRepsPerSet',
    label: 'Reps/set',
    title: 'Average reps per set',
    body: 'Total reps ÷ total sets.',
  },
]

// A column heading that explains itself. Hover or keyboard focus reveals it;
// the tooltip is pure CSS, so there's no hover state to track in React.
function ColHeader({ label, title, body, numeric = false }) {
  return (
    <th className={numeric ? 'bd-num' : undefined} tabIndex={0} scope="col">
      {label}
      <span className="col-tip" role="tooltip">
        <span className="col-tip-title">{title}</span>
        <span className="col-tip-body">{body}</span>
      </span>
    </th>
  )
}

// At most one decimal, with a trailing ".0" trimmed — 32.5 stays 32.5, 40.0
// becomes 40. Null means there was nothing to measure (no set with a known load).
function num(n) {
  if (n == null) return '—'
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function StatCells({ stats }) {
  return (
    <>
      <td className="bd-num">{num(stats.maxLb)}</td>
      <td className="bd-num">{num(stats.wtdAvgLb)}</td>
      <td className="bd-num">{stats.sets}</td>
      <td className="bd-num">{stats.reps}</td>
      <td className="bd-num">{num(stats.avgRepsPerSet)}</td>
    </>
  )
}

// The "By exercise / By muscle" switch that drives `by`.
export function ByToggle({ by, onChange }) {
  const byMuscle = by === 'muscle'
  return (
    <span className="row" style={{ gap: 6 }}>
      <button className={`btn small${byMuscle ? ' ghost' : ''}`} onClick={() => onChange('exercise')}>
        By exercise
      </button>
      <button className={`btn small${byMuscle ? '' : ' ghost'}`} onClick={() => onChange('muscle')}>
        By muscle
      </button>
    </span>
  )
}

// The pivot table for a `breakdown()` result: one collapsible section per
// split. With `showTotals`, each split's header row carries its subtotal, so
// it stays visible while the section is collapsed.
export default function BreakdownTable({ sections, by, showTotals = false }) {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const byMuscle = by === 'muscle'

  function toggle(split) {
    const next = new Set(collapsed)
    if (next.has(split)) next.delete(split)
    else next.add(split)
    setCollapsed(next)
  }

  return (
    <table className="breakdown">
      <thead>
        <tr>
          <ColHeader
            label={byMuscle ? 'Muscle' : 'Exercise'}
            title={byMuscle ? 'Primary muscle' : 'Exercise'}
            body={
              byMuscle
                ? 'Each lift counts toward its primary muscle only, not the secondary ones it also works.'
                : 'The lift, tagged with the resistance it was performed on. The same lift on two resistances is two rows.'
            }
          />
          {/* `key` is destructured out so it isn't spread into props. */}
          {STAT_COLUMNS.map(({ key, ...col }) => (
            <ColHeader key={key} numeric {...col} />
          ))}
        </tr>
      </thead>
      <tbody>
        {sections.map((section) => (
          <Section
            key={section.split}
            section={section}
            byMuscle={byMuscle}
            showTotals={showTotals}
            isCollapsed={collapsed.has(section.split)}
            onToggle={() => toggle(section.split)}
          />
        ))}
      </tbody>
    </table>
  )
}

function Section({ section, byMuscle, showTotals, isCollapsed, onToggle }) {
  return (
    <>
      <tr className={`bd-split${showTotals ? ' bd-total' : ''}`}>
        <th colSpan={showTotals ? 1 : COLUMNS} scope="rowgroup">
          <button
            className="bd-toggle"
            aria-expanded={!isCollapsed}
            onClick={onToggle}
          >
            <span className="bd-caret">{isCollapsed ? '▸' : '▾'}</span>
            <span className={`pill ${section.split}`}>{section.split}</span>
            {showTotals && <span>total</span>}
          </button>
        </th>
        {showTotals && <StatCells stats={section.totals} />}
      </tr>

      {!isCollapsed &&
        section.rows.map((row) => (
          <tr key={row.key}>
            <td className={byMuscle ? 'bd-muscle' : ''}>
              {row.label}
              {!byMuscle && <ResistanceTag equipment={row.group} />}
            </td>
            <StatCells stats={row} />
          </tr>
        ))}
    </>
  )
}
