import {
  BarChart3,
  FileSpreadsheet,
  FlaskConical,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { CellValue } from 'exceljs'
import {
  FEATURE_META,
  MAPPING_DOMAINS,
  NUMERIC_FEATURES,
} from '../data'
import {
  categorizeRows,
  cloneMappings,
  featureStats,
  mappingErrors,
  parseApprovalLabel,
} from '../lib/id3'
import type {
  CategorizedLoanRow,
  FeatureKey,
  LoanRow,
  MappingConfig,
  NumericFeatureKey,
  TrainingMetrics,
} from '../types'
import { GainBarChart } from './Charts'
import {
  Button,
  EmptyState,
  Section,
  Tabs,
  TeachingTip,
} from './ui'

type TrainingTab = 'data' | 'mapping'

const HEADERS = {
  age: ['年龄', 'age'],
  income: ['收入', 'income'],
  stability: ['工作稳定度', '稳定度', 'stability'],
  overdue: ['信用卡逾期史', '逾期史', 'overdue'],
  dti: ['dti', '负债收入比', '负债与收入比'],
  label: ['审批结果', '标签', 'label'],
}

function excelValue(value: CellValue): string | number {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if ('result' in value && value.result !== undefined) {
    return String(value.result)
  }
  if ('richText' in value) {
    return value.richText.map((part) => part.text).join('')
  }
  if ('text' in value) return value.text
  return String(value)
}

function normalizeImportedRow(
  source: Record<string, unknown>,
  index: number,
): LoanRow {
  const valueFor = (keys: string[]) => {
    const found = Object.keys(source).find((key) =>
      keys.some((candidate) => key.trim().toLowerCase() === candidate),
    )
    return found ? source[found] : ''
  }
  return {
    id: String(source['样本编号'] ?? source.id ?? `I${index + 1}`),
    age: valueFor(HEADERS.age) as string | number,
    income: valueFor(HEADERS.income) as string | number,
    stability: valueFor(HEADERS.stability) as string | number,
    overdue: String(valueFor(HEADERS.overdue)),
    dti: valueFor(HEADERS.dti) as string | number,
    label:
      parseApprovalLabel(valueFor(HEADERS.label)) ??
      String(valueFor(HEADERS.label)).trim(),
  }
}

function DatasetEditor({
  rows,
  setRows,
  mappings,
  onNotice,
}: {
  rows: LoanRow[]
  setRows: Dispatch<SetStateAction<LoanRow[]>>
  mappings: MappingConfig
  onNotice: (message: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const categorized = useMemo(
    () => categorizeRows(rows, mappings),
    [rows, mappings],
  )
  const stats = useMemo(() => featureStats(categorized), [categorized])

  const updateCell = (
    id: string,
    key: Exclude<keyof LoanRow, 'id'>,
    value: string,
  ) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    )
  }

  const addRow = () => {
    const id = `C${Date.now().toString().slice(-6)}`
    setRows((current) => [
      ...current,
      {
        id,
        age: '',
        income: '',
        stability: '',
        overdue: '无',
        dti: '',
        label: '',
      },
    ])
    onNotice('已新增空白样本，请补全字段', 'info')
  }

  const deleteRows = () => {
    if (!selected.size) {
      onNotice('请先勾选需要删除的样本', 'error')
      return
    }
    setRows((current) => current.filter((row) => !selected.has(row.id)))
    onNotice(`已删除 ${selected.size} 条样本`)
    setSelected(new Set())
  }

  const importExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const ExcelJS = (await import('exceljs')).default
      const buffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)
      const sheet = workbook.worksheets[0]
      if (!sheet) throw new Error('工作簿中没有工作表')
      const headers = (sheet.getRow(1).values as CellValue[])
        .slice(1)
        .map((value) => String(excelValue(value)).trim())
      const data: Record<string, unknown>[] = []
      sheet.eachRow((excelRow, rowNumber) => {
        if (rowNumber === 1) return
        const source: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          source[header] = excelValue(excelRow.getCell(index + 1).value)
        })
        if (Object.values(source).some((value) => String(value).trim() !== '')) {
          data.push(source)
        }
      })
      if (!data.length) throw new Error('工作表中没有数据')
      setRows(data.map(normalizeImportedRow))
      setSelected(new Set())
      onNotice(`已导入 ${data.length} 条样本，请在训练前完成校验`)
    } catch (error) {
      onNotice(
        `Excel 导入失败：${error instanceof Error ? error.message : '文件格式异常'}`,
        'error',
      )
    }
  }

  return (
    <>
      <div className="dataset-toolbar teaching-control">
        <Button onClick={addRow}>
          <Plus size={17} /> 新增样本
        </Button>
        <Button variant="secondary" onClick={deleteRows}>
          <Trash2 size={17} /> 批量删除
        </Button>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          <Upload size={17} /> 导入 Excel
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={importExcel}
          hidden
        />
      </div>

      <div className="table-caption">
        <div>
          <strong>原始训练数据</strong>
          <span>{rows.length} 条样本 · 单击单元格即可编辑</span>
        </div>
        <span className="status-dot">
          <i />
          本地数据
        </span>
      </div>
      <div className="data-table-wrap dataset-table-window">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="全选样本"
                  checked={Boolean(rows.length) && selected.size === rows.length}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? new Set(rows.map((row) => row.id))
                        : new Set(),
                    )
                  }
                />
              </th>
              <th>样本</th>
              <th>
                年龄
                <small>岁 / 分类</small>
              </th>
              <th>
                收入
                <small>元/月 / 分类</small>
              </th>
              <th>
                工作稳定度
                <small>分 / 分类</small>
              </th>
              <th>信用卡逾期史</th>
              <th>
                DTI
                <small>% / 分类</small>
              </th>
              <th>审批结果</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={8}>
                  <div className="dataset-empty">
                    暂无训练数据，请新增样本或导入 Excel 文件
                  </div>
                </td>
              </tr>
            )}
            {rows.map((row, index) => {
              const approvalLabel = parseApprovalLabel(row.label)
              return (
                <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`选择样本 ${row.id}`}
                    checked={selected.has(row.id)}
                    onChange={(event) => {
                      setSelected((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(row.id)
                        else next.delete(row.id)
                        return next
                      })
                    }}
                  />
                </td>
                <td>
                  <span className="row-id">{row.id || index + 1}</span>
                </td>
                {(['age', 'income', 'stability'] as const).map((key) => (
                  <td key={key}>
                    <input
                      value={row[key]}
                      aria-label={`${row.id} ${FEATURE_META[key].name}`}
                      onChange={(event) =>
                        updateCell(row.id, key, event.target.value)
                      }
                    />
                  </td>
                ))}
                <td>
                  <select
                    value={row.overdue}
                    aria-label={`${row.id} 信用卡逾期史`}
                    onChange={(event) =>
                      updateCell(row.id, 'overdue', event.target.value)
                    }
                  >
                    <option value="">请选择</option>
                    <option value="有">有</option>
                    <option value="无">无</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.dti}
                    aria-label={`${row.id} DTI 百分比`}
                    onChange={(event) =>
                      updateCell(row.id, 'dti', event.target.value)
                    }
                  />
                </td>
                <td>
                  <select
                    className={`approval-select ${
                      approvalLabel === '通过'
                        ? 'approved-value'
                        : approvalLabel === '拒绝'
                          ? 'rejected-value'
                          : ''
                    }`}
                    value={approvalLabel ?? ''}
                    aria-label={`${row.id} 审批结果`}
                    onChange={(event) =>
                      updateCell(row.id, 'label', event.target.value)
                    }
                  >
                    <option value="">请选择</option>
                    <option value="通过">批准</option>
                    <option value="拒绝">不批准</option>
                  </select>
                </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <details className="stats-details">
        <summary>
          <BarChart3 size={18} />
          查看特征分组统计
          <span>自动计算批准 / 不批准数量及样本占比</span>
        </summary>
        <div className="stats-grid">
          {Object.keys(FEATURE_META).map((feature) => (
            <article key={feature}>
              <h4>{FEATURE_META[feature as FeatureKey].name}</h4>
              {stats
                .filter((item) => item.feature === feature)
                .map((item) => (
                  <div className="stat-line" key={item.value}>
                    <strong>{item.value}</strong>
                    <span className="pass-text">
                      批准 {item.pass}（
                      {((item.pass / item.total) * 100).toFixed(0)}%）
                    </span>
                    <span className="reject-text">
                      不批准 {item.reject}（
                      {((item.reject / item.total) * 100).toFixed(0)}%）
                    </span>
                  </div>
                ))}
            </article>
          ))}
        </div>
      </details>
    </>
  )
}

