import { MOTIFS } from '../core/patterns'
import type { Pattern, Polyline } from '../core/types'
import { deletePattern, listPatterns, putPattern } from '../lib/store'
import { el, nowIso, uid } from '../lib/util'

const BOX = 100
const CS = 560

// 线稿图自动描线: 二值化 + marching squares 提轮廓, 再串成折线
function traceImage(img: HTMLImageElement): Polyline[] {
  const S = 160
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, S, S)
  ctx.drawImage(img, 0, 0, S, S)
  const data = ctx.getImageData(0, 0, S, S).data
  const bin = new Uint8Array(S * S)
  for (let i = 0; i < S * S; i++) {
    const lum = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.6 + data[i * 4 + 2] * 0.1
    bin[i] = lum < 128 ? 1 : 0
  }
  const at = (x: number, y: number): number => bin[y * S + x]
  // 边点用双倍坐标表示: T(2x+1,2y) R(2x+2,2y+1) B(2x+1,2y+2) L(2x,2y+1)
  const T = (x: number, y: number): [number, number] => [2 * x + 1, 2 * y]
  const R = (x: number, y: number): [number, number] => [2 * x + 2, 2 * y + 1]
  const B = (x: number, y: number): [number, number] => [2 * x + 1, 2 * y + 2]
  const L = (x: number, y: number): [number, number] => [2 * x, 2 * y + 1]
  const TABLE: Record<number, string[]> = {
    1: ['LB'], 2: ['BR'], 3: ['LR'], 4: ['TR'], 5: ['TR', 'BL'], 6: ['TB'], 7: ['TL'],
    8: ['TL'], 9: ['TB'], 10: ['TL', 'RB'], 11: ['TR'], 12: ['LR'], 13: ['RB'], 14: ['LB'],
  }
  const EDGE: Record<string, (x: number, y: number) => [number, number]> = { T, R, B, L }
  const segs: number[][] = []
  const adj = new Map<string, number[]>()
  const key = (x: number, y: number): string => `${x},${y}`
  const addSeg = (p: [number, number], q: [number, number]) => {
    const idx = segs.length
    segs.push([p[0], p[1], q[0], q[1]])
    for (const k of [key(p[0], p[1]), key(q[0], q[1])]) {
      const arr = adj.get(k)
      if (arr) arr.push(idx)
      else adj.set(k, [idx])
    }
  }
  for (let y = 0; y < S - 1; y++) {
    for (let x = 0; x < S - 1; x++) {
      const c = at(x, y) * 8 + at(x + 1, y) * 4 + at(x + 1, y + 1) * 2 + at(x, y + 1)
      const pairs = TABLE[c]
      if (!pairs) continue
      for (const pr of pairs) addSeg(EDGE[pr[0]](x, y), EDGE[pr[1]](x, y))
    }
  }
  const used = new Uint8Array(segs.length)
  const lines: Polyline[] = []
  const toXY = (lx: number, ly: number): [number, number] => [
    (lx / 2 / (S - 1)) * BOX,
    BOX - (ly / 2 / (S - 1)) * BOX,
  ]
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue
    used[s] = 1
    const chain: [number, number][] = [
      [segs[s][0], segs[s][1]],
      [segs[s][2], segs[s][3]],
    ]
    let closed = false
    for (;;) {
      const tail = chain[chain.length - 1]
      const next = (adj.get(key(tail[0], tail[1])) ?? []).find((i) => !used[i])
      if (next === undefined) break
      used[next] = 1
      const g = segs[next]
      const pt: [number, number] =
        g[0] === tail[0] && g[1] === tail[1] ? [g[2], g[3]] : [g[0], g[1]]
      if (pt[0] === chain[0][0] && pt[1] === chain[0][1]) {
        closed = true
        break
      }
      chain.push(pt)
    }
    if (chain.length < 4) continue
    const pts: number[] = []
    for (const [lx, ly] of chain) {
      const [px, py] = toXY(lx, ly)
      pts.push(px, py)
    }
    lines.push({ pts, closed })
  }
  return lines
}

