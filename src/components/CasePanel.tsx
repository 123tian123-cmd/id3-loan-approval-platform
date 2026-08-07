import {
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  GitBranch,
  PlayCircle,
  Route,
  ShieldAlert,
} from 'lucide-react'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
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
import { Button, EmptyState, Section, TeachingTip } from './ui'

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
      eyebrow="MODULE 05 · 案例评估"
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
                <TeachingTip title={`${FEATURE_META[feature].name}数字录入`}>
                  输入原始数字后自动映射为“{FEATURE_META[feature].values.join(
                    ' / ',
                  )}”。
                </TeachingTip>
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
    </Section>
  )
}
