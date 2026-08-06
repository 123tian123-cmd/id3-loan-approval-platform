import { Sigma } from 'lucide-react'
import { Section, TeachingTip } from './ui'

function Variable({
  symbol,
  meaning,
}: {
  symbol: string
  meaning: string
}) {
  return (
    <TeachingTip title={symbol}>
      <span>{meaning}</span>
    </TeachingTip>
  )
}

export function FormulaPanel() {
  return (
    <Section
      id="formula"
      icon={<Sigma size={25} />}
      eyebrow="MODULE 01 · 理论基础"
      title="核心公式原理"
      description="从分类不确定性出发，逐层找到最能区分审批结果的特征。"
      className="formula-panel"
    >
      <div className="formula-stack">
        <article className="formula-card">
          <div>
            <span>01</span>
            <strong>数据集熵</strong>
          </div>
          <p className="formula">
            H(D) = -∑<sub>i=1</sub>
            <sup>k</sup> p<sub>i</sub> log<sub>2</sub>(p<sub>i</sub>)
          </p>
          <small>度量审批结果整体的不确定性，熵越大表示样本越混杂。</small>
        </article>
        <article className="formula-card formula-core">
          <div>
            <span>02</span>
            <strong>信息增益</strong>
          </div>
          <p className="formula formula-gain">
            Gain(D, A) = H(D) - ∑<sub>v=1</sub>
            <sup>V</sup> |D<sub>v</sub>| / |D| · H(D<sub>v</sub>)
          </p>
          <small>
            用划分前的熵减去各分支子集熵的加权和；增益越大，特征降低审批不确定性的效果越强。
          </small>
        </article>
      </div>

      <div className="variable-legend">
        <span>
          <b>D</b> 全量信贷样本集
          <Variable symbol="D" meaning="参与当前节点划分的全量信贷样本集合。" />
        </span>
        <span>
          <b>A</b> 待划分特征
          <Variable
            symbol="A"
            meaning="年龄、收入、工作稳定度、信用卡逾期史或 DTI。"
          />
        </span>
        <span>
          <b>
            p<sub>i</sub>
          </b>{' '}
          第 i 类结果占比
          <Variable
            symbol="pᵢ"
            meaning="当前样本集中第 i 类审批结果的样本数占比。"
          />
        </span>
        <span>
          <b>
            D<sub>v</sub>
          </b>{' '}
          特征取值子集
          <Variable symbol="Dᵥ" meaning="特征 A 取第 v 个值时对应的样本子集。" />
        </span>
      </div>

    </Section>
  )
}
