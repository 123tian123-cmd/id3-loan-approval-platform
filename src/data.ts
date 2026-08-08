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
    values: ['高收入', '中等收入', '低收入'],
  },
  stability: {
    name: '工作稳定度',
    shortName: '稳定度',
    values: ['稳定', '一般', '不稳定'],
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
    { label: '青年', min: 18, max: 25 },
    { label: '壮年', min: 26, max: 40 },
    { label: '中年', min: 41, max: 55 },
    { label: '老年', min: 56, max: 65 },
  ],
  income: [
    { label: '低收入', min: 0, max: 4999 },
    { label: '中等收入', min: 5000, max: 15000 },
    { label: '高收入', min: 15001, max: null },
  ],
  stability: [
    { label: '不稳定', min: 0, max: 39 },
    { label: '一般', min: 40, max: 69 },
    { label: '稳定', min: 70, max: 100 },
  ],
  dti: [
    { label: '优', min: 0, max: 19.99 },
    { label: '良', min: 20, max: 34.99 },
    { label: '紧', min: 35, max: 49.99 },
    { label: '重', min: 50, max: 100 },
  ],
}

export const QUICK_MAPPING_PRESET: MappingConfig = DEFAULT_MAPPINGS

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
  保守风控: {
    description: '强约束配置，优先保证规则稳定和模型泛化',
    values: {
      maxDepth: 3,
      minLeafSamples: 20,
      minSplitSamples: 42,
      minGain: 0.075,
    },
  },
  均衡模型: {
    description: '兼顾分类能力、结构稳定性与可解释性',
    values: {
      maxDepth: 5,
      minLeafSamples: 15,
      minSplitSamples: 33,
      minGain: 0.045,
    },
  },
  宽松风控: {
    description: '弱约束配置，保留更多细分规则与少数模式',
    values: {
      maxDepth: 6,
      minLeafSamples: 10,
      minSplitSamples: 24,
      minGain: 0.015,
    },
  },
}

export const SAMPLE_TEMPLATES = {
  低风险样本: {
    age: '壮年',
    income: '高收入',
    stability: '稳定',
    overdue: '无' as const,
    dti: '优',
  },
  中等风险样本: {
    age: '青年',
    income: '中等收入',
    stability: '一般',
    overdue: '无' as const,
    dti: '紧',
  },
  高风险样本: {
    age: '老年',
    income: '低收入',
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
    max: 100,
    sliderMax: 100,
    example: 32.5,
    step: 0.01,
  },
}
