import {
  Calculator,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  GitBranch,
  Route,
  ShieldAlert,
} from 'lucide-react'
import { FEATURE_META, FEATURE_ORDER } from '../data'
import {
  gainForFeature,
  predict,
} from '../lib/id3'
import type {
  CalculationRecord,
  CalculationStep,
  CategorizedLoanRow,
  LoanSample,
  TreeNode,
} from '../types'
import { TreeCanvas } from './TreeCanvas'
import { Button, EmptyState, Section } from './ui'

function number(value: number) {
  return value.toFixed(4)
}

function entropyTerm(count: number, total: number) {
  if (!count || !total) return '0.0000'
  const probability = count / total
  return `-(${count}/${total})×log₂(${count}/${total}) = ${number(-probability * Math.log2(probability))}`
}

function stepTitle(index: number, step: CalculationStep) {
  const titles = [
    '计算根节点“信用卡逾期史”的信息增益',
    '匹配逾期史分支，计算次级候选特征“DTI”',
    '匹配 DTI 分支，计算后续候选特征“收入”',
    '继续匹配候选特征并完成最终判定',
  ]
  return titles[index] ?? `计算${FEATURE_META[step.feature].name}信息增益`
}

function buildTranscript(
  sample: LoanSample,
  steps: CalculationStep[],
  label: '通过' | '拒绝',
  risk: '低' | '中' | '高',
) {
  const lines = [
    'ID3 借贷审批决策树分步演算底稿',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `待测样本：年龄=${sample.age}，收入=${sample.income}，工作稳定度=${sample.stability}，信用卡逾期史=${sample.overdue}，DTI=${sample.dti}`,
    '',
  ]

  steps.forEach((step, index) => {
    const { pass, reject } = step.detail.partitions.reduce(
      (counts, partition) => ({
        pass: counts.pass + partition.pass,
        reject: counts.reject + partition.reject,
      }),
      { pass: 0, reject: 0 },
    )
    lines.push(`步骤 ${index + 1}：${stepTitle(index, step)}`)
    lines.push(
      `当前子集 D：${step.subsetSize} 条，通过 ${pass} 条，拒绝 ${reject} 条`,
    )
    lines.push(
      `p(通过)=${pass}/${step.subsetSize}，p(拒绝)=${reject}/${step.subsetSize}`,
    )
    lines.push(
      `H(D) = ${entropyTerm(pass, step.subsetSize)} + ${entropyTerm(reject, step.subsetSize)} = ${number(step.detail.baseEntropy)}`,
    )
    step.detail.partitions.forEach((partition) => {
      lines.push(
        `  ${FEATURE_META[step.feature].name}=${partition.value}：${partition.count} 条（通过 ${partition.pass} / 拒绝 ${partition.reject}），H(Dᵥ)=${number(partition.entropy)}，加权项=${partition.count}/${step.subsetSize}×${number(partition.entropy)}=${number(partition.weight * partition.entropy)}`,
      )
    })
    lines.push(
      `H(D|${FEATURE_META[step.feature].name}) = ${step.detail.partitions
        .map(
          (partition) =>
            `${partition.count}/${step.subsetSize}×${number(partition.entropy)}`,
        )
        .join(' + ')} = ${number(step.detail.conditionalEntropy)}`,
    )
    lines.push(
      `Gain(D,${FEATURE_META[step.feature].name}) = ${number(step.detail.baseEntropy)} - ${number(step.detail.conditionalEntropy)} = ${number(step.detail.gain)}`,
    )
    lines.push(
      `待测样本匹配：${FEATURE_META[step.feature].name} = ${step.matchedValue}`,
      '',
    )
  })
  lines.push(`最终判定：审批${label}；风险等级：${risk}风险`)
  return lines.join('\n')
}

function riskLevel(label: '通过' | '拒绝', sample: LoanSample) {
  const highDti = sample.dti === '紧' || sample.dti === '重'
  if (label === '通过') {
    return sample.overdue === '有' || highDti ? '中' : '低'
  }
  return sample.overdue === '有' || sample.dti === '重' ? '高' : '中'
}

