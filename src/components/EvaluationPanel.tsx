import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Target,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  evaluateModel,
  type ModelEvaluation,
} from '../lib/evaluation'
import type { CategorizedLoanRow, TreeNode } from '../types'
import { Button, EmptyState, Modal, Section, TeachingTip } from './ui'

function metricValue(value: number | null): string {
  return value === null ? '无法计算' : value.toFixed(4)
}

function percentage(count: number, total: number): string {
  return total ? `${((count / total) * 100).toFixed(2)}%` : '0.00%'
}

export function EvaluationPanel({
  tree,
  rows,
  sourceRowCount,
  stale,
  training,
  onRefresh,
}: {
  tree: TreeNode | null
  rows: CategorizedLoanRow[]
  sourceRowCount: number
  stale: boolean
  training: boolean
  onRefresh: () => void
}) {
  const evaluation = useMemo(
    () => (tree && rows.length ? evaluateModel(tree, rows) : null),
    [tree, rows],
  )
  const [showImbalanceWarning, setShowImbalanceWarning] = useState(false)
  const warnedSignature = useRef('')

  useEffect(() => {
    if (!evaluation?.imbalanced) return
    const signature = [
      evaluation.total,
      evaluation.positive,
      evaluation.negative,
    ].join('-')
    if (warnedSignature.current === signature) return
    warnedSignature.current = signature
    setShowImbalanceWarning(true)
  }, [evaluation])

  const metricCards: Array<{
    key: string
    name: string
    value: number | null
    formula: string
    description: string
    tone: string
  }> = evaluation
    ? [
        {
          key: 'accuracy',
          name: '准确率 Accuracy',
          value: evaluation.accuracy,
          formula: '(TP + TN) / 全部样本',
          description: '整体审批判断正确的比例，用于观察模型总体分类表现。',
          tone: 'cyan',
        },
        {
          key: 'precision',
          name: '精确率 Precision',
          value: evaluation.precision,
          formula: 'TP / (TP + FP)',
          description: '模型批准的客户中真实应批准的比例，越高代表误放风险越低。',
          tone: 'green',
        },
        {
          key: 'recall',
          name: '召回率 Recall',
          value: evaluation.recall,
          formula: 'TP / (TP + FN)',
          description: '真实优质客户被模型成功批准的比例，越高代表误拒流失越少。',
          tone: 'yellow',
        },
      ]
    : []

  return (
    <Section
      id="evaluation"
      icon={<Activity size={25} />}
      eyebrow="MODULE 05 · 量化验证"
      title="模型量化评估"
      description="基于当前数据集逐条执行 ID3 推理，使用混淆矩阵、准确率、精确率与召回率衡量模型表现。"
    >
      <div className="evaluation-toolbar teaching-control">
        <div>
          <strong>训练集推理评估</strong>
          <span>
            训练完成后自动加载；数据或映射发生变化时，点击刷新按当前配置重新建树并评估。
          </span>
        </div>
        <div>
          <Button onClick={onRefresh} disabled={training}>
            <RefreshCw size={17} className={training ? 'spin-icon' : ''} />
            {training ? '训练进行中' : '手动刷新评估'}
          </Button>
        </div>
      </div>

      {stale && tree && (
        <div className="evaluation-stale" role="status">
          <AlertTriangle size={18} />
          <span>
            当前数据或映射已发生变化，以下结果仍对应上一次训练。请点击“手动刷新评估”同步模型与指标。
          </span>
        </div>
      )}

      {sourceRowCount === 0 ? (
        <EmptyState
          icon={<Activity size={34} />}
          title="没有可评估的数据集"
          text="请先新增或导入训练数据，完成字段校验后再训练模型。"
        />
      ) : !tree ? (
        <EmptyState
          icon={<Target size={34} />}
          title="尚无可评估的训练模型"
          text="请先在模型训练面板点击“开始训练模型”，训练结束后评估数据会自动加载。"
        />
      ) : !evaluation ? (
        <EmptyState
          icon={<Activity size={34} />}
          title="评估数据尚未生成"
          text="当前模型没有关联的转换样本，请重新训练或手动刷新评估。"
        />
      ) : (
        <div className="evaluation-content" aria-live="polite">
          {evaluation.imbalanced && (
            <div className="imbalance-banner" role="alert">
              <AlertTriangle size={18} />
              <span>
                样本类别比例超过 7:3，准确率可能掩盖少数类别误判，请结合精确率、召回率共同判断。
              </span>
            </div>
          )}

          <div className="evaluation-main-grid">
            <article className="confusion-card">
              <div className="subheading">
                <span>混淆矩阵</span>
                <em>{evaluation.total} 条推理样本</em>
              </div>
              <div className="confusion-table-wrap">
                <table className="confusion-table">
                  <thead>
                    <tr>
                      <th>真实标签＼预测标签</th>
                      <th className="pass-heading">预测批准</th>
                      <th className="reject-heading">预测不批准</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th className="pass-heading">真实批准</th>
                      <td className="matrix-cell matrix-tp">
                        <div>
                          <strong>TP</strong>
                          <TeachingTip title="TP 真正例">
                            真实应审批批准，模型也预测批准，属于正确识别的优质客户。
                          </TeachingTip>
                        </div>
                        <b>{evaluation.tp}</b>
                        <span>
                          占全部样本 {percentage(evaluation.tp, evaluation.total)}
                        </span>
                      </td>
                      <td className="matrix-cell matrix-fn">
                        <div>
                          <strong>FN</strong>
                          <TeachingTip title="FN 假负例">
                            真实应审批批准，但模型预测不批准，可能造成优质客户流失。
                          </TeachingTip>
                        </div>
                        <b>{evaluation.fn}</b>
                        <span>
                          占全部样本 {percentage(evaluation.fn, evaluation.total)}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <th className="reject-heading">真实不批准</th>
                      <td className="matrix-cell matrix-fp">
                        <div>
                          <strong>FP</strong>
                          <TeachingTip title="FP 假正例">
                            真实应审批不批准，但模型预测批准，可能形成误放和坏账风险。
                          </TeachingTip>
                        </div>
                        <b>{evaluation.fp}</b>
                        <span>
                          占全部样本 {percentage(evaluation.fp, evaluation.total)}
                        </span>
                      </td>
                      <td className="matrix-cell matrix-tn">
                        <div>
                          <strong>TN</strong>
                          <TeachingTip title="TN 真负例">
                            真实应审批不批准，模型也预测不批准，属于正确拦截的风险客户。
                          </TeachingTip>
                        </div>
                        <b>{evaluation.tn}</b>
                        <span>
                          占全部样本 {percentage(evaluation.tn, evaluation.total)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="class-balance">
                <span>
                  真实批准 {evaluation.positive} 条 ·{' '}
                  {(evaluation.positiveShare * 100).toFixed(2)}%
                </span>
                <span>
                  真实不批准 {evaluation.negative} 条 ·{' '}
                  {(evaluation.negativeShare * 100).toFixed(2)}%
                </span>
              </div>
            </article>

            <div className="evaluation-metric-grid">
              {metricCards.map((card) => (
                <article
                  className={`evaluation-metric-card metric-tone-${card.tone}`}
                  key={card.key}
                >
                  <div>
                    <span>{card.name}</span>
                    <TeachingTip title={card.name}>
                      {card.description}
                    </TeachingTip>
                  </div>
                  <strong>{metricValue(card.value)}</strong>
                  <code>{card.formula}</code>
                  <p>
                    {card.value === null
                      ? '当前指标计算分母为 0，暂时无法给出有效数值。'
                      : card.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

        </div>
      )}

      <Modal
        open={showImbalanceWarning}
        title="样本类别分布不均衡"
        onClose={() => setShowImbalanceWarning(false)}
      >
        {evaluation && (
          <div className="imbalance-modal">
            <AlertTriangle size={28} />
            <p>
              当前真实批准样本占{' '}
              <strong>{(evaluation.positiveShare * 100).toFixed(2)}%</strong>
              ，真实不批准样本占{' '}
              <strong>{(evaluation.negativeShare * 100).toFixed(2)}%</strong>。
            </p>
            <p>
              类别比例已超过 7:3，单独使用准确率可能产生误导，请重点结合精确率、召回率和混淆矩阵判断模型质量。
            </p>
            <Button onClick={() => setShowImbalanceWarning(false)}>
              我已了解
            </Button>
          </div>
        )}
      </Modal>
    </Section>
  )
}
