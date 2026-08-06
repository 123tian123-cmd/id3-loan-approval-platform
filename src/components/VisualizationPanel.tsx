import {
  BarChart3,
  CirclePause,
  CirclePlay,
  GitBranch,
  RotateCcw,
  SkipForward,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { FEATURE_META } from '../data'
import { trainingSnapshots } from '../lib/id3'
import type { TrainingSnapshot, TreeNode } from '../types'
import { GainBarChart, PurityLineChart } from './Charts'
import { TreeCanvas } from './TreeCanvas'
import { Button, EmptyState, Metric, Section, TeachingTip } from './ui'

export function VisualizationPanel({
  tree,
  onNotice,
}: {
  tree: TreeNode | null
  onNotice: (message: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const snapshots = useMemo(
    () => (tree ? trainingSnapshots(tree) : []),
    [tree],
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    setActiveIndex(0)
    setPlaying(false)
  }, [tree])

  useEffect(() => {
    if (!playing || !snapshots.length) return
    if (activeIndex >= snapshots.length - 1) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(() => {
      setActiveIndex((current) =>
        Math.min(snapshots.length - 1, current + 1),
      )
    }, 1400 / speed)
    return () => window.clearTimeout(timer)
  }, [playing, activeIndex, snapshots.length, speed])

  const active: TrainingSnapshot | undefined = snapshots[activeIndex]

  const step = () => {
    if (!snapshots.length) {
      onNotice('请先完成模型训练，再进行分层演示', 'error')
      return
    }
    setPlaying(false)
    setActiveIndex((current) =>
      Math.min(snapshots.length - 1, current + 1),
    )
  }

  const togglePlay = () => {
    if (!snapshots.length) {
      onNotice('请先完成模型训练，再启动自动演示', 'error')
      return
    }
    if (activeIndex >= snapshots.length - 1) setActiveIndex(0)
    setPlaying((current) => !current)
  }

  const reset = () => {
    setPlaying(false)
    setActiveIndex(0)
  }

  const activeLayerNodes =
    active?.nodes.filter((node) => node.depth === active.depth) ?? []

  return (
    <Section
      id="visualization"
      icon={<GitBranch size={25} />}
      eyebrow="MODULE 04 · 分层建树"
      title="训练过程可视化"
      description="依据训练结果与当前约束参数执行预剪枝，逐帧观察完整决策树的生成过程。"
    >
      <div className="visual-principle">
        <Sparkles size={20} />
        <div>
          <strong>ID3 分层构建核心</strong>
          <span>
            计算候选增益 → 选择最大增益特征 → 划分样本子集 → 对非纯净子集递归
          </span>
        </div>
        <TeachingTip title="教学模式">
          单步模式每次只新增一层节点；自动演示按照速度设置逐层播放。
        </TeachingTip>
      </div>

      <div className="animation-controls teaching-control">
        <div>
          <Button onClick={togglePlay}>
            {playing ? <CirclePause size={18} /> : <CirclePlay size={18} />}
            {playing ? '暂停演示' : '自动演示'}
          </Button>
          <Button variant="secondary" onClick={step}>
            <SkipForward size={18} /> 单步生成节点
          </Button>
          <Button variant="secondary" onClick={reset}>
            <RotateCcw size={18} /> 重置
          </Button>
        </div>
        <label className="speed-control">
          <span>
            动画速度 <strong>{speed.toFixed(1)}x</strong>
          </span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.5"
            value={speed}
            onChange={(event) => setSpeed(event.target.valueAsNumber)}
          />
        </label>
      </div>

      {!tree || !active ? (
        <EmptyState
          icon={<GitBranch size={34} />}
          title="训练动画尚未生成"
          text="请先在模型训练面板完成训练，系统会将真实决策树拆分为逐层动画帧。"
        />
      ) : (
        <>
          <TreeCanvas
            tree={tree}
            visibleDepth={active.depth}
            title={`分层构建预览 · 第 ${active.depth} 层`}
            compact
            allowExport={false}
            onNotice={(message) => onNotice(message)}
          />

          <div className="visual-grid">
            <article className="layer-log-card">
              <div className="subheading">
                <span>分层构建日志</span>
                <em>
                  {activeIndex + 1} / {snapshots.length}
                </em>
              </div>
              <div className="layer-timeline">
                {snapshots.map((snapshot, index) => (
                  <button
                    type="button"
                    key={snapshot.depth}
                    className={
                      index === activeIndex
                        ? 'active'
                        : index < activeIndex
                          ? 'complete'
                          : ''
                    }
                    onClick={() => {
                      setPlaying(false)
                      setActiveIndex(index)
                    }}
                  >
                    <i>{index < activeIndex ? '✓' : snapshot.depth}</i>
                    <span>第 {snapshot.depth} 层</span>
                  </button>
                ))}
              </div>
              <div className="layer-log-lines">
                {activeLayerNodes.map((node) => (
                  <div key={node.id}>
                    <span>{node.feature ? '划分' : '叶子'}</span>
                    <p>
                      {node.feature
                        ? `选择${FEATURE_META[node.feature].name}，信息增益 ${node.gain.toFixed(4)}`
                        : `输出审批${node.label ?? node.majority}，停止原因：${node.reason}`}
                    </p>
                    <small>
                      子集 {node.samples.length} 条 · 熵{' '}
                      {node.entropy.toFixed(4)}
                      {node.feature &&
                        ` · 生成 ${Object.keys(node.branches).length} 个分支`}
                    </small>
                  </div>
                ))}
              </div>
            </article>

            <article className="chart-card">
              <div className="subheading">
                <span>候选特征信息增益</span>
                <BarChart3 size={17} />
              </div>
              <GainBarChart gains={active.featureGains} compact />
              <small className="chart-footnote">
                悬浮柱体查看当前子集熵、分支加权熵与信息增益。
              </small>
            </article>

            <article className="chart-card entropy-chart-card">
              <div className="subheading">
                <span>节点平均熵变化</span>
                <em>不确定性下降轨迹</em>
              </div>
              <PurityLineChart
                values={snapshots.map((snapshot) => snapshot.averageEntropy)}
                activeIndex={activeIndex}
              />
            </article>
          </div>

          <div className="iteration-panel">
            <div className="subheading">
              <span>当前迭代状态</span>
              <em>Layer {active.depth}</em>
            </div>
            <div className="metrics-grid">
              <Metric
                label="当前构建层数"
                value={`${active.depth} / ${snapshots.length - 1}`}
                accent="cyan"
              />
              <Metric
                label="当前子集平均熵"
                value={active.averageEntropy.toFixed(4)}
                accent="yellow"
              />
              <Metric
                label="本层最大信息增益"
                value={active.bestGain.toFixed(4)}
                accent="green"
              />
              <Metric
                label="剩余可分裂子集"
                value={active.remainingSplittable}
                accent="cyan"
              />
            </div>
          </div>
        </>
      )}
    </Section>
  )
}
