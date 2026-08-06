import {
  BookmarkPlus,
  Calculator,
  ChevronRight,
  ClipboardCheck,
  Database,
  Gauge,
} from 'lucide-react'
import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  FEATURE_META,
  MAPPING_DOMAINS,
  NUMERIC_FEATURES,
  SAMPLE_TEMPLATES,
} from '../data'
import { mapValue, predict } from '../lib/id3'
import type {
  LoanSample,
  MappingConfig,
  NumericFeatureKey,
  SavedSample,
  TreeNode,
} from '../types'
import { Button, Section, TeachingTip } from './ui'

type InputMode = Record<NumericFeatureKey, 'category' | 'number'>

function riskFor(label: '通过' | '拒绝', sample: LoanSample) {
  if (label === '通过') return sample.overdue === '有' ? '中' : '低'
  return sample.overdue === '有' ? '高' : '中'
}

export function SamplePanel({
  sample,
  setSample,
  mappings,
  savedSamples,
  setSavedSamples,
  tree,
  onNotice,
  onGoCalculate,
}: {
  sample: LoanSample
  setSample: Dispatch<SetStateAction<LoanSample>>
  mappings: MappingConfig
  savedSamples: SavedSample[]
  setSavedSamples: Dispatch<SetStateAction<SavedSample[]>>
  tree: TreeNode | null
  onNotice: (message: string, tone?: 'success' | 'error' | 'info') => void
  onGoCalculate: () => void
}) {
  const [modes, setModes] = useState<InputMode>({
    age: 'category',
    income: 'category',
    stability: 'category',
    dti: 'category',
  })
  const [numericValues, setNumericValues] = useState<
    Record<NumericFeatureKey, number>
  >({
    age: 42,
    income: 8500,
    stability: 72,
    dti: 40,
  })
  const [batchResults, setBatchResults] = useState<
    Array<{ sample: SavedSample; result: '通过' | '拒绝'; risk: string }>
  >([])

  const selectedId = useMemo(
    () =>
      savedSamples.find(
        (item) =>
          item.age === sample.age &&
          item.income === sample.income &&
          item.stability === sample.stability &&
          item.overdue === sample.overdue &&
          item.dti === sample.dti,
      )?.id ?? '',
    [savedSamples, sample],
  )

  const updateNumeric = (feature: NumericFeatureKey, value: number) => {
    setNumericValues((current) => ({ ...current, [feature]: value }))
    const mapped = mapValue(value, feature, mappings)
    if (mapped) {
      setSample((current) => ({ ...current, [feature]: mapped.label }))
    }
  }

  const normalizeNumeric = (feature: NumericFeatureKey) => {
    const numeric = numericValues[feature]
    const mapped = mapValue(numeric, feature, mappings, true)
    if (!mapped) return
    setSample((current) => ({ ...current, [feature]: mapped.label }))
    if (mapped.adjusted) {
      onNotice(
        `${FEATURE_META[feature].name}数值 ${numeric} 超出离散区间，已匹配到最近分类“${mapped.label}”`,
        'error',
      )
    }
  }

  const fillTemplate = (name: keyof typeof SAMPLE_TEMPLATES) => {
    setSample({ ...SAMPLE_TEMPLATES[name] })
    setModes({
      age: 'category',
      income: 'category',
      stability: 'category',
      dti: 'category',
    })
    onNotice(`已填充${name}`)
  }

  const saveSample = () => {
    const name = `待测样本 ${savedSamples.length + 1}`
    const next: SavedSample = {
      ...sample,
      id: `S${Date.now().toString().slice(-7)}`,
      name,
    }
    setSavedSamples((current) => [...current, next])
    onNotice(`${name}已保存到本地样本库`)
  }

  const calculateBatch = () => {
    if (!tree) {
      onNotice('请先训练模型，再执行批量审批计算', 'error')
      return
    }
    if (!savedSamples.length) {
      onNotice('样本库为空，请先保存至少一条待测样本', 'error')
      return
    }
    setBatchResults(
      savedSamples.map((item) => {
        const result = predict(tree, item).label
        return { sample: item, result, risk: riskFor(result, item) }
      }),
    )
    onNotice(`已完成 ${savedSamples.length} 条样本的批量计算`)
  }

  return (
    <Section
      id="sample"
      icon={<ClipboardCheck size={25} />}
      eyebrow="MODULE 04 · 待审批录入"
      title="输入贷款审批单样本监测数据"
      description="分类值可直接选择，原始数字则按训练设置中的离散标准实时转换。"
    >
      <div className="sample-note">
        <Database size={19} />
        <p>
          数字将依据训练设置内自定义离散标准自动转为分类汉字，用于决策树路径匹配判断。
        </p>
      </div>

      <div className="sample-input-grid">
        {NUMERIC_FEATURES.map((feature) => {
          const domain = MAPPING_DOMAINS[feature]
          const mode = modes[feature]
          return (
            <article className="sample-field" key={feature}>
              <div className="field-title">
                <label>{FEATURE_META[feature].name}</label>
                <TeachingTip title={`${FEATURE_META[feature].name}输入`}>
                  支持直接选择分类标签，也支持输入原始数字自动映射；超出范围时采用最近分类并给出提示。
                </TeachingTip>
              </div>
              <div className="mini-toggle teaching-control">
                <button
                  type="button"
                  className={mode === 'category' ? 'active' : ''}
                  onClick={() =>
                    setModes((current) => ({
                      ...current,
                      [feature]: 'category',
                    }))
                  }
                >
                  分类选择
                </button>
                <button
                  type="button"
                  className={mode === 'number' ? 'active' : ''}
                  onClick={() =>
                    setModes((current) => ({
                      ...current,
                      [feature]: 'number',
                    }))
                  }
                >
                  数字录入
                </button>
              </div>
              {mode === 'category' ? (
                <select
                  value={sample[feature]}
                  onChange={(event) =>
                    setSample((current) => ({
                      ...current,
                      [feature]: event.target.value,
                    }))
                  }
                >
                  {FEATURE_META[feature].values.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              ) : (
                <div className="number-map-input">
                  <div>
                    <input
                      type="number"
                      min={domain.min}
                      max={domain.max}
                      value={numericValues[feature]}
                      onChange={(event) =>
                        updateNumeric(feature, event.target.valueAsNumber)
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
              )}
            </article>
          )
        })}

        <article className="sample-field overdue-field">
          <div className="field-title">
            <label>信用卡逾期史</label>
            <TeachingTip title="信用卡逾期史">
              选择“有”表示历史记录中存在信用卡逾期，“无”表示没有逾期记录。
            </TeachingTip>
          </div>
          <div className="overdue-options">
            {(['无', '有'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={sample.overdue === value ? 'active' : ''}
                onClick={() =>
                  setSample((current) => ({ ...current, overdue: value }))
                }
              >
                <span>{value === '无' ? '✓' : '!'}</span>
                <div>
                  <strong>{value}</strong>
                  <small>{value === '无' ? '无历史逾期' : '存在逾期记录'}</small>
                </div>
              </button>
            ))}
          </div>
        </article>
      </div>

      <div className="sample-shortcuts teaching-control">
        <span>
          <Gauge size={17} /> 快捷填充模板
        </span>
        {(
          Object.keys(SAMPLE_TEMPLATES) as Array<
            keyof typeof SAMPLE_TEMPLATES
          >
        ).map((name) => (
          <Button
            key={name}
            variant="secondary"
            className={`template-${name.slice(0, 1)}`}
            onClick={() => fillTemplate(name)}
          >
            {name}
          </Button>
        ))}
      </div>

      <div className="sample-library teaching-control">
        <div>
          <label>已保存待测样本</label>
          <select
            value={selectedId}
            onChange={(event) => {
              const selected = savedSamples.find(
                (item) => item.id === event.target.value,
              )
              if (selected) {
                setSample({
                  age: selected.age,
                  income: selected.income,
                  stability: selected.stability,
                  overdue: selected.overdue,
                  dti: selected.dti,
                })
              }
            }}
          >
            <option value="">选择样本（{savedSamples.length}）</option>
            {savedSamples.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.overdue}逾期
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" onClick={saveSample}>
          <BookmarkPlus size={17} /> 保存当前样本
        </Button>
        <Button variant="secondary" onClick={calculateBatch}>
          <Calculator size={17} /> 批量计算
        </Button>
        <Button onClick={onGoCalculate}>
          送入分步演算 <ChevronRight size={17} />
        </Button>
      </div>

      {batchResults.length > 0 && (
        <div className="batch-results">
          <div className="subheading">
            <span>批量审批结果</span>
            <em>{batchResults.length} 条</em>
          </div>
          <div className="mini-table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>样本</th>
                  <th>年龄</th>
                  <th>收入</th>
                  <th>稳定度</th>
                  <th>逾期史</th>
                  <th>判定</th>
                  <th>风险</th>
                </tr>
              </thead>
              <tbody>
                {batchResults.map((item) => (
                  <tr key={item.sample.id}>
                    <td>{item.sample.name}</td>
                    <td>{item.sample.age}</td>
                    <td>{item.sample.income}</td>
                    <td>{item.sample.stability}</td>
                    <td>{item.sample.overdue}</td>
                    <td className={item.result === '通过' ? 'pass-text' : 'reject-text'}>
                      审批{item.result}
                    </td>
                    <td>{item.risk}风险</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  )
}
