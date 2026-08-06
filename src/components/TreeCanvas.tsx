import {
  Download,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Split,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from 'react'
import { FEATURE_META } from '../data'
import { flattenTree } from '../lib/id3'
import type { LayoutDirection, TreeNode } from '../types'
import { Button, Modal } from './ui'

interface PositionedNode {
  node: TreeNode
  x: number
  y: number
}

const NODE_WIDTH = 142
const NODE_HEIGHT = 58

function layoutTree(tree: TreeNode, direction: LayoutDirection) {
  let leafIndex = 0
  const positions = new Map<string, PositionedNode>()
  const depthGap = direction === 'vertical' ? 126 : 220
  const leafGap = direction === 'vertical' ? 172 : 94

  const visit = (node: TreeNode): number => {
    const children = Object.values(node.branches)
    let axis: number
    if (!children.length) {
      axis = 90 + leafIndex * leafGap
      leafIndex += 1
    } else {
      const childAxes = children.map(visit)
      axis =
        childAxes.reduce((sum, childAxis) => sum + childAxis, 0) /
        childAxes.length
    }

    const x = direction === 'vertical' ? axis : 100 + node.depth * depthGap
    const y = direction === 'vertical' ? 70 + node.depth * depthGap : axis
    positions.set(node.id, { node, x, y })
    return axis
  }

  visit(tree)
  const maxDepth = Math.max(...flattenTree(tree).map((node) => node.depth))
  return {
    positions,
    width:
      direction === 'vertical'
        ? Math.max(920, leafIndex * leafGap + 100)
        : Math.max(920, maxDepth * depthGap + 320),
    height:
      direction === 'vertical'
        ? Math.max(500, maxDepth * depthGap + 180)
        : Math.max(500, leafIndex * leafGap + 100),
  }
}

export function TreeCanvas({
  tree,
  visibleDepth,
  title = '信贷 ID3 决策树',
  onNotice,
  compact = false,
  allowExport = true,
  highlightedNodeIds = [],
}: {
  tree: TreeNode
  visibleDepth?: number
  title?: string
  onNotice?: (message: string) => void
  compact?: boolean
  allowExport?: boolean
  highlightedNodeIds?: string[]
}) {
  const [direction, setDirection] = useState<LayoutDirection>('vertical')
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [selected, setSelected] = useState<TreeNode | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const layout = useMemo(() => layoutTree(tree, direction), [tree, direction])
  const viewport = compact
    ? { width: 920, height: 390 }
    : { width: 1100, height: 560 }

  const resetView = () => {
    const scale = Math.min(
      1,
      (viewport.width - 60) / layout.width,
      (viewport.height - 60) / layout.height,
    )
    setTransform({
      x: (viewport.width - layout.width * scale) / 2,
      y: (viewport.height - layout.height * scale) / 2,
      scale,
    })
  }

  useEffect(() => {
    resetView()
    // The layout dimensions are the stable reset inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height, compact])

  const visibleNodes = flattenTree(tree).filter(
    (node) => visibleDepth === undefined || node.depth <= visibleDepth,
  )
  const visibleIds = new Set(visibleNodes.map((node) => node.id))
  const highlightedIds = new Set(highlightedNodeIds)

  const zoom = (factor: number) => {
    setTransform((current) => ({
      ...current,
      scale: Math.min(3, Math.max(0.22, current.scale * factor)),
    }))
  }

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const pointX = ((event.clientX - rect.left) / rect.width) * viewport.width
    const pointY = ((event.clientY - rect.top) / rect.height) * viewport.height
    const factor = event.deltaY > 0 ? 0.9 : 1.1

    setTransform((current) => {
      const nextScale = Math.min(
        3,
        Math.max(0.22, current.scale * factor),
      )
      const worldX = (pointX - current.x) / current.scale
      const worldY = (pointY - current.y) / current.scale
      return {
        scale: nextScale,
        x: pointX - worldX * nextScale,
        y: pointY - worldY * nextScale,
      }
    })
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('[data-tree-node]')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setTransform((current) => ({
      ...current,
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    }))
  }

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const exportPng = () => {
    if (!svgRef.current) return
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width', String(viewport.width * 2))
    clone.setAttribute('height', String(viewport.height * 2))
    clone.setAttribute(
      'style',
      `background:#171a2f;font-family:"Microsoft YaHei",sans-serif`,
    )
    const source = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width * 2
      canvas.height = viewport.height * 2
      const context = canvas.getContext('2d')
      if (!context) return
      context.fillStyle = '#171a2f'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const link = document.createElement('a')
      link.download = `ID3-贷款审批决策树-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png', 1)
      link.click()
      onNotice?.('决策树高清 PNG 已导出')
    }
    image.src = url
  }

  return (
    <div className={`tree-shell ${compact ? 'tree-compact' : ''}`}>
      <div className="tree-toolbar">
        <div>
          <strong>{title}</strong>
          <span>拖动画布平移，滚轮缩放，点击节点查看详情</span>
        </div>
        <div className="toolbar-actions teaching-control">
          <Button
            variant="ghost"
            onClick={() =>
              setDirection((current) =>
                current === 'vertical' ? 'horizontal' : 'vertical',
              )
            }
            title="切换横向/纵向树"
          >
            <Split size={16} />
            {direction === 'vertical' ? '纵向树' : '横向树'}
          </Button>
          <button type="button" onClick={() => zoom(1.15)} title="放大">
            <Plus size={16} />
          </button>
          <button type="button" onClick={() => zoom(0.87)} title="缩小">
            <Minus size={16} />
          </button>
          <button type="button" onClick={resetView} title="适应画布">
            <Maximize2 size={16} />
          </button>
          <button type="button" onClick={resetView} title="重置视图">
            <RotateCcw size={16} />
          </button>
          {allowExport && (
            <button type="button" onClick={exportPng} title="导出高清 PNG">
              <Download size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="tree-viewport">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="img"
          aria-label={title}
        >
          <rect
            x="0"
            y="0"
            width={viewport.width}
            height={viewport.height}
            fill="#171a2f"
          />
          <defs>
            <filter id="nodeGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="featureNode" x1="0" x2="1">
              <stop offset="0%" stopColor="#08c7e8" />
              <stop offset="100%" stopColor="#00eba5" />
            </linearGradient>
            <linearGradient id="passNode" x1="0" x2="1">
              <stop offset="0%" stopColor="#14b86f" />
              <stop offset="100%" stopColor="#00e6a0" />
            </linearGradient>
          </defs>
          <g
            transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}
          >
            {visibleNodes.flatMap((node) => {
              const from = layout.positions.get(node.id)
              if (!from) return []
              return Object.entries(node.branches)
                .filter(([, child]) => visibleIds.has(child.id))
                .map(([branch, child]) => {
                  const to = layout.positions.get(child.id)
                  if (!to) return null
                  const isHighlighted =
                    highlightedIds.has(node.id) &&
                    highlightedIds.has(child.id)
                  const path =
                    direction === 'vertical'
                      ? `M ${from.x} ${from.y + NODE_HEIGHT / 2} C ${from.x} ${(from.y + to.y) / 2}, ${to.x} ${(from.y + to.y) / 2}, ${to.x} ${to.y - NODE_HEIGHT / 2}`
                      : `M ${from.x + NODE_WIDTH / 2} ${from.y} C ${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x - NODE_WIDTH / 2} ${to.y}`
                  const labelX =
                    direction === 'vertical'
                      ? (from.x + to.x) / 2
                      : (from.x + to.x) / 2
                  const labelY =
                    direction === 'vertical'
                      ? (from.y + to.y) / 2 - 6
                      : (from.y + to.y) / 2 - 8
                  return (
                    <g key={`${node.id}-${branch}`}>
                      <path
                        d={path}
                        fill="none"
                        stroke={isHighlighted ? '#ffd84d' : '#3f6983'}
                        strokeWidth={isHighlighted ? 6 : 2}
                        className={isHighlighted ? 'highlighted-tree-edge' : ''}
                      />
                      <rect
                        x={labelX - 28}
                        y={labelY - 12}
                        width="56"
                        height="22"
                        rx="11"
                        fill="#20243d"
                        stroke="#41506e"
                      />
                      <text
                        x={labelX}
                        y={labelY + 3}
                        fill="#c8d2e8"
                        fontSize="12"
                        textAnchor="middle"
                      >
                        {branch}
                      </text>
                    </g>
                  )
                })
            })}

            {visibleNodes.map((node) => {
              const position = layout.positions.get(node.id)
              if (!position) return null
              const isLeaf = !node.feature
              const isPass = node.label === '通过'
              const isHighlighted = highlightedIds.has(node.id)
              const nodeName = isLeaf
                ? `审批${node.label ?? node.majority}叶子节点`
                : `${FEATURE_META[node.feature!].name}决策节点`
              const openDetails = () => setSelected(node)
              return (
                <g
                  key={node.id}
                  data-tree-node="true"
                  transform={`translate(${position.x} ${position.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${nodeName}，样本 ${node.samples.length} 条，熵 ${node.entropy.toFixed(4)}，增益 ${node.gain.toFixed(4)}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    openDetails()
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    event.stopPropagation()
                    openDetails()
                  }}
                  className={`svg-tree-node ${isHighlighted ? 'highlighted-tree-node' : ''}`}
                >
                  <rect
                    x={-NODE_WIDTH / 2}
                    y={-NODE_HEIGHT / 2}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="13"
                    fill={
                      isLeaf
                        ? isPass
                          ? 'url(#passNode)'
                          : '#f05d68'
                        : 'url(#featureNode)'
                    }
                    stroke={
                      isHighlighted
                        ? '#ffd84d'
                        : isLeaf
                          ? '#ffffff66'
                          : '#55f5ff'
                    }
                    strokeWidth={isHighlighted ? 5 : 1.5}
                    filter="url(#nodeGlow)"
                  />
                  <text
                    x="0"
                    y={isLeaf ? 5 : -4}
                    fill={isLeaf ? '#08181a' : '#071b25'}
                    fontSize="14"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {isLeaf
                      ? `审批${node.label ?? node.majority}`
                      : FEATURE_META[node.feature!].name}
                  </text>
                  {!isLeaf && (
                    <text
                      x="0"
                      y="16"
                      fill="#15303a"
                      fontSize="11"
                      textAnchor="middle"
                    >
                      Gain {node.gain.toFixed(4)}
                    </text>
                  )}
                  <title>{`${isLeaf ? `叶子：审批${node.label}` : `节点：${FEATURE_META[node.feature!].name}`}
样本数：${node.samples.length}
熵：${node.entropy.toFixed(4)}
增益：${node.gain.toFixed(4)}`}</title>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <Modal
        open={Boolean(selected)}
        title={
          selected?.feature
            ? `${FEATURE_META[selected.feature].name}节点`
            : `审批${selected?.label ?? selected?.majority}叶子节点`
        }
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <div className="node-detail-grid">
              <div>
                <span>节点层级</span>
                <strong>第 {selected.depth} 层</strong>
              </div>
              <div>
                <span>子集样本</span>
                <strong>{selected.samples.length} 条</strong>
              </div>
              <div>
                <span>节点熵值</span>
                <strong>{selected.entropy.toFixed(4)}</strong>
              </div>
              <div>
                <span>划分增益</span>
                <strong>{selected.gain.toFixed(4)}</strong>
              </div>
            </div>
            {selected.reason && (
              <p className="inline-notice">停止分裂原因：{selected.reason}</p>
            )}
            <div className="mini-table-wrap">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>样本</th>
                    <th>年龄</th>
                    <th>收入</th>
                    <th>稳定度</th>
                    <th>逾期</th>
                    <th>DTI</th>
                    <th>结果</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.samples.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.age}</td>
                      <td>{row.income}</td>
                      <td>{row.stability}</td>
                      <td>{row.overdue}</td>
                      <td>{row.dti}</td>
                      <td>{row.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
