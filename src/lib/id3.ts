import { FEATURE_META, FEATURE_ORDER, NUMERIC_FEATURES } from '../data'
import type {
  ApprovalLabel,
  CategorizedLoanRow,
  FeatureKey,
  GainDetail,
  LoanRow,
  MappingConfig,
  NumericFeatureKey,
  TrainingMetrics,
  TrainingSnapshot,
  TreeConstraints,
  TreeNode,
} from '../types'

const EPSILON = 1e-10

export function cloneMappings(mappings: MappingConfig): MappingConfig {
  return Object.fromEntries(
    Object.entries(mappings).map(([key, rules]) => [
      key,
      rules.map((rule) => ({ ...rule })),
    ]),
  ) as MappingConfig
}

export function entropy(rows: Array<{ label: ApprovalLabel }>): number {
  if (!rows.length) return 0
  const pass = rows.filter((item) => item.label === '通过').length
  const probabilities = [pass / rows.length, (rows.length - pass) / rows.length]
  return -probabilities.reduce(
    (sum, probability) =>
      probability > 0 ? sum + probability * Math.log2(probability) : sum,
    0,
  )
}

export function majorityLabel(rows: CategorizedLoanRow[]): ApprovalLabel {
  const pass = rows.filter((item) => item.label === '通过').length
  return pass >= rows.length - pass ? '通过' : '拒绝'
}

export function mappingErrors(mappings: MappingConfig): string[] {
  const errors: string[] = []

  NUMERIC_FEATURES.forEach((feature) => {
    const rules = mappings[feature]
    const name = FEATURE_META[feature].name
    const step = feature === 'dti' ? 0.01 : 1
    if (!rules.length) {
      errors.push(`${name}至少需要一条映射规则`)
      return
    }

    const sorted = [...rules].sort((a, b) => a.min - b.min)
    sorted.forEach((rule, index) => {
      if (
        !Number.isFinite(rule.min) ||
        (rule.max !== null && !Number.isFinite(rule.max)) ||
        rule.label.trim() === ''
      ) {
        errors.push(`${name}存在空值，请补全区间和标签`)
      }
      if (rule.max === null && index !== sorted.length - 1) {
        errors.push(`${name}仅最后一个分类可以不设置上限`)
      }
      if (rule.max !== null && rule.min > rule.max) {
        errors.push(`${name}的“${rule.label}”下限不能大于上限`)
      }
      const previous = sorted[index - 1]
      if (
        previous &&
        (previous.max === null || rule.min <= previous.max)
      ) {
        errors.push(
          `${name}的“${previous.label}”与“${rule.label}”区间发生重叠`,
        )
      }
      if (
        previous &&
        previous.max !== null &&
        rule.min > previous.max + step + EPSILON
      ) {
        errors.push(
          `${name}的“${previous.label}”与“${rule.label}”之间存在未覆盖区间`,
        )
      }
    })
  })

  return [...new Set(errors)]
}

