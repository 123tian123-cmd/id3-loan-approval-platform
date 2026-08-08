import {
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  GitBranch,
  PlayCircle,
  Route,
  ShieldAlert,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { FEATURE_META, MAPPING_DOMAINS } from '../data'
import { mapValue, predict } from '../lib/id3'
import type { PredictionFallback } from '../lib/id3'
import type {
  ApprovalLabel,
  LoanSample,
  MappingConfig,
  NumericFeatureKey,
  TreeNode,
} from '../types'
import { TreeCanvas } from './TreeCanvas'
import { Button, EmptyState, Modal, Section, TeachingTip } from './ui'

interface CaseDecision {
  label: ApprovalLabel
  risk: '低' | '中' | '高'
  path: TreeNode[]
  branches: string[]
  fallback?: PredictionFallback
}

type DirectNumericFeature = Exclude<NumericFeatureKey, 'dti'>

const CASE_NUMERIC_FEATURES: DirectNumericFeature[] = [
  'age',
  'income',
  'stability',
]

type StabilityFactorKey =
  | 'employer'
  | 'tenure'
  | 'benefits'
  | 'contract'
  | 'location'

type StabilitySelections = Record<StabilityFactorKey, number | null>

const EMPTY_STABILITY_SELECTIONS: StabilitySelections = {
  employer: null,
  tenure: null,
  benefits: null,
  contract: null,
  location: null,
}

const STABILITY_SCORE_GROUPS: Array<{
  key: StabilityFactorKey
  title: string
  options: Array<{ label: string; score: number }>
}> = [
  {
    key: 'employer',
    title: '1. 就职单位类型',
    options: [
      { label: '国企、事业单位、编制内', score: 30 },
      { label: '大型上市企业、头部正规私企', score: 20 },
      { label: '中小型普通私企', score: 10 },
      { label: '自由职业', score: 0 },
    ],
  },
  {
    key: 'tenure',
    title: '2. 当前岗位连续在职时长',
    options: [
      { label: '在职≥3年', score: 25 },
      { label: '1年≤在职＜3年', score: 15 },
      { label: '6个月≤在职＜1年', score: 8 },
      { label: '在职＜6个月、待业', score: 0 },
    ],
  },
  {
    key: 'benefits',
    title: '3. 社保公积金缴纳状态',
    options: [
      { label: '连续足额缴纳社保公积金≥2年', score: 20 },
      { label: '断续缴纳社保', score: 10 },
      { label: '未缴纳社保', score: 0 },
    ],
  },
  {
    key: 'contract',
    title: '4. 劳动合同性质',
    options: [
      { label: '长期固定劳动合同', score: 15 },
      { label: '1～3年期固定合同', score: 10 },
      { label: '短期劳务合同、无正式合同', score: 0 },
    ],
  },
  {
    key: 'location',
    title: '5. 地域从业稳定性加成',
    options: [
      { label: '一二线固定驻地工作', score: 10 },
      { label: '频繁异地外派、流动务工', score: 0 },
    ],
  },
]

function attachFallbackBranch(
  node: TreeNode,
  fallback: PredictionFallback,
): TreeNode {
  if (node.id === fallback.parentId) {
    return {
      ...node,
      branches: {
        ...node.branches,
        [fallback.branch]: fallback.node,
      },
    }
  }

  return {
    ...node,
    branches: Object.fromEntries(
      Object.entries(node.branches).map(([branch, child]) => [
        branch,
        attachFallbackBranch(child, fallback),
      ]),
    ),
  }
}

function riskLevel(
  label: ApprovalLabel,
  sample: LoanSample,
): '低' | '中' | '高' {
  const dtiRisk = sample.dti === '重' ? 2 : sample.dti === '紧' ? 1 : 0
  const riskScore = (sample.overdue === '有' ? 2 : 0) + dtiRisk
  if (label === '通过') return riskScore === 0 ? '低' : '中'
  return riskScore >= 2 ? '高' : '中'
}

function BinaryChoice({
  feature,
  value,
  onChange,
}: {
  feature: 'overdue'
  value: '有' | '无'
  onChange: (value: '有' | '无') => void
}) {
  return (
    <article className="sample-field overdue-field">
      <div className="field-title">
        <label>{FEATURE_META[feature].name}</label>
        <TeachingTip title={FEATURE_META[feature].name}>
          选择“有”表示存在信用卡历史逾期记录。
        </TeachingTip>
      </div>
      <div className="overdue-options">
        {(['无', '有'] as const).map((option) => (
          <button
            type="button"
            key={option}
            className={value === option ? 'active' : ''}
            onClick={() => onChange(option)}
          >
            <span>{option === '无' ? '✓' : '!'}</span>
            <div>
              <strong>{option}</strong>
              <small>
                {option === '无' ? '无历史逾期' : '存在逾期记录'}
              </small>
            </div>
          </button>
        ))}
      </div>
    </article>
  )
}

export function CasePanel({
  tree,
  sample,
  setSample,
  mappings,
  onNotice,
}: {
  tree: TreeNode | null
  sample: LoanSample
  setSample: Dispatch<SetStateAction<LoanSample>>
  mappings: MappingConfig
  onNotice: (message: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const [numericValues, setNumericValues] = useState<
    Record<DirectNumericFeature, string>
  >({
    age: '42',
    income: '8500',
    stability: '72',
  })
  const [debtAmount, setDebtAmount] = useState('3400')
  const [decision, setDecision] = useState<CaseDecision | null>(null)
  const [showPath, setShowPath] = useState(false)
  const [showStabilityCalculator, setShowStabilityCalculator] =
    useState(false)
  const [stabilitySelections, setStabilitySelections] =
    useState<StabilitySelections>(EMPTY_STABILITY_SELECTIONS)
  const decisionTree = useMemo(() => {
    if (!tree || !decision?.fallback) return tree
    return attachFallbackBranch(tree, decision.fallback)
  }, [tree, decision])

  const incomeValue = numericValues.income.trim()
    ? Number(numericValues.income)
    : Number.NaN
  const debtValue = debtAmount.trim() ? Number(debtAmount) : Number.NaN
  const dtiValue =
    Number.isFinite(incomeValue) &&
    incomeValue > 0 &&
    Number.isFinite(debtValue) &&
    debtValue >= 0
      ? Number(((debtValue / incomeValue) * 100).toFixed(2))
      : null
  const dtiCategory =
    dtiValue === null
      ? undefined
      : mapValue(dtiValue, 'dti', mappings, true)?.label

  useEffect(() => {
    const remapped = Object.fromEntries(
      CASE_NUMERIC_FEATURES.map((feature) => {
        const rawValue = numericValues[feature].trim()
        const numeric = rawValue ? Number(rawValue) : Number.NaN
        return [
          feature,
          Number.isFinite(numeric)
            ? mapValue(numeric, feature, mappings, true)?.label
            : undefined,
        ]
      }),
    ) as Record<DirectNumericFeature, string | undefined>

    setSample((current) => ({
      ...current,
      age: remapped.age ?? current.age,
      income: remapped.income ?? current.income,
      stability: remapped.stability ?? current.stability,
      dti: dtiCategory ?? current.dti,
    }))
    setDecision(null)
    setShowPath(false)
  }, [mappings])

  const updateNumeric = (feature: DirectNumericFeature, value: string) => {
    setNumericValues((current) => ({ ...current, [feature]: value }))
    if (!value.trim()) return
    const mapped = mapValue(Number(value), feature, mappings)
    if (mapped) {
      setSample((current) => ({ ...current, [feature]: mapped.label }))
      setDecision(null)
      setShowPath(false)
    }
  }

  const normalizeNumeric = (feature: DirectNumericFeature) => {
    const numeric = Number(numericValues[feature])
    if (!Number.isFinite(numeric)) return
    const mapped = mapValue(numeric, feature, mappings, true)
    if (!mapped) return
    setSample((current) => ({ ...current, [feature]: mapped.label }))
    if (mapped.adjusted) {
      onNotice(
        `${FEATURE_META[feature].name}数值 ${numeric} 超出映射范围，已匹配最近分类“${mapped.label}”`,
        'error',
      )
    }
  }

  const selectedStabilityFactorCount = Object.values(
    stabilitySelections,
  ).filter((score) => score !== null).length

  const applyStabilityScore = () => {
    const scores = Object.values(stabilitySelections)
    if (scores.some((score) => score === null)) {
      onNotice('请为工作稳定度的五类指标各选择一项', 'error')
      return
    }

    const total = scores.reduce<number>(
      (sum, score) => sum + (score ?? 0),
      0,
    )
    const mapped = mapValue(total, 'stability', mappings, true)
    setNumericValues((current) => ({
      ...current,
      stability: String(total),
    }))
    if (mapped) {
      setSample((current) => ({
        ...current,
        stability: mapped.label,
      }))
    }
    setDecision(null)
    setShowPath(false)
    setShowStabilityCalculator(false)
    onNotice(`工作稳定度已计算并填入：${total} 分`, 'success')
  }

  const evaluate = (revealPath: boolean) => {
    if (!tree) {
      onNotice('请先完成模型训练，再计算审批结果', 'error')
      document
        .querySelector('#training')
        ?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    const mappedValues = Object.fromEntries(
      CASE_NUMERIC_FEATURES.map((feature) => {
        const numeric = numericValues[feature].trim()
          ? Number(numericValues[feature])
          : Number.NaN
        return [
          feature,
          Number.isFinite(numeric)
            ? mapValue(numeric, feature, mappings, true)?.label
            : undefined,
        ]
      }),
    ) as Record<DirectNumericFeature, string | undefined>

    if (CASE_NUMERIC_FEATURES.some((feature) => !mappedValues[feature])) {
      onNotice('请完整填写年龄、收入和工作稳定度数字', 'error')
      return
    }
    if (dtiValue === null || !dtiCategory) {
      onNotice('请输入非负负债金额，并确保收入大于 0', 'error')
      return
    }

    const evaluatedSample: LoanSample = {
      age: mappedValues.age!,
      income: mappedValues.income!,
      stability: mappedValues.stability!,
      overdue: sample.overdue,
      dti: dtiCategory,
    }
    const prediction = predict(tree, evaluatedSample)
    const nextDecision: CaseDecision = {
      ...prediction,
      risk: riskLevel(prediction.label, evaluatedSample),
    }
    setSample(evaluatedSample)
    setDecision(nextDecision)
    setShowPath(revealPath)
    onNotice(
      revealPath
        ? `分步演练已生成：审批${prediction.label}`
        : `计算完成：审批${prediction.label}`,
    )
  }

  return (
    <Section
      id="case"
      icon={<ClipboardCheck size={25} />}
      eyebrow="MODULE 06 · 案例评估"
      title="案例输入"
      description="录入原始数字，计算审批结论，并沿训练后的剪枝决策树演示实际判断路径。"
    >
      <div className="sample-note">
        <Database size={19} />
        <p>
          年龄、收入和工作稳定度使用数字录入；DTI
          由负债金额除以收入自动计算，并按映射规则转换为分类标签。
        </p>
      </div>

      <div className="sample-input-grid case-input-grid">
        {CASE_NUMERIC_FEATURES.map((feature) => {
          const domain = MAPPING_DOMAINS[feature]
          return (
            <article className="sample-field" key={feature}>
              <div className="field-title">
                <label htmlFor={`case-${feature}`}>
                  {FEATURE_META[feature].name}
                </label>
                <div className="field-title-actions">
                  {feature === 'stability' && (
                    <button
                      type="button"
                      className="stability-calculator-trigger"
                      aria-haspopup="dialog"
                      aria-expanded={showStabilityCalculator}
                      onClick={() => setShowStabilityCalculator(true)}
                    >
                      <Calculator size={13} />
                      计算稳定度
                    </button>
                  )}
                  <TeachingTip
                    title={`${FEATURE_META[feature].name}数字录入`}
                  >
                    输入原始数字后自动映射为“
                    {mappings[feature]
                      .map((rule) => rule.label)
                      .join(' / ')}
                    ”。
                  </TeachingTip>
                </div>
              </div>
              <div className="number-map-input">
                <div>
                  <input
                    id={`case-${feature}`}
                    type="number"
                    min={domain.min}
                    max={domain.max}
                    value={numericValues[feature]}
                    onChange={(event) =>
                      updateNumeric(feature, event.target.value)
                    }
                    onBlur={() => normalizeNumeric(feature)}
                  />
                  <span>{domain.unit}</span>
                </div>
                <p>
                  自动映射
                  <ChevronRight size={14} />
                  <strong>{sample[feature]}</strong>
                </p>
              </div>
            </article>
          )
        })}

        <article className="sample-field dti-field">
          <div className="field-title">
            <label htmlFor="case-debt-amount">DTI（负债收入比）</label>
            <TeachingTip title="DTI 自动计算">
              输入与收入同口径的负债金额，系统按“负债金额 ÷ 收入 ×
              100%”计算 DTI，并映射为优、良、紧、重。
            </TeachingTip>
          </div>
          <div className="number-map-input">
            <div>
              <input
                id="case-debt-amount"
                type="number"
                min="0"
                step="0.01"
                value={debtAmount}
                aria-label="负债金额"
                onChange={(event) => {
                  setDebtAmount(event.target.value)
                  setDecision(null)
                  setShowPath(false)
                }}
              />
              <span>元/月</span>
            </div>
          </div>
          <p className="dti-formula">
            DTI = 负债金额 ÷ 收入 × 100%
          </p>
          <div className="dti-derived">
            <span>
              DTI 值
              <strong>{dtiValue === null ? '--' : `${dtiValue}%`}</strong>
            </span>
            <span>
              映射标签
              <strong>{dtiCategory ?? '--'}</strong>
            </span>
          </div>
        </article>

        <BinaryChoice
          feature="overdue"
          value={sample.overdue}
          onChange={(value) => {
            setSample((current) => ({ ...current, overdue: value }))
            setDecision(null)
            setShowPath(false)
          }}
        />
      </div>

      <div className="case-action-bar teaching-control">
        <div>
          <strong>当前映射案例</strong>
          <span>
            {sample.age} · {sample.income} · {sample.stability} ·
            逾期史{sample.overdue} · DTI
            {dtiValue === null ? '未计算' : `${dtiValue}%（${dtiCategory}）`}
          </span>
        </div>
        <div>
          <Button onClick={() => evaluate(false)}>
            <Calculator size={18} /> 计算审批结果
          </Button>
          <Button variant="secondary" onClick={() => evaluate(true)}>
            <PlayCircle size={18} /> 开始分步演练
          </Button>
        </div>
      </div>

      {decision && (
        <div
          className={`decision-card ${decision.label === '通过' ? 'approved' : 'rejected'}`}
        >
          <div className="decision-icon">
            {decision.label === '通过' ? (
              <CheckCircle2 size={38} />
            ) : (
              <ShieldAlert size={38} />
            )}
          </div>
          <div>
            <span>最终审批结论</span>
            <h3>审批{decision.label}</h3>
            <p>模型已依据当前案例完成决策树分类匹配。</p>
          </div>
          <strong>{decision.risk}风险</strong>
        </div>
      )}

      {showPath && decision && decisionTree && (
        <>
          <div className="path-card">
            <div>
              <Route size={18} />
              <span>实际决策路径</span>
            </div>
            <div className="path-flow">
              {decision.path.map((node, index) => (
                <span key={node.id}>
                  {node.feature
                    ? `${FEATURE_META[node.feature].name} = ${decision.branches[index]}`
                    : `审批${node.label ?? node.majority}`}
                </span>
              ))}
            </div>
          </div>

          <div className="case-tree-heading">
            <GitBranch size={21} />
            <div>
              <strong>信贷 ID3 决策树可视化画布</strong>
              <span>黄色节点和连线表示当前案例经过的实际决策路径</span>
            </div>
          </div>
          <TreeCanvas
            tree={decisionTree}
            title="案例决策路径演练"
            highlightedNodeIds={decision.path.map((node) => node.id)}
            onNotice={(message) => onNotice(message)}
          />
        </>
      )}

      {!tree && (
        <EmptyState
          icon={<GitBranch size={32} />}
          title="等待训练模型"
          text="模型训练完成后，即可计算案例结论并开始决策路径演练。"
        />
      )}

      <Modal
        open={showStabilityCalculator}
        title="工作稳定度计算"
        onClose={() => setShowStabilityCalculator(false)}
      >
        <div className="stability-calculator">
          <p className="stability-calculator-intro">
            请在每类指标中选择一项。确认后系统将自动计算总分并填入工作稳定度输入框。
          </p>
          <div className="stability-score-groups">
            {STABILITY_SCORE_GROUPS.map((group) => (
              <fieldset className="stability-score-group" key={group.key}>
                <legend>{group.title}</legend>
                <div>
                  {group.options.map((option) => {
                    const selected =
                      stabilitySelections[group.key] === option.score
                    return (
                      <button
                        type="button"
                        className={`stability-score-option ${selected ? 'selected' : ''}`}
                        aria-pressed={selected}
                        key={option.label}
                        onClick={() =>
                          setStabilitySelections((current) => ({
                            ...current,
                            [group.key]: option.score,
                          }))
                        }
                      >
                        <span>{option.label}</span>
                        <span
                          className="stability-selection-box"
                          aria-hidden="true"
                        >
                          {selected && <Check size={13} strokeWidth={3} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="stability-calculator-actions">
            <span>已选择 {selectedStabilityFactorCount} / 5 项</span>
            <Button
              type="button"
              disabled={selectedStabilityFactorCount < 5}
              onClick={applyStabilityScore}
            >
              确定并填入
            </Button>
          </div>
        </div>
      </Modal>
    </Section>
  )
}
