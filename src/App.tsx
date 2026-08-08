import {
  GraduationCap,
  Landmark,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { CasePanel } from './components/CasePanel'
import { EvaluationPanel } from './components/EvaluationPanel'
import { FormulaPanel } from './components/FormulaPanel'
import { ParameterPanel } from './components/ParameterPanel'
import { TrainingPanel } from './components/TrainingPanel'
import { Modal, Toast } from './components/ui'
import { VisualizationPanel } from './components/VisualizationPanel'
import {
  DEFAULT_CONSTRAINTS,
  DEFAULT_MAPPINGS,
  DEFAULT_TRAINING_DATA,
  FEATURE_META,
  SAMPLE_TEMPLATES,
} from './data'
import {
  buildTree,
  categorizeRows,
  cloneMappings,
  mappingErrors,
  treeMetrics,
  validateRows,
} from './lib/id3'
import type {
  CategorizedLoanRow,
  LoanRow,
  LoanSample,
  MappingConfig,
  TrainingMetrics,
  TreeConstraints,
  TreeNode,
} from './types'

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback))
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue] as const
}

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const DATASET_STORAGE_KEY = 'id3-dataset-v5'
const CONSTRAINTS_STORAGE_KEY = 'id3-constraints-v5'
const TRAINED_STORAGE_KEY = 'id3-trained-v5'

