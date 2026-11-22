import { HeightField } from '../core/heightfield'
import { buildWorkOrder, fmtMinutes } from '../core/workorder'
import { CATEGORY_NAMES } from '../core/types'
import { listWorks } from '../lib/store'
import { el, fmtDate } from '../lib/util'

export async function mount(root: HTMLElement, id: string): Promise<void> {
  const work = (await listWorks()).find((w) => w.id === id)
  if (!work) {
    root.append(el('div', 'empty', '作品不存在'))
    return
  }
  const hf = new HeightField(work.blank)
  hf.applyAll(work.strikes)
  const data = buildWorkOrder(work)

  const head = el('div', 'page-head no-print')
  const titleBox = el('div')
  titleBox.append(el('h1', 'page-title', `工单 · ${work.name}`))
  titleBox.append(el('div', 'page-sub', '用料与工时估算, 可直接打印交给匠人'))
  const row = el('div', 'row')
  row.style.display = 'flex'
  row.style.gap = '8px'
  const btnPrint = el('button', 'btn primary', '打印工单')
  btnPrint.onclick = () => window.print()
  const btnBack = el('button', 'btn', '返回列表')
  btnBack.onclick = () => {
    location.hash = '#/works'
  }
  row.append(btnPrint, btnBack)
  head.append(titleBox, row)

  const doc = el('div', 'card sheet-doc')
  doc.append(el('h2', '', `苗银錾刻工单 · ${work.name}`))
  doc.append(el('div', 'sub', `生成于 ${fmtDate(work.updatedAt)} · 锤点序列 ${work.strikes.length} 锤, 回放可完整复现`))

  const table = el('table', 'kv')
  const addRow = (k: string, v: string) => {
    const tr = document.createElement('tr')
    const th = el('th', '', k)
    const td = el('td', '', v)
    tr.append(th, td)
    table.append(tr)
  }
  addRow('类别', CATEGORY_NAMES[work.category])
  addRow('底坯尺寸', `${work.blank.lengthMm} × ${work.blank.widthMm} × ${work.blank.thicknessMm} mm`)
  addRow('弯曲半径', work.blank.bendRadiusMm > 0 ? `${work.blank.bendRadiusMm} mm` : '平片')
  addRow('用银重量', `${data.weightG.toFixed(1)} g (含厚度变化, 体积守恒)`)
  addRow('总锤数', `${data.hammerCount} 锤 (正面 ${data.frontCount} / 背面 ${data.backCount})`)
  addRow('錾子清单', data.chiselRows.map((c) => `${c.name} × ${c.count}`).join(' · ') || '无')
  addRow('最薄处', `${hf.minThickness().toFixed(2)} mm / 原厚 ${work.blank.thicknessMm} mm`)
  if (hf.pierceCount > 0) addRow('风险提示', `局部已敲穿 ${hf.pierceCount} 处, 需减少该区域锤数`)
  addRow('预计工时', fmtMinutes(data.minutes))
  doc.append(table)

  const note = el('div', 'page-sub', '注: 重量按银密度 10.49 g/cm³ 由底坯体积计算; 工时按每锤约 4 秒加 30 分钟备料估算。')
  doc.append(note)

  root.append(head, doc)
}
