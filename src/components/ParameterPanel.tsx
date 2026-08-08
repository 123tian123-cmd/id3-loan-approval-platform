import {
  Gauge,
  Layers3,
  Leaf,
  ShieldCheck,
  SlidersHorizontal,
  SplitSquareVertical,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { CONSTRAINT_PRESETS } from '../data'
import type { TreeConstraints } from '../types'
import { Section, TeachingTip } from './ui'

const PARAM_META: Array<{
  key: keyof TreeConstraints
  name: string
  subtitle: string
  min: number
  max: number
  step: number
  range?: string
  icon: typeof Layers3
  tip: string
}> = [
  {
    key: 'maxDepth',
    name: '限制最大深度',
    subtitle: '控制决策树整体层数',
    min: 0,
    max: 10,
    step: 1,
    range: '推荐 3–10',
    icon: Layers3,
    tip: '数值越大，决策树可生成的层级越多；数值越小，预剪枝约束越强。',
  },
  {
    key: 'minLeafSamples',
    name: '限制叶子最小样本数',
    subtitle: '叶子节点最少容纳样本',
    min: 0,
    max: 300,
    step: 1,
    range: '推荐 10–20',
    icon: Leaf,
    tip: '数值越大，树结构越简单；建议结合少数类别规模避免生成不稳定叶子。',
  },
  {
    key: 'minSplitSamples',
    name: '限制分裂最小样本数',
    subtitle: '中间节点继续分裂的门槛',
    min: 0,
    max: 600,
    step: 1,
    range: '推荐 20–50',
    icon: SplitSquareVertical,
    tip: '节点样本数低于该值就停止分裂，可减少小样本造成的不稳定规则。',
  },
  {
    key: 'minGain',
    name: '限制最小信息增益阈值',
    subtitle: '划分所需最低信息增益',
    min: 0,
    max: 1,
    step: 0.001,
    icon: Gauge,
    tip: '候选特征增益低于阈值时停止分裂；提高阈值会使树更浅、更保守。',
  },
]

type ConstraintKey = keyof TreeConstraints
type ConstraintDrafts = Record<ConstraintKey, string>
type StructureTone = 'conservative' | 'balanced' | 'loose' | 'invalid'

interface StructureSummary {
  title: string
  text: string
  tone: StructureTone
}

function toDrafts(values: TreeConstraints): ConstraintDrafts {
  return {
    maxDepth: String(values.maxDepth),
    minLeafSamples: String(values.minLeafSamples),
    minSplitSamples: String(values.minSplitSamples),
    minGain: String(values.minGain),
  }
}

function isValidParameter(
  item: (typeof PARAM_META)[number],
  rawValue: string,
): boolean {
  const value = Number(rawValue)
  return (
    rawValue.trim() !== '' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= item.max &&
    (item.step !== 1 || Number.isInteger(value))
  )
}

function structureSummary(values: TreeConstraints): StructureSummary {
  const scores = {
    A: values.maxDepth <= 3 ? 1 : values.maxDepth <= 5 ? 2 : 3,
    B: values.minLeafSamples >= 18 ? 1 : values.minLeafSamples >= 12 ? 2 : 3,
    C:
      values.minSplitSamples >= 40
        ? 1
        : values.minSplitSamples >= 28
          ? 2
          : 3,
    D: values.minGain >= 0.07 ? 1 : values.minGain >= 0.03 ? 2 : 3,
  }

  let score =
    0.4 * scores.A + 0.3 * scores.C + 0.2 * scores.B + 0.1 * scores.D
  const corrections: string[] = []

  if (values.maxDepth >= 6) {
    score += 0.3
    corrections.push('A≥6：+0.3')
  }
  if (values.maxDepth <= 3 && values.minSplitSamples >= 40) {
    score -= 0.2
    corrections.push('A≤3 且 C≥40：-0.2')
  }
  if (values.minGain >= 0.08) {
    score -= 0.1
    corrections.push('D≥0.08：-0.1')
  } else if (values.minGain <= 0.01) {
    score += 0.1
    corrections.push('D≤0.01：+0.1')
  }

  const scoreText = `加权得分 ${score.toFixed(2)}（A ${scores.A}分、B ${scores.B}分、C ${scores.C}分、D ${scores.D}分）`
  const correctionText = corrections.length
    ? `；极端修正：${corrections.join('，')}`
    : '；未触发极端修正'

  if (score <= 1.6) {
    return {
      title: '强约束 · 树结构偏浅',
      text: `${scoreText}${correctionText}。当前分裂条件严格，模型结构更精简。`,
      tone: 'conservative',
    }
  }
  if (score <= 2.4) {
    return {
      title: '均衡模式 · 结构与拟合能力适中',
      text: `${scoreText}${correctionText}。当前配置兼顾分类能力、稳定性与可解释性。`,
      tone: 'balanced',
    }
  }
  return {
    title: '弱约束 · 过拟合风险较高',
    text: `${scoreText}${correctionText}。当前配置允许更多细分节点，需要关注局部噪声。`,
    tone: 'loose',
  }
}

export function ParameterPanel({
  constraints,
  setConstraints,
  onNotice,
}: {
  constraints: TreeConstraints
  setConstraints: Dispatch<SetStateAction<TreeConstraints>>
  onNotice: (message: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const [drafts, setDrafts] = useState<ConstraintDrafts>(() =>
    toDrafts(constraints),
  )

  useEffect(() => {
    setDrafts(toDrafts(constraints))
  }, [
    constraints.maxDepth,
    constraints.minLeafSamples,
    constraints.minSplitSamples,
    constraints.minGain,
  ])

  const invalidKeys = useMemo(
    () =>
      new Set(
        PARAM_META.filter((item) => !isValidParameter(item, drafts[item.key]))
          .map((item) => item.key),
      ),
    [drafts],
  )

  const summary: StructureSummary = invalidKeys.size
    ? {
        title: '参数无效 · 已暂停结构判定',
        text: '四项参数均须为大于 0 且不超过输入上限的有效数值，请修正红色输入项。',
        tone: 'invalid',
      }
    : structureSummary({
        maxDepth: Number(drafts.maxDepth),
        minLeafSamples: Number(drafts.minLeafSamples),
        minSplitSamples: Number(drafts.minSplitSamples),
        minGain: Number(drafts.minGain),
      })

  const update = (
    item: (typeof PARAM_META)[number],
    rawValue: string,
  ) => {
    setDrafts((current) => ({ ...current, [item.key]: rawValue }))
    if (!isValidParameter(item, rawValue)) return
    setConstraints((current) => ({
      ...current,
      [item.key]: Number(rawValue),
    }))
  }

  return (
    <Section
      id="parameters"
      icon={<SlidersHorizontal size={25} />}
      eyebrow="MODULE 03 · 模型约束"
      title="约束参数"
      description="通过预剪枝参数控制决策树复杂度，比较不同风控策略的结构变化。"
    >
      <div className="parameter-grid">
        {PARAM_META.map((item) => {
          const Icon = item.icon
          return (
            <article className="parameter-card" key={item.key}>
              <div className="parameter-icon">
                <Icon size={20} />
              </div>
              <div className="parameter-copy">
                <div>
                  <label htmlFor={`param-${item.key}`}>{item.name}</label>
                  <TeachingTip title={item.name}>
                    {item.tip}
                    {item.range ? ` ${item.range}。` : ''}
                  </TeachingTip>
                </div>
                <span>{item.subtitle}</span>
                {item.range && <small>{item.range}</small>}
              </div>
              <div
                className={`parameter-input ${
                  invalidKeys.has(item.key) ? 'invalid' : ''
                }`}
              >
                <input
                  id={`param-${item.key}`}
                  type="number"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={drafts[item.key]}
                  aria-invalid={invalidKeys.has(item.key)}
                  onChange={(event) => update(item, event.target.value)}
                  onKeyDown={(event) => {
                    if (['e', 'E', '+'].includes(event.key)) {
                      event.preventDefault()
                    }
                  }}
                />
                {item.key === 'minGain' && <span>Gain</span>}
                {invalidKeys.has(item.key) && (
                  <small className="parameter-error">请输入大于 0 的有效值</small>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <div className={`structure-impact ${summary.tone}`}>
        <ShieldCheck size={22} />
        <div>
          <span>实时结构影响预测</span>
          <strong>{summary.title}</strong>
          <p>{summary.text}</p>
        </div>
      </div>

      <div className="preset-section teaching-control">
        <div className="subheading">
          <span>约束参数快捷预设</span>
          <em>一键填充整套参数</em>
        </div>
        <div className="preset-grid">
          {Object.entries(CONSTRAINT_PRESETS).map(([name, preset]) => (
            <button
              type="button"
              key={name}
              onClick={() => {
                setDrafts(toDrafts(preset.values))
                setConstraints({ ...preset.values })
                onNotice(`已应用${name}，结构影响已重新判定`)
              }}
            >
              <span>{name.slice(0, 2)}</span>
              <div>
                <strong>{name}</strong>
                <small>{preset.description}</small>
              </div>
              <i>
                深度 {preset.values.maxDepth} · 叶子{' '}
                {preset.values.minLeafSamples} · 分裂{' '}
                {preset.values.minSplitSamples} · 增益 {preset.values.minGain}
              </i>
            </button>
          ))}
        </div>
      </div>

    </Section>
  )
}