function MappingEditor({
  mappings,
  setMappings,
}: {
  mappings: MappingConfig
  setMappings: Dispatch<SetStateAction<MappingConfig>>
}) {
  const errors = mappingErrors(mappings)

  const updateRule = (
    feature: NumericFeatureKey,
    index: number,
    field: 'min' | 'max',
    value: number,
  ) => {
    setMappings((current) => {
      const next = cloneMappings(current)
      const domain = MAPPING_DOMAINS[feature]
      const boundedValue = Math.max(
        domain.min,
        domain.max === undefined ? value : Math.min(value, domain.max),
      )
      next[feature][index][field] = boundedValue
      return next
    })
  }

  const updateBoundary = (
    feature: NumericFeatureKey,
    index: number,
    value: number,
  ) => {
    setMappings((current) => {
      const next = cloneMappings(current)
      const step = MAPPING_DOMAINS[feature].step ?? 1
      next[feature][index].max = value
      next[feature][index + 1].min = Number(
        (value + step).toFixed(step < 1 ? 2 : 0),
      )
      return next
    })
  }

  return (
    <>
      <div className="mapping-intro">
        <div>
          <Settings2 size={21} />
          <span>
            <strong>特征离散化映射标准</strong>
            数值字段先转换为分类标签，再参与 ID3 信息增益计算。
          </span>
        </div>
        <span className={errors.length ? 'validation-badge error' : 'validation-badge'}>
          {errors.length ? `${errors.length} 项冲突` : '映射校验通过'}
        </span>
      </div>

      <div className="mapping-grid">
        {NUMERIC_FEATURES.map((feature) => {
          const domain = MAPPING_DOMAINS[feature]
          return (
            <article className="mapping-card" key={feature}>
              <div className="mapping-card-head">
                <div>
                  <span>{FEATURE_META[feature].name}</span>
                  <small>单位：{domain.unit}</small>
                </div>
                <TeachingTip title={`${FEATURE_META[feature].name}离散标准`}>
                  {feature === 'stability'
                    ? `有效范围为 ${domain.min} 至 ${domain.max} ${domain.unit}。`
                    : feature === 'age'
                      ? `有效范围为 ${domain.min} 至 ${domain.max} ${domain.unit}。`
                    : feature === 'dti'
                      ? 'DTI = 负债金额 ÷ 收入 × 100%，最后一档不设上限。'
                    : `从 ${domain.min} ${domain.unit}起，最高分类不设上限。`}
                  区间重叠会导致同一数值对应多个分类，训练将被阻止。
                </TeachingTip>
              </div>

              <div className="mapping-section-title">
                <span>手动输入区间</span>
                <small>直接修改各分类的上下限</small>
              </div>
              <div className="rule-table">
                <div className="rule-header">
                  <span>分类标签</span>
                  <span>下限</span>
                  <span>上限</span>
                </div>
                {mappings[feature].map((rule, index) => {
                  const openEnded =
                    domain.max === undefined &&
                    index === mappings[feature].length - 1
                  return (
                    <div className="rule-row" key={rule.label}>
                      <strong>{rule.label}</strong>
                      <input
                        type="number"
                        value={rule.min}
                        min={domain.min}
                        max={domain.max}
                        step={domain.step ?? 1}
                        aria-label={`${FEATURE_META[feature].name}${rule.label}下限`}
                        onChange={(event) =>
                          updateRule(
                            feature,
                            index,
                            'min',
                            event.target.valueAsNumber,
                          )
                        }
                      />
                      {openEnded ? (
                        <span className="unbounded-value">无上限</span>
                      ) : (
                        <input
                          type="number"
                          value={rule.max ?? ''}
                          min={domain.min}
                          max={domain.max}
                          step={domain.step ?? 1}
                          aria-label={`${FEATURE_META[feature].name}${rule.label}上限`}
                          onChange={(event) =>
                            updateRule(
                              feature,
                              index,
                              'max',
                              event.target.valueAsNumber,
                            )
                          }
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="range-section">
                <div className="mapping-section-title">
                  <span>拖动调整分界</span>
                  <small>滑块会同步更新相邻区间</small>
                </div>
                <div className="range-controls">
                  {mappings[feature].slice(0, -1).map((rule, index) => (
                    <label key={`${rule.label}-boundary`}>
                      <span>
                        <em>
                          {rule.label} / {mappings[feature][index + 1].label}
                        </em>
                        <b>分界值 {rule.max}</b>
                      </span>
                      <input
                        type="range"
                        min={domain.min}
                        max={domain.sliderMax - (domain.step ?? 1)}
                        step={domain.step ?? 1}
                        value={rule.max ?? domain.sliderMax - (domain.step ?? 1)}
                        onChange={(event) =>
                          updateBoundary(
                            feature,
                            index,
                            event.target.valueAsNumber,
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="mapping-preview">
                <span>映射结果预览</span>
                {mappings[feature].map((rule) => (
                  <code key={rule.label}>
                    {rule.min}
                    {domain.unit}–{rule.max ?? '无上限'}
                    {rule.max === null ? '' : domain.unit} → {rule.label}
                  </code>
                ))}
              </div>
            </article>
          )
        })}
      </div>

      {errors.length > 0 && (
        <div className="validation-list" role="alert">
          <strong>映射冲突会阻止训练：</strong>
          {errors.map((error) => (
            <span key={error}>{error}</span>
          ))}
        </div>
      )}
    </>
  )
}

function TrainingResults({
  rows,
  convertedRows,
  metrics,
}: {
  rows: LoanRow[]
  convertedRows: CategorizedLoanRow[]
  metrics: TrainingMetrics | null
}) {
  if (!metrics || !convertedRows.length) {
    return (
      <EmptyState
        icon={<FileSpreadsheet size={30} />}
        title="等待训练结果"
        text="完成数据校验并启动训练后，这里将显示五项特征映射对照和信息增益排序。"
      />
    )
  }

  return (
    <div className="training-results">
      <div className="result-block">
        <div className="block-heading">
          <div>
            <span>OUTPUT 01</span>
            <h3>映射转换结果</h3>
          </div>
          <em>{convertedRows.length} 条已转换</em>
        </div>
        <div className="data-table-wrap conversion-table">
          <table className="data-table">
            <thead>
              <tr>
                <th rowSpan={2}>样本</th>
                <th colSpan={2}>年龄</th>
                <th colSpan={2}>收入</th>
                <th colSpan={2}>工作稳定度</th>
                <th colSpan={2}>信用卡逾期史</th>
                <th colSpan={2}>DTI</th>
                <th rowSpan={2}>审批结果</th>
              </tr>
              <tr>
                <th>原始</th>
                <th>转换后</th>
                <th>原始</th>
                <th>转换后</th>
                <th>原始</th>
                <th>转换后</th>
                <th>原始</th>
                <th>转换后</th>
                <th>原始</th>
                <th>转换后</th>
              </tr>
            </thead>
            <tbody>
              {convertedRows.map((row, index) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{rows[index]?.age}</td>
                  <td className="converted">{row.age}</td>
                  <td>{rows[index]?.income}</td>
                  <td className="converted">{row.income}</td>
                  <td>{rows[index]?.stability}</td>
                  <td className="converted">{row.stability}</td>
                  <td>{rows[index]?.overdue}</td>
                  <td>{row.overdue}</td>
                  <td>{rows[index]?.dti}%</td>
                  <td className="converted">{row.dti}</td>
                  <td
                    className={
                      row.label === '通过' ? 'pass-text' : 'reject-text'
                    }
                  >
                    {row.label === '通过' ? '批准' : '不批准'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <article className="chart-card training-gain-card">
        <div className="block-heading">
          <div>
            <span>OUTPUT 02</span>
            <h3>信息增益排序</h3>
          </div>
        </div>
        <GainBarChart gains={metrics.gains} />
      </article>
    </div>
  )
}

export function TrainingPanel({
  rows,
  setRows,
  mappings,
  setMappings,
  convertedRows,
  metrics,
  training,
  progress,
  logs,
  onTrain,
  onReset,
  onNotice,
}: {
  rows: LoanRow[]
  setRows: Dispatch<SetStateAction<LoanRow[]>>
  mappings: MappingConfig
  setMappings: Dispatch<SetStateAction<MappingConfig>>
  convertedRows: CategorizedLoanRow[]
  metrics: TrainingMetrics | null
  training: boolean
  progress: number
  logs: string[]
  onTrain: () => void
  onReset: () => void
  onNotice: (message: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const [tab, setTab] = useState<TrainingTab>('data')
  const hasMappingError = mappingErrors(mappings).length > 0

  return (
    <Section
      id="training"
      icon={<FileSpreadsheet size={25} />}
      eyebrow="MODULE 02 · 数据与训练"
      title="模型训练"
      description="编辑借贷样本，设置数值离散规则，并启动完整 ID3 建树流程。"
    >
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            value: 'data',
            label: (
              <>
                <FileSpreadsheet size={17} /> 输入数据
              </>
            ),
          },
          {
            value: 'mapping',
            label: (
              <>
                <Settings2 size={17} /> 映射规则
              </>
            ),
          },
        ]}
      />
      <div className="tab-panel" role="tabpanel">
        {tab === 'data' ? (
          <DatasetEditor
            rows={rows}
            setRows={setRows}
            mappings={mappings}
            onNotice={onNotice}
          />
        ) : (
          <MappingEditor
            mappings={mappings}
            setMappings={setMappings}
          />
        )}
      </div>

      <div className="training-action teaching-control">
        <div>
          <strong>数据与映射准备就绪后启动训练</strong>
          <span>
            将依次计算数据集熵、各特征分支加权熵与信息增益，并递归生成决策树。
          </span>
        </div>
        <div>
          <Button variant="secondary" onClick={onReset} disabled={training}>
            <RotateCcw size={17} /> 训练重置
          </Button>
          <Button onClick={onTrain} disabled={training || hasMappingError}>
            {training ? (
              <span className="spinner" />
            ) : (
              <FlaskConical size={18} />
            )}
            {training ? '模型训练中' : '开始训练模型'}
          </Button>
        </div>
      </div>

      {(training || logs.length > 0) && (
        <div className="training-progress" aria-live="polite">
          <div className="progress-head">
            <span>
              <i className={training ? 'pulse' : ''} />
              {training ? 'ID3 训练引擎运行中' : '训练流程已完成'}
            </span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-track">
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="training-log">
            {logs.map((log, index) => (
              <p key={`${index}-${log}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {log}
              </p>
            ))}
          </div>
        </div>
      )}

      <TrainingResults
        rows={rows}
        convertedRows={convertedRows}
        metrics={metrics}
      />
    </Section>
  )
}
