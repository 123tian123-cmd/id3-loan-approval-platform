import type {
  FeatureKey,
  LoanRow,
  MappingConfig,
  NumericFeatureKey,
  TreeConstraints,
} from './types'
import defaultTrainingData from './default-training-data.json'

export const FEATURE_META: Record<
  FeatureKey,
  { name: string; shortName: string; values: string[] }
> = {
  age: {
    name: '年龄',
    shortName: '年龄',
    values: ['青年', '壮年', '中年', '老年'],
  },
  income: {
    name: '收入',
    shortName: '收入',
    values: ['高', '中等', '低'],
  },
  stability: {
    name: '工作稳定度',
    shortName: '稳定度',
    values: ['稳定', '比较稳定', '不稳定'],
  },
  overdue: {
    name: '信用卡逾期史',
    shortName: '逾期史',
    values: ['有', '无'],
  },
  dti: {
    name: 'DTI',
    shortName: 'DTI',
    values: ['优', '良', '紧', '重'],
  },
}

export const FEATURE_ORDER: FeatureKey[] = [
  'overdue',
  'dti',
  'income',
  'stability',
  'age',
]

export const NUMERIC_FEATURES: NumericFeatureKey[] = [
  'age',
  'income',
  'stability',
  'dti',
]

export const DEFAULT_MAPPINGS: MappingConfig = {
  age: [
    { label: '青年', min: 18, max: 30 },
    { label: '壮年', min: 31, max: 40 },
    { label: '中年', min: 41, max: 50 },
    { label: '老年', min: 51, max: 65 },
  ],
  income: [
    { label: '低', min: 0, max: 4999 },
    { label: '中等', min: 5000, max: 9999 },
    { label: '高', min: 10000, max: null },
  ],
  stability: [
    { label: '不稳定', min: 0, max: 39 },
    { label: '比较稳定', min: 40, max: 69 },
    { label: '稳定', min: 70, max: 100 },
  ],
  dti: [
    { label: '优', min: 0, max: 20 },
    { label: '良', min: 20.01, max: 35 },
    { label: '紧', min: 35.01, max: 50 },
    { label: '重', min: 50.01, max: null },
  ],
}

export const DEFAULT_TRAINING_DATA: LoanRow[] = defaultTrainingData

export const DEFAULT_CONSTRAINTS: TreeConstraints = {
  maxDepth: 5,
  minLeafSamples: 30,
  minSplitSamples: 75,
  minGain: 0.01,
}

export const CONSTRAINT_PRESETS: Record<
  string,
  { description: string; values: TreeConstraints }
> = {
  保守风控模型: {
    description: '强约束配置，优先保证规则稳定和模型泛化',
    values: {
      maxDepth: 3,
      minLeafSamples: 75,
      minSplitSamples: 180,
      minGain: 0.05,
    },
  },
  标准教学模型: {
    description: '兼顾分类能力、规则稳定性与可解释性',
    values: DEFAULT_CONSTRAINTS,
  },
  宽松风控模型: {
    description: '弱约束配置，保留更多细分规则与少数模式',
    values: {
      maxDepth: 5,
      minLeafSamples: 10,
      minSplitSamples: 30,
      minGain: 0.002,
    },
  },
}

export const SAMPLE_TEMPLATES = {
  低风险样本: {
    age: '壮年',
    income: '高',
    stability: '稳定',
    overdue: '无' as const,
    dti: '优',
  },
  中等风险样本: {
    age: '青年',
    income: '中等',
    stability: '比较稳定',
    overdue: '无' as const,
    dti: '紧',
  },
  高风险样本: {
    age: '老年',
    income: '低',
    stability: '不稳定',
    overdue: '有' as const,
    dti: '重',
  },
}

export const MAPPING_DOMAINS: Record<
  NumericFeatureKey,
  {
    unit: string
    min: number
    max?: number
    sliderMax: number
    example: number
    step?: number
  }
> = {
  age: { unit: '岁', min: 18, max: 65, sliderMax: 65, example: 32 },
  income: { unit: '元/月', min: 0, sliderMax: 20000, example: 8000 },
  stability: {
    unit: '分',
    min: 0,
    max: 100,
    sliderMax: 100,
    example: 75,
  },
  dti: {
    unit: '%',
    min: 0,
    sliderMax: 100,
    example: 32.5,
    step: 0.01,
  },
}