function entropyRows(step: CalculationStep) {
  return step.detail.partitions.reduce(
    (counts, partition) => ({
      pass: counts.pass + partition.pass,
      reject: counts.reject + partition.reject,
    }),
    { pass: 0, reject: 0 },
  )
}

export function ResultsPanel({
  tree,
  rows,
  sample,
  record,
  onRecord,
  onNotice,
}: {
  tree: TreeNode | null
  rows: CategorizedLoanRow[]
  sample: LoanSample
  record: CalculationRecord | null
  onRecord: (record: CalculationRecord) => void
  onNotice: (message: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const calculate = () => {
    if (!tree || !rows.length) {
      onNotice('请先完成模型训练，再开始审批演算', 'error')
      document.querySelector('#training')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    let subset = rows
    const steps: CalculationStep[] = []

    FEATURE_ORDER.forEach((feature) => {
      const detail = gainForFeature(subset, feature)
      const matchedValue = sample[feature]
      steps.push({
        feature,
        subsetSize: subset.length,
        matchedValue,
        detail,
      })
      const next = subset.filter((row) => row[feature] === matchedValue)
      if (next.length) subset = next
    })

    const label = predict(tree, sample).label
    const risk = riskLevel(label, sample)
    const transcript = buildTranscript(sample, steps, label, risk)
    const nextRecord: CalculationRecord = {
      id: `R${Date.now()}`,
      createdAt: new Date().toISOString(),
      sample: { ...sample },
      label,
      risk,
      steps,
      transcript,
    }
    onRecord(nextRecord)
    onNotice(`演算完成：审批${label}，${risk}风险`)
  }

  const copyTranscript = async () => {
    if (!record) return
    try {
      await navigator.clipboard.writeText(record.transcript)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = record.transcript
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    onNotice('完整演算底稿已复制')
  }

  const exportTxt = () => {
    if (!record) return
    const blob = new Blob([record.transcript], {
      type: 'text/plain;charset=utf-8',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ID3-借贷审批演算-${record.id}.txt`
    link.click()
    URL.revokeObjectURL(link.href)
    onNotice('TXT 作业文档已导出')
  }

  const path = tree && record ? predict(tree, record.sample) : null

  return (
    <Section
      id="results"
      icon={<Calculator size={25} />}
      eyebrow="MODULE 06 · 审批演算"
      title="计算结果分步演算与决策树画布"
      description="沿决策树逐层匹配待测样本，保留可复核、可导出的完整计算底稿。"
      className="results-panel"
    >
      <div className="calculate-banner teaching-control">
        <div>
          <span>READY TO CALCULATE</span>
          <strong>使用当前待测样本执行 ID3 分层匹配</strong>
          <p>
            {sample.age} · {sample.income} · {sample.stability} ·
            逾期史{sample.overdue}
          </p>
        </div>
        <Button onClick={calculate}>
          <Calculator size={19} /> 开始计算
        </Button>
      </div>

      {!record ? (
        <EmptyState
          icon={<FileText size={34} />}
          title="等待审批演算"
          text="点击“开始计算”后，系统将在此生成四步标准化底稿和最终审批结论。"
        />
      ) : (
        <>
          <div
            className={`decision-card ${record.label === '通过' ? 'approved' : 'rejected'}`}
          >
            <div className="decision-icon">
              {record.label === '通过' ? (
                <CheckCircle2 size={38} />
              ) : (
                <ShieldAlert size={38} />
              )}
            </div>
            <div>
              <span>最终审批结论</span>
              <h3>审批{record.label}</h3>
              <p>
                ID3 决策树已完成全部特征路径匹配，建议进入
                {record.label === '通过' ? '后续授信复核' : '人工风险复审'}。
              </p>
            </div>
            <strong>{record.risk}风险</strong>
          </div>

          {path && (
            <div className="path-card">
              <div>
                <Route size={18} />
                <span>实际决策路径</span>
              </div>
              <div className="path-flow">
                {path.path.map((node, index) => (
                  <span key={node.id}>
                    {node.feature
                      ? `${FEATURE_META[node.feature].name} = ${path.branches[index]}`
                      : `审批${node.label ?? node.majority}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="transcript-toolbar teaching-control">
            <div>
              <FileText size={19} />
              <span>
                <strong>标准化演算底稿</strong>
                全部数值保留 4 位小数
              </span>
            </div>
            <Button variant="secondary" onClick={copyTranscript}>
              <Clipboard size={16} /> 一键复制
            </Button>
            <Button variant="secondary" onClick={exportTxt}>
              <Download size={16} /> 导出 TXT
            </Button>
          </div>

          <div className="calculation-steps">
            {record.steps.map((step, index) => {
              const counts = entropyRows(step)
              return (
                <article className="calculation-step" key={step.feature}>
                  <div className="step-rail">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <i />
                  </div>
                  <div className="step-content">
                    <div className="step-heading">
                      <div>
                        <small>STEP {index + 1}</small>
                        <h3>{stepTitle(index, step)}</h3>
                      </div>
                      <em>Gain = {number(step.detail.gain)}</em>
                    </div>

                    <div className="math-block">
                      <h4>1. 样本占比与单条熵项</h4>
                      <p>
                        当前子集 |D| = {step.subsetSize}，通过 {counts.pass}{' '}
                        条，拒绝 {counts.reject} 条
                      </p>
                      <code>
                        p(通过) = {counts.pass}/{step.subsetSize} ={' '}
                        {number(counts.pass / step.subsetSize)}；p(拒绝) ={' '}
                        {counts.reject}/{step.subsetSize} ={' '}
                        {number(counts.reject / step.subsetSize)}
                      </code>
                      <code>
                        H(D) = {entropyTerm(counts.pass, step.subsetSize)} +{' '}
                        {entropyTerm(counts.reject, step.subsetSize)} ={' '}
                        <b>{number(step.detail.baseEntropy)}</b>
                      </code>
                    </div>

                    <div className="partition-grid">
                      {step.detail.partitions.map((partition) => (
                        <div key={partition.value}>
                          <strong>
                            {FEATURE_META[step.feature].name} = {partition.value}
                          </strong>
                          <span>
                            {partition.count} 条 · 通过 {partition.pass} / 拒绝{' '}
                            {partition.reject}
                          </span>
                          <code>H(Dᵥ) = {number(partition.entropy)}</code>
                          <small>
                            加权项：{partition.count}/{step.subsetSize} ×{' '}
                            {number(partition.entropy)} ={' '}
                            {number(partition.weight * partition.entropy)}
                          </small>
                        </div>
                      ))}
                    </div>

                    <div className="math-conclusion">
                      <span>条件熵加权</span>
                      <code>
                        H(D|{FEATURE_META[step.feature].name}) ={' '}
                        {step.detail.partitions
                          .map(
                            (partition) =>
                              `${partition.count}/${step.subsetSize}×${number(partition.entropy)}`,
                          )
                          .join(' + ')}{' '}
                        = <b>{number(step.detail.conditionalEntropy)}</b>
                      </code>
                      <span>信息增益差值</span>
                      <code>
                        Gain(D,{FEATURE_META[step.feature].name}) ={' '}
                        {number(step.detail.baseEntropy)} -{' '}
                        {number(step.detail.conditionalEntropy)} ={' '}
                        <b>{number(step.detail.gain)}</b>
                      </code>
                      <p>
                        当前样本匹配分支：
                        <strong>
                          {FEATURE_META[step.feature].name} = {step.matchedValue}
                        </strong>
                        {index === 3 &&
                          `；综合全部层级增益，输出审批${record.label}。`}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}

      <div className="tree-result-heading">
        <div>
          <GitBranch size={22} />
          <span>
            <strong>信贷 ID3 决策树可视化画布</strong>
            支持拖拽、滚轮缩放、节点详情、布局切换与 PNG 导出
          </span>
        </div>
      </div>
      {tree ? (
        <TreeCanvas
          tree={tree}
          title="完整信贷审批决策树"
          onNotice={(message) => onNotice(message)}
        />
      ) : (
        <EmptyState
          icon={<GitBranch size={34} />}
          title="决策树尚未生成"
          text="训练完成后，完整信贷决策树会自动渲染到此画布。"
        />
      )}
    </Section>
  )
}
