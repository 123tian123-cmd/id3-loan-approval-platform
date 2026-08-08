import { predict } from './id3'
import type {
  CategorizedLoanRow,
  FeatureKey,
  TreeNode,
} from '../types'

export interface ConfusionMatrix {
  tp: number
  fp: number
  tn: number
  fn: number
}

export interface ModelEvaluation extends ConfusionMatrix {
  total: number
  positive: number
  negative: number
  accuracy: number | null
  precision: number | null
  recall: number | null
  positiveShare: number
  negativeShare: number
  imbalanced: boolean
}

function safeDivide(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

export function metricsFromConfusionMatrix(
  matrix: ConfusionMatrix,
): ModelEvaluation {
  const { tp, fp, tn, fn } = matrix
  const total = tp + fp + tn + fn
  const positive = tp + fn
  const negative = tn + fp
  const positiveShare = total ? positive / total : 0
  const negativeShare = total ? negative / total : 0

  return {
    ...matrix,
    total,
    positive,
    negative,
    accuracy: safeDivide(tp + tn, total),
    precision: safeDivide(tp, tp + fp),
    recall: safeDivide(tp, tp + fn),
    positiveShare,
    negativeShare,
    imbalanced:
      total > 0 && Math.max(positiveShare, negativeShare) > 0.7,
  }
}

export function evaluateModel(
  tree: TreeNode,
  rows: CategorizedLoanRow[],
): ModelEvaluation {
  const matrix: ConfusionMatrix = { tp: 0, fp: 0, tn: 0, fn: 0 }

  rows.forEach((row) => {
    const sample: Record<FeatureKey, string> = {
      age: row.age,
      income: row.income,
      stability: row.stability,
      overdue: row.overdue,
      dti: row.dti,
    }
    const predicted = predict(tree, sample).label

    if (row.label === '通过' && predicted === '通过') matrix.tp += 1
    else if (row.label === '拒绝' && predicted === '通过') matrix.fp += 1
    else if (row.label === '拒绝' && predicted === '拒绝') matrix.tn += 1
    else matrix.fn += 1
  })

  return metricsFromConfusionMatrix(matrix)
}