export async function mount(root: HTMLElement): Promise<void> {
  const patterns = await listPatterns()
  patterns.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  let cur: Pattern | null = patterns[0] ?? null
  let imgOpacity = 0.35
  let imgEl: HTMLImageElement | null = null

  const head = el('div', 'page-head')
  const titleBox = el('div')
  titleBox.append(el('h1', 'page-title', '纹样稿'))
  titleBox.append(el('div', 'page-sub', '手绘或导入线稿, 花鸟鱼蝶等常用纹样已内置'))
  const btnNew = el('button', 'btn primary', '新建纹样')
  head.append(titleBox, btnNew)

  const layout = el('div', 'pattern-layout')
  const listBox = el('div', 'pattern-list')
  const right = el('div', 'card canvas-wrap')
  const toolbar = el('div', 'row')
  toolbar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;'
  const canvas = document.createElement('canvas')
  canvas.width = CS
  canvas.height = CS
  canvas.style.cssText = 'border:1px solid var(--line);border-radius:6px;touch-action:none;cursor:crosshair;max-width:100%;'
  const hint = el('div', 'page-sub', '在画布上按住拖动即可画线; 导入线稿后可描摹或自动描线')
  right.append(toolbar, canvas, hint)
  layout.append(listBox, right)

  const nameInput = document.createElement('input')
  nameInput.style.cssText = 'padding:6px 10px;border:1px solid var(--line);border-radius:6px;'
  const btnImport = el('button', 'btn small', '导入线稿')
  const btnTrace = el('button', 'btn small', '自动描线')
  const btnUndo = el('button', 'btn small', '撤销一线')
  const btnClear = el('button', 'btn small', '清空')
  const btnDel = el('button', 'btn small danger', '删除')
  const motifSel = document.createElement('select')
  for (const m of MOTIFS) {
    const o = document.createElement('option')
    o.value = m.id
    o.textContent = m.name
    motifSel.append(o)
  }
  const btnMotif = el('button', 'btn small', '插入内置纹样')
  const opacityInput = document.createElement('input')
  opacityInput.type = 'range'
  opacityInput.min = '0'
  opacityInput.max = '1'
  opacityInput.step = '0.05'
  opacityInput.value = String(imgOpacity)
  opacityInput.style.width = '90px'
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'image/*'
  fileInput.style.display = 'none'
  toolbar.append(nameInput, btnImport, btnTrace, opacityInput, motifSel, btnMotif, btnUndo, btnClear, btnDel, fileInput)

  const save = async () => {
    if (cur) await putPattern(cur)
  }

  const draw = () => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CS, CS)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, CS, CS)
    if (imgEl && cur?.image) {
      ctx.globalAlpha = imgOpacity
      ctx.drawImage(imgEl, 0, 0, CS, CS)
      ctx.globalAlpha = 1
    }
    if (!cur) return
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    cur.lines.forEach((ln, li) => {
      ctx.strokeStyle = li === cur!.lines.length - 1 ? '#2f6a5e' : '#3a4354'
      ctx.beginPath()
      for (let i = 0; i < ln.pts.length; i += 2) {
        const x = (ln.pts[i] / BOX) * CS
        const y = CS - (ln.pts[i + 1] / BOX) * CS
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      if (ln.closed) ctx.closePath()
      ctx.stroke()
    })
  }

  const renderList = () => {
    listBox.innerHTML = ''
    for (const p of patterns) {
      const item = el('div', `card pattern-item${cur && p.id === cur.id ? ' on' : ''}`)
      item.append(el('div', 'nm', p.name))
      item.append(el('div', 'meta', `${p.lines.length} 条线`))
      item.onclick = () => {
        cur = p
        syncPanel()
        renderList()
        draw()
      }
      listBox.append(item)
    }
  }

  const syncPanel = () => {
    nameInput.value = cur ? cur.name : ''
    imgEl = null
    if (cur?.image) {
      const im = new Image()
      im.onload = () => {
        imgEl = im
        draw()
      }
      im.src = cur.image
    }
  }

  nameInput.oninput = () => {
    if (!cur) return
    cur.name = nameInput.value
    save()
    renderList()
  }
  btnImport.onclick = () => fileInput.click()
  fileInput.onchange = () => {
    const f = fileInput.files?.[0]
    if (!f || !cur) return
    const rd = new FileReader()
    rd.onload = () => {
      cur!.image = String(rd.result)
      save()
      syncPanel()
    }
    rd.readAsDataURL(f)
    fileInput.value = ''
  }
  btnTrace.onclick = () => {
    if (!cur || !imgEl) return
    cur.lines = cur.lines.concat(traceImage(imgEl))
    save()
    renderList()
    draw()
  }
  opacityInput.oninput = () => {
    imgOpacity = Number(opacityInput.value)
    draw()
  }
  btnMotif.onclick = () => {
    if (!cur) return
    const m = MOTIFS.find((v) => v.id === motifSel.value)
    if (!m) return
    cur.lines = cur.lines.concat(m.gen())
    save()
    renderList()
    draw()
  }
  btnUndo.onclick = () => {
    if (!cur || cur.lines.length === 0) return
    cur.lines.pop()
    save()
    renderList()
    draw()
  }
  btnClear.onclick = () => {
    if (!cur || !confirm('清空当前纹样的所有线条?')) return
    cur.lines = []
    save()
    renderList()
    draw()
  }
  btnDel.onclick = async () => {
    if (!cur || !confirm(`删除纹样「${cur.name}」?`)) return
    await deletePattern(cur.id)
    patterns.splice(patterns.indexOf(cur), 1)
    cur = patterns[0] ?? null
    syncPanel()
    renderList()
    draw()
  }
  btnNew.onclick = async () => {
    const p: Pattern = { id: uid(), name: `纹样 ${patterns.length + 1}`, lines: [], image: null, createdAt: nowIso() }
    await putPattern(p)
    patterns.push(p)
    cur = p
    syncPanel()
    renderList()
    draw()
  }

  // 手绘
  let drawing: Polyline | null = null
  const toBox = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * BOX
    const y = BOX - ((e.clientY - r.top) / r.height) * BOX
    return [Math.max(0, Math.min(BOX, x)), Math.max(0, Math.min(BOX, y))]
  }
  canvas.onpointerdown = (e) => {
    if (!cur) return
    canvas.setPointerCapture(e.pointerId)
    const [x, y] = toBox(e)
    drawing = { pts: [x, y], closed: false }
    cur.lines.push(drawing)
  }
  canvas.onpointermove = (e) => {
    if (!drawing || !cur) return
    const [x, y] = toBox(e)
    const n = drawing.pts.length
    if (Math.hypot(x - drawing.pts[n - 2], y - drawing.pts[n - 1]) < 0.8) return
    drawing.pts.push(x, y)
    draw()
  }
  canvas.onpointerup = () => {
    if (!drawing || !cur) return
    if (drawing.pts.length < 4) cur.lines.pop()
    drawing = null
    save()
    renderList()
    draw()
  }

  syncPanel()
  renderList()
  draw()
  root.append(head, layout)
}
