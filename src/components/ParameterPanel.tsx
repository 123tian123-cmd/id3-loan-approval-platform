import {
  Gauge,
  Layers3,
  Leaf,
  ShieldCheck,
  SlidersHorizontal,
  SplitSquareVertical,
} from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
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
  range: string
  icon: typeof Layers3
  tip: string
}> = [
  {
    key: 'maxDepth',
    name: '限制最大深度',
    subtitle: '控制决策树整体层数',
    min: 0,
    max: 12,
    step: 1,
    range: '推荐 2–6',
    icon: Layers3,
    tip: '数值过大容易过拟合，过小会削弱模型分类能力。',
  },
  {
    key: 'minLeafSamples',
    name: '限制叶子最小样本数',
    subtitle: '叶子节点最少容纳样本',
    min: 0,
    max: 20,
    step: 1,
    range: '推荐 1–5',
    icon: Leaf,
    tip: '数值越大，树结构越简单；过大可能让有价值的少数分支无法形成。',
  },
  {
    key: 'minSplitSamples',
    name: '限制分裂最小样本数',
    subtitle: '中间节点继续分裂的门槛',
    min: 0,
    max: 30,
    step: 1,
    range: '推荐 2–10',
    icon: SplitSquareVertical,
    tip: '节点样本数低于该值就停止分裂，可减少小样本造成的不稳定规则。',
  },
  {
    key: 'minGain',
    name: '限制最小信息增益阈值',
    subtitle: '划分所需最低信息增益',
    min: 0,
    max: 1,
    step: 0.01,
    range: '推荐 0.01–0.30',
    icon: Gauge,
    tip: '候选特征增益低于阈值时停止分裂；提高阈值会使树更浅、更保守。',
  },
]

function structureSummary(values: TreeConstraints) {
  const strength =
    (values.maxDepth <= 2 ? 2 : values.maxDepth <= 4 ? 1 : 0) +
    (values.minLeafSamples >= 3 ? 1 : 0) +
    (values.minSplitSamples >= 6 ? 1 : 0) +
    (values.minGain >= 0.1 ? 2 : values.minGain >= 0.03 ? 1 : 0)
  if (strength >= 4) {
    return {
      title: '强约束 · 树结构偏浅',
      text: '泛化更稳定、规则更容易解释，但可能忽略少数样本中的有效模式。',
      tone: 'conservative',
    }
  }
  if (strength <= 1) {
    return {
      title: '弱约束 · 树结构偏深',
      text: '分类路径更细致，训练集拟合能力更强，同时需要关注过拟合风险。',
      tone: 'loose',
    }
  }
  return {
    title: '平衡约束 · 适合教学',
    text: '当前配置兼顾分类能力与可解释性，适合展示完整的信息增益递归过程。',
    tone: 'balanced',
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
  const summary = structureSummary(constraints)

  const update = (key: keyof TreeConstraints, value: number) => {
    if (!Number.isFinite(value) || value < 0) return
    setConstraints((current) => ({ ...current, [key]: value }))
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
                    {item.tip} {item.range}。
                  </TeachingTip>
                </div>
                <span>{item.subtitle}</span>
                <small>{item.range}</small>
              </div>
              <div className="parameter-input">
                <input
                  id={`param-${item.key}`}
                  type="number"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={constraints[item.key]}
                  onChange={(event) =>
                    update(item.key, event.target.valueAsNumber)
                  }
                  onKeyDown={(event) => {
                    if (['-', 'e', 'E', '+'].includes(event.key)) {
                      event.preventDefault()
                    }
                  }}
                />
                {item.key === 'minGain' && <span>Gain</span>}
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
                setConstraints({ ...preset.values })
                onNotice(`已应用${name}，重新训练后生效`)
              }}
            >
              <span>{name.slice(0, 2)}</span>
              <div>
                <strong>{name}</strong>
                <small>{preset.description}</small>
              </div>
              <i>
                深度 {preset.values.maxDepth} · 增益{' '}
                {preset.values.minGain}
              </i>
            </button>
          ))}
        </div>
      </div>

    </Section>
  )
}
