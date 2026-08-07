import type {
  FeatureKey,
  LoanRow,
  MappingConfig,
  NumericFeatureKey,
  TreeConstraints,
} from './types'

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

export const DEFAULT_TRAINING_DATA: LoanRow[] = [
  { id: 'T01', age: 28, income: 4200, stability: 62, overdue: '无', dti: 12, label: '通过' },
  { id: 'T02', age: 33, income: 6800, stability: 75, overdue: '无', dti: 18, label: '通过' },
  { id: 'T03', age: 41, income: 9200, stability: 81, overdue: '无', dti: 15, label: '通过' },
  { id: 'T04', age: 52, income: 12500, stability: 88, overdue: '无', dti: 8, label: '通过' },
  { id: 'T05', age: 58, income: 7200, stability: 73, overdue: '无', dti: 19, label: '通过' },
  { id: 'T06', age: 63, income: 11800, stability: 85, overdue: '无', dti: 10, label: '通过' },
  { id: 'T07', age: 25, income: 3600, stability: 35, overdue: '有', dti: 14, label: '拒绝' },
  { id: 'T08', age: 31, income: 5600, stability: 68, overdue: '有', dti: 17, label: '通过' },
  { id: 'T09', age: 44, income: 7800, stability: 76, overdue: '有', dti: 11, label: '通过' },
  { id: 'T10', age: 49, income: 4800, stability: 42, overdue: '有', dti: 20, label: '拒绝' },
  { id: 'T11', age: 57, income: 9800, stability: 65, overdue: '有', dti: 16, label: '拒绝' },
  { id: 'T12', age: 65, income: 13200, stability: 90, overdue: '有', dti: 9, label: '通过' },
  { id: 'T13', age: 23, income: 3800, stability: 48, overdue: '无', dti: 24, label: '通过' },
  { id: 'T14', age: 29, income: 6200, stability: 71, overdue: '无', dti: 28, label: '通过' },
  { id: 'T15', age: 37, income: 8500, stability: 67, overdue: '无', dti: 33, label: '通过' },
  { id: 'T16', age: 46, income: 11500, stability: 83, overdue: '无', dti: 22, label: '通过' },
  { id: 'T17', age: 54, income: 5200, stability: 58, overdue: '无', dti: 31, label: '通过' },
  { id: 'T18', age: 61, income: 10800, stability: 79, overdue: '无', dti: 26, label: '通过' },
  { id: 'T19', age: 27, income: 4100, stability: 32, overdue: '有', dti: 34, label: '拒绝' },
  { id: 'T20', age: 34, income: 7400, stability: 64, overdue: '有', dti: 23, label: '通过' },
  { id: 'T21', age: 39, income: 9600, stability: 72, overdue: '有', dti: 29, label: '拒绝' },
  { id: 'T22', age: 48, income: 13000, stability: 86, overdue: '有', dti: 25, label: '通过' },
  { id: 'T23', age: 56, income: 5800, stability: 45, overdue: '有', dti: 35, label: '拒绝' },
  { id: 'T24', age: 64, income: 8800, stability: 61, overdue: '有', dti: 30, label: '拒绝' },
  { id: 'T25', age: 24, income: 3500, stability: 44, overdue: '无', dti: 38, label: '拒绝' },
  { id: 'T26', age: 30, income: 6500, stability: 73, overdue: '无', dti: 42, label: '通过' },
  { id: 'T27', age: 36, income: 8200, stability: 55, overdue: '无', dti: 47, label: '拒绝' },
  { id: 'T28', age: 43, income: 12200, stability: 84, overdue: '无', dti: 36, label: '通过' },
  { id: 'T29', age: 51, income: 5400, stability: 62, overdue: '无', dti: 45, label: '拒绝' },
  { id: 'T30', age: 59, income: 10400, stability: 77, overdue: '无', dti: 40, label: '通过' },
  { id: 'T31', age: 26, income: 3900, stability: 28, overdue: '有', dti: 49, label: '拒绝' },
  { id: 'T32', age: 32, income: 7000, stability: 66, overdue: '有', dti: 37, label: '拒绝' },
  { id: 'T33', age: 40, income: 9400, stability: 74, overdue: '有', dti: 44, label: '拒绝' },
  { id: 'T34', age: 47, income: 12800, stability: 89, overdue: '有', dti: 39, label: '通过' },
  { id: 'T35', age: 55, income: 6100, stability: 51, overdue: '有', dti: 50, label: '拒绝' },
  { id: 'T36', age: 62, income: 9000, stability: 69, overdue: '有', dti: 46, label: '拒绝' },
  { id: 'T37', age: 22, income: 3200, stability: 30, overdue: '无', dti: 58, label: '拒绝' },
  { id: 'T38', age: 28, income: 5900, stability: 64, overdue: '无', dti: 52, label: '拒绝' },
  { id: 'T39', age: 35, income: 8300, stability: 78, overdue: '无', dti: 55, label: '通过' },
  { id: 'T40', age: 42, income: 11900, stability: 87, overdue: '无', dti: 63, label: '拒绝' },
  { id: 'T41', age: 50, income: 5000, stability: 46, overdue: '无', dti: 71, label: '拒绝' },
  { id: 'T42', age: 60, income: 10200, stability: 82, overdue: '无', dti: 54, label: '通过' },
  { id: 'T43', age: 24, income: 3700, stability: 25, overdue: '有', dti: 82, label: '拒绝' },
  { id: 'T44', age: 31, income: 6800, stability: 59, overdue: '有', dti: 57, label: '拒绝' },
  { id: 'T45', age: 38, income: 9100, stability: 70, overdue: '有', dti: 66, label: '拒绝' },
  { id: 'T46', age: 45, income: 12600, stability: 91, overdue: '有', dti: 53, label: '拒绝' },
  { id: 'T47', age: 53, income: 5600, stability: 40, overdue: '有', dti: 76, label: '拒绝' },
  { id: 'T48', age: 65, income: 8600, stability: 68, overdue: '有', dti: 61, label: '拒绝' },
]

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
