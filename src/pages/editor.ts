import { CHISEL_LIST, CHISELS } from '../core/chisels'
import { HeightField } from '../core/heightfield'
import { sampleLines } from '../core/sampler'
import type { ChiselId, Pattern, Strike, StrikeSide, Work } from '../core/types'
import { listPatterns, listWorks, putWork } from '../lib/store'
import { el, nowIso } from '../lib/util'

const CHISEL_COLORS: Record<ChiselId, string> = {
  round: '#4a5568',
  flat: '#8a93a1',
  line: '#1c2330',
  bead: '#2f6a5e',
}

export async function mount(root: HTMLElement, id: string): Promise<void> {
  const work = (await listWorks()).find((w) => w.id === id)
  if (!work) {
    root.append(el('div', 'empty', '作品不存在'))
    return
  }
  const patterns = await listPatterns()
  const hf = new HeightField(work.blank)

  let chisel: ChiselId = 'line'
  let side: StrikeSide = 'front'
  let force = 0.7
  let angleDeg = 0
  let mode: 'single' | 'line' = 'single'
  let showHeat = true
  let saveTimer = 0

  const head = el('div', 'page-head')
  const titleBox = el('div')
  titleBox.append(el('h1', 'page-title', `錾刻 · ${work.name}`))
  titleBox.append(el('div', 'page-sub', '选錾子, 定力度, 在银片上落锤; 背面锤向外推凸, 正面锤压细节'))
  const btnBack = el('button', 'btn', '返回列表')
  btnBack.onclick = () => {
    location.hash = '#/works'
  }
  head.append(titleBox, btnBack)

  const banner = el('div', 'banner warn')
  banner.style.display = 'none'

  const layout = el('div', 'editor-layout')
  const toolbar = el('div', 'card toolbar')
  const canvasWrap = el('div', 'card canvas-wrap')
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'cursor:crosshair;touch-action:none;'
  canvasWrap.append(canvas)
  const status = el('div', 'card statusbar')
  layout.append(toolbar, canvasWrap)

  // 画布尺寸: 1mm = ppm px
  const ppm = Math.min(8, 900 / work.blank.lengthMm)
  canvas.width = Math.round(work.blank.lengthMm * ppm)
  canvas.height = Math.round(work.blank.widthMm * ppm)
  const heatCanvas = document.createElement('canvas')

  const group = (label: string): HTMLElement => {
    const g = el('div', 'group')
    g.append(el('div', 'label', label))
    return g
  }

  // 錾子选择
  const gChisel = group('錾子')
  const chiselBtns = new Map<ChiselId, HTMLElement>()
  for (const c of CHISEL_LIST) {
    const b = el('button', 'btn small', `${c.name}`)
    b.title = c.desc
    b.onclick = () => {
      chisel = c.id
      syncChisel()
    }
    chiselBtns.set(c.id, b)
    gChisel.append(b)
  }
  const syncChisel = () => {
    for (const [id, b] of chiselBtns) b.classList.toggle('on', id === chisel)
  }
  syncChisel()

  // 正反面
  const gSide = group('落锤面')
  const btnFront = el('button', 'btn small', '正面 (压细节)')
  const btnBack = el('button', 'btn small', '背面 (推凸)')
  const syncSide = () => {
    btnFront.classList.toggle('on', side === 'front')
    btnBack.classList.toggle('on', side === 'back')
  }
  btnFront.onclick = () => {
    side = 'front'
    syncSide()
  }
  btnBack.onclick = () => {
    side = 'back'
    syncSide()
  }
  syncSide()
  gSide.append(btnFront, btnBack)

  // 力度 / 角度
  const gForce = group('力度')
  const forceInput = document.createElement('input')
  forceInput.type = 'range'
  forceInput.min = '0.1'
  forceInput.max = '1'
  forceInput.step = '0.05'
  forceInput.value = String(force)
  const forceLbl = el('div', 'page-sub', `力度 ${force.toFixed(2)}`)
  forceInput.oninput = () => {
    force = Number(forceInput.value)
    forceLbl.textContent = `力度 ${force.toFixed(2)}`
  }
  gForce.append(forceInput, forceLbl)

  const gAngle = group('錾向 (单锤)')
  const angleInput = document.createElement('input')
  angleInput.type = 'range'
  angleInput.min = '0'
  angleInput.max = '180'
  angleInput.step = '5'
  angleInput.value = '0'
  const angleLbl = el('div', 'page-sub', '角度 0°')
  angleInput.oninput = () => {
    angleDeg = Number(angleInput.value)
    angleLbl.textContent = `角度 ${angleDeg}°`
  }
  gAngle.append(angleInput, angleLbl)

  // 模式
  const gMode = group('落锤方式')
  const btnSingle = el('button', 'btn small', '单锤')
  const btnLine = el('button', 'btn small', '沿线 (拖出一条线)')
  const syncMode = () => {
    btnSingle.classList.toggle('on', mode === 'single')
    btnLine.classList.toggle('on', mode === 'line')
  }
  btnSingle.onclick = () => {
    mode = 'single'
    syncMode()
  }
  btnLine.onclick = () => {
    mode = 'line'
    syncMode()
  }
  syncMode()
  gMode.append(btnSingle, btnLine)

  // 纹样
  const gPat = group('纹样')
  const patSel = document.createElement('select')
  {
    const o = document.createElement('option')
    o.value = ''
    o.textContent = '(无纹样)'
    patSel.append(o)
    for (const p of patterns) {
      const o = document.createElement('option')
      o.value = p.id
      o.textContent = p.name
      patSel.append(o)
    }
    patSel.value = work.patternId ?? ''
  }
  patSel.onchange = () => {
    work.patternId = patSel.value === '' ? null : patSel.value
    save()
    draw()
  }
  const btnGen = el('button', 'btn small primary', '沿纹样排锤')
  btnGen.onclick = () => {
    const p = patterns.find((v) => v.id === work.patternId)
    if (!p) return
    const strikes = sampleLines(p.lines, {
      chisel,
      force,
      side,
      spacingMm: CHISELS[chisel].radius * 1.2,
      scale: work.layout.scale,
      scaleY: work.layout.scaleY,
      offsetX: work.layout.x,
      offsetY: work.layout.y,
    })
    work.strikes.push(...strikes)
    afterChange()
  }
  gPat.append(patSel, btnGen)

  // 视图与编辑
  const gEdit = group('视图 / 编辑')
  const btnHeat = el('button', 'btn small on', '厚度热力图')
  btnHeat.onclick = () => {
    showHeat = !showHeat
    btnHeat.classList.toggle('on', showHeat)
    draw()
  }
  const btnUndo = el('button', 'btn small', '撤销一锤')
  btnUndo.onclick = () => {
    work.strikes.pop()
    afterChange()
  }
  const btnClear = el('button', 'btn small danger', '清空全部锤点')
  btnClear.onclick = () => {
    if (!confirm('清空所有锤点? 此操作不可撤销')) return
    work.strikes = []
    afterChange()
  }
  gEdit.append(btnHeat, btnUndo, btnClear)

  toolbar.append(gChisel, gSide, gForce, gAngle, gMode, gPat, gEdit)

  const save = () => {
    work.updatedAt = nowIso()
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => void putWork(work), 400)
  }

  const updateStatus = () => {
    const minT = hf.minThickness()
    const ratio = minT / hf.thickness0
    const tCls = ratio < 0.2 ? 'danger' : ratio < 0.35 ? 'warn' : ''
    status.innerHTML = ''
    status.append(el('span', '', `锤数 `))
    status.append(el('b', '', String(work.strikes.length)))
    status.append(el('span', '', `最薄处 `))
    const t = el('b', tCls, `${minT.toFixed(2)} mm`)
    status.append(t)
    status.append(el('span', '', `/ 原厚 ${hf.thickness0} mm`))
    status.append(el('span', '', `体积守恒误差 ${(hf.volumeBalance() / 1000).toFixed(4)} cm³`))
    if (hf.pierceCount > 0) status.append(el('span', 'danger', `已敲穿 ${hf.pierceCount} 处`))
    if (ratio < 0.35) {
      banner.style.display = ''
      banner.className = `banner ${ratio < 0.2 ? 'danger' : 'warn'}`
      banner.textContent = ratio < 0.2
        ? `局部厚度仅剩 ${minT.toFixed(2)} mm, 再敲就要破了, 请避开这一片`
        : `局部厚度 ${minT.toFixed(2)} mm, 接近极限, 注意收手`
    } else {
      banner.style.display = 'none'
    }
  }

  const recompute = () => {
    hf.applyAll(work.strikes)
    updateStatus()
  }

  const afterChange = () => {
    recompute()
    draw()
    save()
  }

  const drawHeat = () => {
    heatCanvas.width = hf.nx
    heatCanvas.height = hf.ny
    const hctx = heatCanvas.getContext('2d')
    if (!hctx) return
    const img = hctx.createImageData(hf.nx, hf.ny)
    for (let i = 0; i < hf.thin.length; i++) {
      const remain = (hf.thickness0 + hf.thin[i]) / hf.thickness0
      const t = Math.max(0, Math.min(1, (remain - 0.15) / 0.85))
      img.data[i * 4] = Math.round(220 - 140 * (1 - t))
      img.data[i * 4 + 1] = Math.round(225 * t + 60)
      img.data[i * 4 + 2] = Math.round(220 * t + 60)
      img.data[i * 4 + 3] = 255
    }
    hctx.putImageData(img, 0, 0)
  }

  const draw = (previewTo?: { x: number; y: number }) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fdfdfd'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (showHeat) {
      drawHeat()
      ctx.imageSmoothingEnabled = true
      ctx.globalAlpha = 0.55
      ctx.drawImage(heatCanvas, 0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1
    }
    // 边框
    ctx.strokeStyle = '#8a93a1'
    ctx.lineWidth = 1.5
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)
    // 纹样底稿
    const pat = patterns.find((v) => v.id === work.patternId)
    if (pat) {
      ctx.strokeStyle = 'rgba(47,106,94,.45)'
      ctx.lineWidth = 1.2
      for (const ln of pat.lines) {
        ctx.beginPath()
        for (let i = 0; i < ln.pts.length; i += 2) {
          const x = (ln.pts[i] * work.layout.scale + work.layout.x) * ppm
          const y = canvas.height - (ln.pts[i + 1] * work.layout.scaleY + work.layout.y) * ppm
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        if (ln.closed) ctx.closePath()
        ctx.stroke()
      }
    }
    // 锤点
    for (let i = 0; i < work.strikes.length; i++) {
      const s = work.strikes[i]
      const x = s.x * ppm
      const y = canvas.height - s.y * ppm
      ctx.strokeStyle = CHISEL_COLORS[s.chisel]
      ctx.fillStyle = CHISEL_COLORS[s.chisel]
      ctx.lineWidth = i === work.strikes.length - 1 ? 2 : 1
      if (s.side === 'back') {
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        const dx = Math.cos(s.angle) * 3
        const dy = Math.sin(s.angle) * 3
        ctx.beginPath()
        ctx.moveTo(x - dx, y + dy)
        ctx.lineTo(x + dx, y - dy)
        ctx.stroke()
      }
    }
    // 沿线预览
    if (previewTo && dragFrom) {
      ctx.strokeStyle = '#2f6a5e'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(dragFrom.x * ppm, canvas.height - dragFrom.y * ppm)
      ctx.lineTo(previewTo.x * ppm, canvas.height - previewTo.y * ppm)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  const toMm = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * work.blank.lengthMm,
      y: work.blank.widthMm - ((e.clientY - r.top) / r.height) * work.blank.widthMm,
    }
  }

  let dragFrom: { x: number; y: number } | null = null
  canvas.onpointerdown = (e) => {
    const p = toMm(e)
    if (mode === 'single') {
      work.strikes.push({
        x: p.x, y: p.y,
        angle: (angleDeg * Math.PI) / 180,
        force, chisel, side,
      })
      afterChange()
    } else {
      canvas.setPointerCapture(e.pointerId)
      dragFrom = p
    }
  }
  canvas.onpointermove = (e) => {
    if (dragFrom) draw(toMm(e))
  }
  canvas.onpointerup = (e) => {
    if (!dragFrom) return
    const to = toMm(e)
    const dx = to.x - dragFrom.x
    const dy = to.y - dragFrom.y
    const len = Math.hypot(dx, dy)
    if (len > 0.5) {
      const spacing = CHISELS[chisel].radius * 1.2
      const ang = Math.atan2(dy, dx)
      for (let d = 0; d <= len; d += spacing) {
        work.strikes.push({
          x: dragFrom.x + (dx * d) / len,
          y: dragFrom.y + (dy * d) / len,
          angle: ang, force, chisel, side,
        })
      }
      afterChange()
    }
    dragFrom = null
    draw()
  }

  recompute()
  draw()
  root.append(head, banner, layout, status)
}
