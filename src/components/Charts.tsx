import { FEATURE_META } from '../data'
import type { GainDetail } from '../types'

export function GainBarChart({
  gains,
  compact = false,
}: {
  gains: GainDetail[]
  compact?: boolean
}) {
  if (!gains.length) {
    return <div className="chart-placeholder">训练后生成信息增益排序图</div>
  }
  const max = Math.max(...gains.map((item) => item.gain), 0.001)

  return (
    <div className={`gain-chart ${compact ? 'compact' : ''}`}>
      {gains.map((item, index) => (
        <div className="gain-row" key={item.feature}>
          <div className="gain-label">
            <span>{FEATURE_META[item.feature].shortName}</span>
            {index === 0 && <em>最优</em>}
          </div>
          <div className="gain-track">
            <div
              className="gain-fill"
              style={{ width: `${Math.max(2, (item.gain / max) * 100)}%` }}
              title={`${FEATURE_META[item.feature].name}
数据集熵：${item.baseEntropy.toFixed(4)}
分支加权熵：${item.conditionalEntropy.toFixed(4)}
信息增益：${item.gain.toFixed(4)}`}
            />
          </div>
          <strong>{item.gain.toFixed(4)}</strong>
        </div>
      ))}
    </div>
  )
}

export function PurityLineChart({
  values,
  activeIndex,
}: {
  values: number[]
  activeIndex: number
}) {
  const width = 520
  const height = 190
  const inset = { left: 38, right: 20, top: 20, bottom: 32 }
  const plotWidth = width - inset.left - inset.right
  const plotHeight = height - inset.top - inset.bottom
  const safeValues = values.length ? values : [0]
  const points = safeValues.map((value, index) => {
    const x =
      inset.left +
      (safeValues.length === 1
        ? 0
        : (index / (safeValues.length - 1)) * plotWidth)
    const y = inset.top + (1 - Math.min(1, Math.max(0, value))) * plotHeight
    return { x, y, value, index }
  })

  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="各层节点平均熵变化折线图"
    >
      {[0, 0.5, 1].map((tick) => {
        const y = inset.top + (1 - tick) * plotHeight
        return (
          <g key={tick}>
            <line
              x1={inset.left}
              x2={width - inset.right}
              y1={y}
              y2={y}
              className="grid-line"
            />
            <text x={8} y={y + 4} className="axis-label">
              {tick.toFixed(1)}
            </text>
          </g>
        )
      })}
      <line
        x1={inset.left}
        x2={width - inset.right}
        y1={height - inset.bottom}
        y2={height - inset.bottom}
        className="axis-line"
      />
      {points.length > 1 && (
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          className="entropy-line-glow"
        />
      )}
      {points.length > 1 && (
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          className="entropy-line"
        />
      )}
      {points.map((point) => (
        <g key={point.index}>
          <circle
            cx={point.x}
            cy={point.y}
            r={point.index === activeIndex ? 6 : 4}
            className={point.index === activeIndex ? 'active-dot' : 'line-dot'}
          >
            <title>{`第 ${point.index} 层：平均熵 ${point.value.toFixed(4)}`}</title>
          </circle>
          <text
            x={point.x}
            y={height - 10}
            textAnchor="middle"
            className="axis-label"
          >
            L{point.index}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function ApprovalRateChart({
  groups,
}: {
  groups: Array<{ label: string; rate: number; total: number }>
}) {
  return (
    <div className="approval-chart">
      {groups.map((group) => (
        <div className="approval-row" key={group.label}>
          <span>{group.label}</span>
          <div>
            <i style={{ width: `${group.rate * 100}%` }} />
          </div>
          <strong title={`${group.total} 个样本`}>
            {(group.rate * 100).toFixed(1)}%
          </strong>
        </div>
      ))}
    </div>
  )
}
