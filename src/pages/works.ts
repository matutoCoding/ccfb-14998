import { CATEGORY_NAMES, type BlankSpec, type Category, type Work } from '../core/types'
import { deleteWork, listWorks, putWork } from '../lib/store'
import { el, fmtDate, nowIso, uid } from '../lib/util'

const BLANK_DEFAULTS: Record<Category, BlankSpec> = {
  crown: { lengthMm: 220, widthMm: 70, thicknessMm: 0.9, gridMm: 0.4, bendRadiusMm: 95 },
  collar: { lengthMm: 180, widthMm: 40, thicknessMm: 1.0, gridMm: 0.4, bendRadiusMm: 70 },
  bracelet: { lengthMm: 150, widthMm: 22, thicknessMm: 1.0, gridMm: 0.3, bendRadiusMm: 26 },
  sheet: { lengthMm: 100, widthMm: 80, thicknessMm: 0.8, gridMm: 0.35, bendRadiusMm: 0 },
}

const CATS = Object.keys(CATEGORY_NAMES) as Category[]

export async function mount(root: HTMLElement): Promise<void> {
  let filter: Category | 'all' = 'all'
  const works = await listWorks()
  works.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const head = el('div', 'page-head')
  const titleBox = el('div')
  titleBox.append(el('h1', 'page-title', '作品列表'))
  titleBox.append(el('div', 'page-sub', '银冠 / 项圈 / 手镯 / 银片, 设计稿全部保存在本机浏览器'))
  const btnNew = el('button', 'btn primary', '新建作品')
  head.append(titleBox, btnNew)

  const tabs = el('div', 'tabs')
  const grid = el('div', 'grid-cards')

  const renderGrid = () => {
    grid.innerHTML = ''
    const shown = works.filter((w) => filter === 'all' || w.category === filter)
    if (shown.length === 0) {
      grid.append(el('div', 'empty', '这一类还没有作品, 点右上角新建一个'))
      return
    }
    for (const w of shown) grid.append(workCard(w))
  }

  const renderTabs = () => {
    tabs.innerHTML = ''
    const mk = (id: Category | 'all', name: string) => {
      const b = el('button', `btn small${filter === id ? ' on' : ''}`, name)
      b.onclick = () => {
        filter = id
        renderTabs()
        renderGrid()
      }
      tabs.append(b)
    }
    mk('all', '全部')
    for (const c of CATS) mk(c, CATEGORY_NAMES[c])
  }

  const workCard = (w: Work): HTMLElement => {
    const card = el('div', 'card work-card')
    card.append(el('h3', '', w.name))
    const meta = el('div', 'meta')
    meta.append(el('span', 'tag', CATEGORY_NAMES[w.category]))
    meta.append(el('span', '', ` 底坯 ${w.blank.lengthMm}×${w.blank.widthMm}×${w.blank.thicknessMm}mm`))
    card.append(meta)
    card.append(el('div', 'meta', `${w.strikes.length} 锤 · 更新于 ${fmtDate(w.updatedAt)}`))
    const row = el('div', 'row')
    const go = (label: string, hash: string, primary = false) => {
      const b = el('button', `btn small${primary ? ' primary' : ''}`, label)
      b.onclick = () => {
        location.hash = hash
      }
      row.append(b)
    }
    go('錾刻', `#/edit/${w.id}`, true)
    go('预览', `#/preview/${w.id}`)
    go('回放', `#/replay/${w.id}`)
    go('工单', `#/order/${w.id}`)
    const dup = el('button', 'btn small', '复制')
    dup.onclick = async () => {
      const copy: Work = structuredClone(w)
      copy.id = uid()
      copy.name = `${w.name} 副本`
      copy.createdAt = nowIso()
      copy.updatedAt = nowIso()
      await putWork(copy)
      works.unshift(copy)
      renderGrid()
    }
    const del = el('button', 'btn small danger', '删除')
    del.onclick = async () => {
      if (!confirm(`确定删除「${w.name}」? 锤点记录将一并清除`)) return
      await deleteWork(w.id)
      works.splice(works.indexOf(w), 1)
      renderGrid()
    }
    row.append(dup, del)
    card.append(row)
    return card
  }

  btnNew.onclick = () => openNewWorkModal(works, renderGrid)

  renderTabs()
  renderGrid()
  root.append(head, tabs, grid)
}

function openNewWorkModal(works: Work[], onDone: () => void): void {
  const mask = el('div', 'modal-mask')
  const modal = el('div', 'card modal')
  modal.append(el('h2', '', '新建作品'))

  const nameInput = document.createElement('input')
  nameInput.value = '未命名作品'
  const catSel = document.createElement('select')
  for (const c of CATS) {
    const o = document.createElement('option')
    o.value = c
    o.textContent = CATEGORY_NAMES[c]
    catSel.append(o)
  }

  const nums: Record<keyof BlankSpec, HTMLInputElement> = {
    lengthMm: document.createElement('input'),
    widthMm: document.createElement('input'),
    thicknessMm: document.createElement('input'),
    gridMm: document.createElement('input'),
    bendRadiusMm: document.createElement('input'),
  }
  for (const k of Object.keys(nums) as (keyof BlankSpec)[]) {
    nums[k].type = 'number'
    nums[k].step = '0.05'
    nums[k].min = '0'
  }
  const fillDefaults = () => {
    const d = BLANK_DEFAULTS[catSel.value as Category]
    for (const k of Object.keys(nums) as (keyof BlankSpec)[]) nums[k].value = String(d[k])
  }
  catSel.onchange = fillDefaults
  fillDefaults()

  const field = (label: string, input: HTMLElement): HTMLElement => {
    const f = el('div', 'field')
    f.append(el('label', '', label), input)
    return f
  }
  modal.append(field('名称', nameInput))
  modal.append(field('类别', catSel))
  const row1 = el('div', 'form-row')
  row1.append(field('长度 mm', nums.lengthMm), field('宽度 mm', nums.widthMm))
  const row2 = el('div', 'form-row')
  row2.append(field('厚度 mm', nums.thicknessMm), field('网格精度 mm', nums.gridMm))
  modal.append(row1, row2)
  modal.append(field('弯曲半径 mm (0 = 平片)', nums.bendRadiusMm))

  const actions = el('div', 'actions')
  const cancel = el('button', 'btn', '取消')
  cancel.onclick = () => mask.remove()
  const ok = el('button', 'btn primary', '创建')
  ok.onclick = async () => {
    const blank: BlankSpec = {
      lengthMm: Number(nums.lengthMm.value),
      widthMm: Number(nums.widthMm.value),
      thicknessMm: Number(nums.thicknessMm.value),
      gridMm: Number(nums.gridMm.value),
      bendRadiusMm: Number(nums.bendRadiusMm.value),
    }
    const w: Work = {
      id: uid(),
      name: nameInput.value.trim() || '未命名作品',
      category: catSel.value as Category,
      blank,
      patternId: null,
      layout: { scale: 0.6, scaleY: 0.6, x: 10, y: 10 },
      strikes: [],
      patina: 0.5,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await putWork(w)
    works.unshift(w)
    mask.remove()
    onDone()
    location.hash = `#/edit/${w.id}`
  }
  actions.append(cancel, ok)
  modal.append(actions)
  mask.append(modal)
  mask.onclick = (e) => {
    if (e.target === mask) mask.remove()
  }
  document.body.append(mask)
}
