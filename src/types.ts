export type ApprovalLabel = '通过' | '拒绝'
export type FeatureKey =
  | 'age'
  | 'income'
  | 'stability'
  | 'overdue'
  | 'dti'
export type NumericFeatureKey = Exclude<FeatureKey, 'overdue'>
export type LayoutDirection = 'vertical' | 'horizontal'

export interface LoanRow {
  id: string
  age: string | number
  income: string | number
  stability: string | number
  overdue: '有' | '无' | string
  dti: string | number
  label: ApprovalLabel | string
}

export interface CategorizedLoanRow {
  id: string
  age: string
  income: string
  stability: string
  overdue: string
  dti: string
  label: ApprovalLabel
  raw: LoanRow
}

export interface RangeRule {
  label: string
  min: number
  max: number | null
}

export type MappingConfig = Record<NumericFeatureKey, RangeRule[]>

export interface TreeConstraints {
  maxDepth: number
  minLeafSamples: number
  minSplitSamples: number
  minGain: number
}

export interface TreeNode {
  id: string
  depth: number
  samples: CategorizedLoanRow[]
  entropy: number
  gain: number
  feature?: FeatureKey
  label?: ApprovalLabel
  majority: ApprovalLabel
  reason?: string
  branches: Record<string, TreeNode>
}

export interface GainDetail {
  feature: FeatureKey
  baseEntropy: number
  conditionalEntropy: number
  gain: number
  partitions: Array<{
    value: string
    count: number
    pass: number
    reject: number
    entropy: number
    weight: number
  }>
}

export interface TrainingMetrics {
  entropy: number
  gains: GainDetail[]
  depth: number
  leaves: number
  purity: number
  accuracy: number
}

export interface SavedSample {
  id: string
  name: string
  age: string
  income: string
  stability: string
  overdue: '有' | '无'
  dti: string
}

export type LoanSample = Omit<SavedSample, 'id' | 'name'>

export interface TrainingSnapshot {
  depth: number
  nodes: TreeNode[]
  averageEntropy: number
  remainingSplittable: number
  bestGain: number
  featureGains: GainDetail[]
}

export interface CalculationStep {
  feature: FeatureKey
  subsetSize: number
  matchedValue: string
  detail: GainDetail
}

export interface CalculationRecord {
  id: string
  createdAt: string
  sample: LoanSample
  label: ApprovalLabel
  risk: '低' | '中' | '高'
  steps: CalculationStep[]
  transcript: string
}