export default function App() {
  const [rows, setRows] = usePersistentState<LoanRow[]>(
    DATASET_STORAGE_KEY,
    DEFAULT_TRAINING_DATA.map((row) => ({ ...row })),
  )
  const [mappings, setMappings] = usePersistentState<MappingConfig>(
    'id3-mappings-v4',
    cloneMappings(DEFAULT_MAPPINGS),
  )
  const [constraints, setConstraints] = usePersistentState<TreeConstraints>(
    CONSTRAINTS_STORAGE_KEY,
    { ...DEFAULT_CONSTRAINTS },
  )
  const [sample, setSample] = usePersistentState<LoanSample>(
    'id3-current-sample-v4',
    { ...SAMPLE_TEMPLATES.中等风险样本 },
  )
  const [convertedRows, setConvertedRows] = useState<CategorizedLoanRow[]>(
    () => {
      const trained = window.localStorage.getItem(TRAINED_STORAGE_KEY) === 'true'
      return trained ? categorizeRows(rows, mappings) : []
    },
  )
  const [tree, setTree] = useState<TreeNode | null>(() => {
    const trained = window.localStorage.getItem(TRAINED_STORAGE_KEY) === 'true'
    if (!trained) return null
    try {
      const categorized = categorizeRows(rows, mappings)
      return buildTree(categorized, constraints)
    } catch {
      return null
    }
  })
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(() => {
    const trained = window.localStorage.getItem(TRAINED_STORAGE_KEY) === 'true'
    if (!trained) return null
    try {
      const categorized = categorizeRows(rows, mappings)
      const initialTree = buildTree(categorized, constraints)
      return treeMetrics(initialTree, categorized)
    } catch {
      return null
    }
  })
  const [training, setTraining] = useState(false)
  const [evaluationStale, setEvaluationStale] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    tone: 'success' | 'error' | 'info'
  } | null>(null)
  const toastTimer = useRef<number | null>(null)

  const notice = (
    message: string,
    tone: 'success' | 'error' | 'info' = 'success',
  ) => {
    setToast({ message, tone })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3600)
  }

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  useEffect(() => {
    const trained =
      window.localStorage.getItem(TRAINED_STORAGE_KEY) === 'true'
    if (!trained || training || !convertedRows.length) return
    const prunedTree = buildTree(convertedRows, constraints)
    setTree(prunedTree)
    setMetrics(treeMetrics(prunedTree, convertedRows))
  }, [constraints, convertedRows, training])

  const updateRows: Dispatch<SetStateAction<LoanRow[]>> = (next) => {
    setRows(next)
    setEvaluationStale(true)
  }

  const updateMappings: Dispatch<SetStateAction<MappingConfig>> = (next) => {
    setMappings(next)
    setEvaluationStale(true)
  }

  const train = async () => {
    const issues = [...mappingErrors(mappings), ...validateRows(rows, mappings)]
    if (issues.length) {
      setValidationIssues(issues)
      notice(`训练已拦截：发现 ${issues.length} 项数据或映射问题`, 'error')
      return
    }

    setTraining(true)
    setProgress(4)
    setLogs([])

    const categorized = categorizeRows(rows, mappings)
    const stage = async (message: string, nextProgress: number) => {
      setLogs((current) => [...current, message])
      setProgress(nextProgress)
      await delay(170)
    }

    await stage(`读取并校验 ${categorized.length} 条信贷样本`, 10)
    const draftTree = buildTree(categorized, constraints)
    const draftMetrics = treeMetrics(draftTree, categorized)
    await stage(
      `计算数据集熵 H(D) = ${draftMetrics.entropy.toFixed(4)}`,
      22,
    )
    for (const gain of draftMetrics.gains) {
      const weightedEntropy = gain.partitions
        .map(
          (partition) =>
            `${partition.weight.toFixed(4)}×H(Dᵥ=${partition.entropy.toFixed(4)})`,
        )
        .join(' + ')
      await stage(
        `${FEATURE_META[gain.feature].name}：Gain(D,A) = ${gain.baseEntropy.toFixed(4)} - (${weightedEntropy}) = ${gain.gain.toFixed(4)}`,
        22 +
          Math.round(
            ((draftMetrics.gains.indexOf(gain) + 1) /
              draftMetrics.gains.length) *
              42,
          ),
      )
    }
    await stage(
      `增益比较完成：${FEATURE_META[draftMetrics.gains[0].feature].name}为根节点最优特征`,
      72,
    )
    await stage(
      `递归执行分层划分，生成 ${draftMetrics.depth} 层、${draftMetrics.leaves} 个叶子节点`,
      88,
    )
    await stage(
      `约束校验完成：最大深度 ${constraints.maxDepth}，最小增益 ${constraints.minGain}`,
      96,
    )
    await stage(
      `训练完成：分类纯度 ${(draftMetrics.purity * 100).toFixed(1)}%，训练集准确率 ${(draftMetrics.accuracy * 100).toFixed(1)}%`,
      100,
    )

    setConvertedRows(categorized)
    setTree(draftTree)
    setMetrics(draftMetrics)
    setEvaluationStale(false)
    setTraining(false)
    window.localStorage.setItem(TRAINED_STORAGE_KEY, 'true')
    notice(
      `模型训练完成，根节点为${FEATURE_META[draftMetrics.gains[0].feature].name}`,
    )
  }

  const refreshEvaluation = () => {
    if (!tree) {
      notice('请先完成模型训练，再刷新量化评估', 'error')
      return
    }
    if (!rows.length) {
      notice('无法刷新评估：训练数据集为空', 'error')
      return
    }

    const issues = [...mappingErrors(mappings), ...validateRows(rows, mappings)]
    if (issues.length) {
      setValidationIssues(issues)
      notice(`评估刷新已拦截：发现 ${issues.length} 项数据或映射问题`, 'error')
      return
    }

    const categorized = categorizeRows(rows, mappings)
    const refreshedTree = buildTree(categorized, constraints)
    const refreshedMetrics = treeMetrics(refreshedTree, categorized)
    setConvertedRows(categorized)
    setTree(refreshedTree)
    setMetrics(refreshedMetrics)
    setEvaluationStale(false)
    window.localStorage.setItem(TRAINED_STORAGE_KEY, 'true')
    notice(
      `模型评估已刷新，当前训练集准确率 ${(refreshedMetrics.accuracy * 100).toFixed(2)}%`,
    )
  }

  const resetTraining = () => {
    setTraining(false)
    setProgress(0)
    setLogs([])
    setConvertedRows([])
    setTree(null)
    setMetrics(null)
    setEvaluationStale(false)
    window.localStorage.removeItem(TRAINED_STORAGE_KEY)
    notice('训练结果、增益数据和决策树画布已清空', 'info')
  }

  const navItems = [
    ['formula', '公式原理'],
    ['training', '模型训练'],
    ['parameters', '约束参数'],
    ['visualization', '训练可视化'],
    ['evaluation', '量化评估'],
    ['case', '案例输入'],
  ]

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-inner">
          <div className="brand-mark" aria-hidden="true">
            <Landmark size={38} />
          </div>
          <div className="hero-copy">
            <span className="hero-kicker">MACHINE LEARNING LAB</span>
            <h1>ID3决策树借贷审批平台</h1>
            <p>基于信息增益的信贷风控分类实训平台</p>
          </div>
        </div>

        <div className="scene-switch" aria-label="业务场景">
          <button type="button" className="active">
            <ShieldCheck size={20} />
            借贷审批风控预测
          </button>
        </div>
      </header>

      <nav className="section-nav">
        <div className="section-nav-inner">
          <div className="nav-brand">
            <GraduationCap size={19} />
            <span>ID3 实训导航</span>
          </div>
          <button
            type="button"
            className="mobile-menu"
            onClick={() => setMobileNavOpen((value) => !value)}
            aria-label="展开页面导航"
          >
            {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <div className={mobileNavOpen ? 'nav-links open' : 'nav-links'}>
            {navItems.map(([id, label], index) => (
              <a
                href={`#${id}`}
                key={id}
                onClick={() => setMobileNavOpen(false)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <main className="main-container">
        <FormulaPanel />
        <TrainingPanel
          rows={rows}
          setRows={updateRows}
          mappings={mappings}
          setMappings={updateMappings}
          convertedRows={convertedRows}
          metrics={metrics}
          training={training}
          progress={progress}
          logs={logs}
          onTrain={train}
          onReset={resetTraining}
          onNotice={notice}
        />
        <ParameterPanel
          constraints={constraints}
          setConstraints={setConstraints}
          onNotice={notice}
        />
        <VisualizationPanel tree={tree} onNotice={notice} />
        <EvaluationPanel
          tree={tree}
          rows={convertedRows}
          sourceRowCount={rows.length}
          stale={evaluationStale}
          training={training}
          onRefresh={refreshEvaluation}
        />
        <CasePanel
          tree={tree}
          sample={sample}
          setSample={setSample}
          mappings={mappings}
          onNotice={notice}
        />
      </main>

      <footer>
        <div>
          <Landmark size={21} />
          <span>ID3决策树借贷审批平台</span>
        </div>
        <p>
          教学演示平台 · 信息熵 · 信息增益 · 信贷风控 ·
          默认训练数据随平台发布，导入和编辑仅保存在当前浏览器
        </p>
      </footer>

      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}

      <Modal
        open={validationIssues.length > 0}
        title="训练前校验未通过"
        onClose={() => setValidationIssues([])}
      >
        <div className="validation-modal">
          <p>
            系统已阻止启动训练。请根据以下指引修正数据或映射区间：
          </p>
          <ol>
            {validationIssues.slice(0, 18).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ol>
          {validationIssues.length > 18 && (
            <small>另有 {validationIssues.length - 18} 项问题未展开。</small>
          )}
        </div>
      </Modal>
    </div>
  )
}