export function mapValue(
  value: string | number,
  feature: NumericFeatureKey,
  mappings: MappingConfig,
  nearest = false,
): { label: string; adjusted: boolean } | null {
  const categories = FEATURE_META[feature].values
  if (typeof value === 'string' && categories.includes(value.trim())) {
    return { label: value.trim(), adjusted: false }
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const matched = mappings[feature].find(
    (rule) =>
      numeric + EPSILON >= rule.min &&
      (rule.max === null || numeric <= rule.max + EPSILON),
  )
  if (matched) return { label: matched.label, adjusted: false }
  if (!nearest) return null

  const closest = mappings[feature].reduce((best, rule) => {
    const distance =
      numeric < rule.min
        ? rule.min - numeric
        : rule.max !== null && numeric > rule.max
          ? numeric - rule.max
          : 0
    return distance < best.distance ? { rule, distance } : best
  }, { rule: mappings[feature][0], distance: Number.POSITIVE_INFINITY })

  return { label: closest.rule.label, adjusted: true }
}

export function validateRows(
  rows: LoanRow[],
  mappings: MappingConfig,
): string[] {
  if (!rows.length) return ['训练数据集不能为空']
  const errors: string[] = []

  rows.forEach((row, index) => {
    const position = `第 ${index + 1} 行`
    NUMERIC_FEATURES.forEach((feature) => {
      if (
        row[feature] === '' ||
        row[feature] === null ||
        row[feature] === undefined
      ) {
        errors.push(`${position}的${FEATURE_META[feature].name}不能为空`)
      } else if (!mapValue(row[feature], feature, mappings)) {
        errors.push(
          `${position}的${FEATURE_META[feature].name}取值“${row[feature]}”不在映射范围内`,
        )
      }
    })
    if (!FEATURE_META.overdue.values.includes(String(row.overdue).trim())) {
      errors.push(`${position}的信用卡逾期史只能填写“有”或“无”`)
    }
    if (!['通过', '拒绝'].includes(String(row.label).trim())) {
      errors.push(`${position}的审批结果只能填写“通过”或“拒绝”`)
    }
  })

  return errors
}

export function categorizeRows(
  rows: LoanRow[],
  mappings: MappingConfig,
): CategorizedLoanRow[] {
  return rows.map((row) => ({
    id: row.id,
    age: mapValue(row.age, 'age', mappings)?.label ?? String(row.age),
    income:
      mapValue(row.income, 'income', mappings)?.label ?? String(row.income),
    stability:
      mapValue(row.stability, 'stability', mappings)?.label ??
      String(row.stability),
    overdue: String(row.overdue).trim(),
    dti: mapValue(row.dti, 'dti', mappings)?.label ?? String(row.dti),
    label: String(row.label).trim() as ApprovalLabel,
    raw: row,
  }))
}

export function gainForFeature(
  rows: CategorizedLoanRow[],
  feature: FeatureKey,
): GainDetail {
  const baseEntropy = entropy(rows)
  const grouped = new Map<string, CategorizedLoanRow[]>()
  rows.forEach((row) => {
    const value = row[feature]
    grouped.set(value, [...(grouped.get(value) ?? []), row])
  })

  const partitions = [...grouped.entries()].map(([value, subset]) => {
    const pass = subset.filter((item) => item.label === '通过').length
    return {
      value,
      count: subset.length,
      pass,
      reject: subset.length - pass,
      entropy: entropy(subset),
      weight: subset.length / rows.length,
    }
  })
  const conditionalEntropy = partitions.reduce(
    (sum, partition) => sum + partition.weight * partition.entropy,
    0,
  )

  return {
    feature,
    baseEntropy,
    conditionalEntropy,
    gain: baseEntropy - conditionalEntropy,
    partitions,
  }
}

export function allGains(
  rows: CategorizedLoanRow[],
  features: FeatureKey[] = FEATURE_ORDER,
): GainDetail[] {
  return features
    .map((feature) => gainForFeature(rows, feature))
    .sort(
      (a, b) =>
        b.gain - a.gain ||
        FEATURE_ORDER.indexOf(a.feature) - FEATURE_ORDER.indexOf(b.feature),
    )
}

export function buildTree(
  rows: CategorizedLoanRow[],
  constraints: TreeConstraints,
  features: FeatureKey[] = FEATURE_ORDER,
): TreeNode {
  let sequence = 0

  const build = (
    subset: CategorizedLoanRow[],
    remaining: FeatureKey[],
    depth: number,
  ): TreeNode => {
    const nodeEntropy = entropy(subset)
    const majority = majorityLabel(subset)
    const base: TreeNode = {
      id: `node-${sequence++}`,
      depth,
      samples: subset,
      entropy: nodeEntropy,
      gain: 0,
      majority,
      branches: {},
    }

    if (nodeEntropy <= EPSILON) {
      return { ...base, label: subset[0]?.label ?? majority, reason: '样本纯净' }
    }
    if (depth >= constraints.maxDepth) {
      return { ...base, label: majority, reason: '达到最大深度' }
    }
    if (subset.length < constraints.minSplitSamples) {
      return { ...base, label: majority, reason: '样本数不足以继续分裂' }
    }
    if (!remaining.length) {
      return { ...base, label: majority, reason: '候选特征已用完' }
    }

    const gains = allGains(subset, remaining)
    const chosen = gains.find((detail) =>
      detail.partitions.every(
        (partition) => partition.count >= constraints.minLeafSamples,
      ),
    )

    if (!chosen || chosen.gain + EPSILON < constraints.minGain) {
      return { ...base, label: majority, reason: '信息增益低于阈值' }
    }

    const nextFeatures = remaining.filter(
      (feature) => feature !== chosen.feature,
    )
    const branches: Record<string, TreeNode> = {}
    chosen.partitions.forEach((partition) => {
      const childRows = subset.filter(
        (item) => item[chosen.feature] === partition.value,
      )
      branches[partition.value] = build(childRows, nextFeatures, depth + 1)
    })

    return {
      ...base,
      feature: chosen.feature,
      gain: chosen.gain,
      branches,
    }
  }

  return build(rows, features, 0)
}

export function predict(
  tree: TreeNode,
  sample: Record<FeatureKey, string>,
): { label: ApprovalLabel; path: TreeNode[]; branches: string[] } {
  const path: TreeNode[] = [tree]
  const branches: string[] = []
  let current = tree

  while (current.feature && Object.keys(current.branches).length) {
    const value = sample[current.feature]
    branches.push(value)
    const next = current.branches[value]
    if (!next) return { label: current.majority, path, branches }
    current = next
    path.push(current)
  }

  return { label: current.label ?? current.majority, path, branches }
}

export function flattenTree(tree: TreeNode): TreeNode[] {
  return [
    tree,
    ...Object.values(tree.branches).flatMap((child) => flattenTree(child)),
  ]
}

export function treeMetrics(
  tree: TreeNode,
  rows: CategorizedLoanRow[],
): TrainingMetrics {
  const nodes = flattenTree(tree)
  const leaves = nodes.filter((node) => !node.feature)
  const correct = rows.filter((row) => {
    const sample = {
      age: row.age,
      income: row.income,
      stability: row.stability,
      overdue: row.overdue,
      dti: row.dti,
    }
    return predict(tree, sample).label === row.label
  }).length
  const pureSamples = leaves.reduce((sum, leaf) => {
    const majorityCount = leaf.samples.filter(
      (row) => row.label === leaf.majority,
    ).length
    return sum + majorityCount
  }, 0)

  return {
    entropy: entropy(rows),
    gains: allGains(rows),
    depth: Math.max(...nodes.map((node) => node.depth)),
    leaves: leaves.length,
    purity: rows.length ? pureSamples / rows.length : 0,
    accuracy: rows.length ? correct / rows.length : 0,
  }
}

export function trainingSnapshots(tree: TreeNode): TrainingSnapshot[] {
  const allNodes = flattenTree(tree)
  const maxDepth = Math.max(...allNodes.map((node) => node.depth))
  const snapshots: TrainingSnapshot[] = []

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const visible = allNodes.filter((node) => node.depth <= depth)
    const frontier = allNodes.filter((node) => node.depth === depth)
    const totalSamples = frontier.reduce(
      (sum, node) => sum + node.samples.length,
      0,
    )
    const averageEntropy = totalSamples
      ? frontier.reduce(
          (sum, node) => sum + node.entropy * node.samples.length,
          0,
        ) / totalSamples
      : 0
    const splittable = frontier.filter((node) => node.feature)
    const reference = splittable[0] ?? frontier[0]
    const remaining = FEATURE_ORDER.filter((feature) =>
      reference?.samples.some((row) => row[feature] !== undefined),
    )

    snapshots.push({
      depth,
      nodes: visible,
      averageEntropy,
      remainingSplittable: splittable.length,
      bestGain: Math.max(0, ...splittable.map((node) => node.gain)),
      featureGains: reference
        ? allGains(reference.samples, remaining)
        : [],
    })
  }

  return snapshots
}

export function classCounts(rows: CategorizedLoanRow[]): {
  pass: number
  reject: number
} {
  const pass = rows.filter((row) => row.label === '通过').length
  return { pass, reject: rows.length - pass }
}

export function featureStats(
  rows: CategorizedLoanRow[],
): Array<{
  feature: FeatureKey
  value: string
  pass: number
  reject: number
  total: number
}> {
  return FEATURE_ORDER.flatMap((feature) => {
    const groups = new Map<string, CategorizedLoanRow[]>()
    rows.forEach((row) => {
      groups.set(row[feature], [...(groups.get(row[feature]) ?? []), row])
    })
    return [...groups.entries()].map(([value, subset]) => {
      const { pass, reject } = classCounts(subset)
      return { feature, value, pass, reject, total: subset.length }
    })
  })
}
