import { exportHeightmap, exportObj } from '../core/exporter'
import { HeightField } from '../core/heightfield'
import { renderHillshade } from '../render/hillshade'
import { buildMesh } from '../render/mesh'
import { SilverRenderer, type OrbitCamera } from '../render/renderer'
import { listWorks, putWork } from '../lib/store'
import { el, nowIso } from '../lib/util'

export async function mount(root: HTMLElement, id: string): Promise<void> {
  const work = (await listWorks()).find((w) => w.id === id)
  if (!work) {
    root.append(el('div', 'empty', '作品不存在'))
    return
  }
  const hf = new HeightField(work.blank)
  hf.applyAll(work.strikes)

  const head = el('div', 'page-head')
  const titleBox = el('div')
  titleBox.append(el('h1', 'page-title', `银面预览 · ${work.name}`))
  titleBox.append(el('div', 'page-sub', '拖动旋转, 滚轮缩放; 做旧后凹处积黑, 凸处亮银'))
  const btnBack = el('button', 'btn', '返回列表')
  btnBack.onclick = () => {
    location.hash = '#/works'
  }
  head.append(titleBox, btnBack)

  const layout = el('div', 'preview-layout')
  const stage = el('div', 'card preview-stage')
  const canvas = document.createElement('canvas')
  canvas.style.height = '560px'
  stage.append(canvas)
  const panel = el('div', 'card toolbar')

  let bendT = work.blank.bendRadiusMm > 0 ? 1 : 0
  let lightAngle = 0.9
  let autoRotate = false
  const cam: OrbitCamera = { theta: 0.7, phi: 1.05, dist: 100, target: [0, 0, 0] }

  const bendRadius = (): number =>
    work.blank.bendRadiusMm > 0 && bendT > 0.02 ? work.blank.bendRadiusMm / bendT : 0

  const renderer = await SilverRenderer.create(canvas)

  const slider = (label: string, min: number, max: number, step: number, val: number, fmt: (v: number) => string, on: (v: number) => void): HTMLElement => {
    const row = el('div', 'slider-row')
    const lbl = el('div', 'lbl')
    const name = el('span', '', label)
    const valSpan = el('span', '', fmt(val))
    lbl.append(name, valSpan)
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.value = String(val)
    input.oninput = () => {
      const v = Number(input.value)
      valSpan.textContent = fmt(v)
      on(v)
    }
    row.append(lbl, input)
    return row
  }

  if (renderer) {
    renderer.patina = work.patina
    const rebuild = () => {
      const mesh = buildMesh(hf, work.blank, bendRadius())
      renderer.setMesh(mesh)
      cam.target = mesh.center
      cam.dist = mesh.radius * 2.1
    }
    rebuild()

    if (work.blank.bendRadiusMm > 0) {
      panel.append(slider('弯曲程度', 0, 1, 0.01, bendT, (v) => `${Math.round(v * 100)}%`, (v) => {
        bendT = v
        rebuild()
      }))
    }
    panel.append(slider('做旧发黑', 0, 1, 0.01, work.patina, (v) => `${Math.round(v * 100)}%`, (v) => {
      work.patina = v
      renderer.patina = v
      work.updatedAt = nowIso()
      void putWork(work)
    }))
    panel.append(slider('光照角度', 0, Math.PI * 2, 0.05, lightAngle, (v) => `${Math.round((v * 180) / Math.PI)}°`, (v) => {
      lightAngle = v
      renderer.lightAngle = v
    }))
    const btnRot = el('button', 'btn small', '自动旋转')
    btnRot.onclick = () => {
      autoRotate = !autoRotate
      btnRot.classList.toggle('on', autoRotate)
    }
    panel.append(btnRot)

    // 轨道相机
    let dragging = false
    let lx = 0
    let ly = 0
    canvas.onpointerdown = (e) => {
      dragging = true
      lx = e.clientX
      ly = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    canvas.onpointermove = (e) => {
      if (!dragging) return
      cam.theta -= (e.clientX - lx) * 0.008
      cam.phi = Math.max(0.15, Math.min(Math.PI - 0.15, cam.phi - (e.clientY - ly) * 0.008))
      lx = e.clientX
      ly = e.clientY
    }
    canvas.onpointerup = () => {
      dragging = false
    }
    canvas.onwheel = (e) => {
      e.preventDefault()
      cam.dist = Math.max(10, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))
    }

    const loop = () => {
      if (autoRotate) cam.theta += 0.006
      renderer.render(cam)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  } else {
    const note = el('div', 'banner warn', '当前浏览器不支持 WebGPU, 已切换为落影图预览 (功能不受影响)')
    stage.append(note)
    const flat = document.createElement('canvas')
    flat.style.cssText = 'width:100%;image-rendering:auto;'
    renderHillshade(hf, flat)
    stage.append(flat)
    canvas.remove()
  }

  const gExport = el('div', 'group')
  gExport.append(el('div', 'label', '导出 (给 3D 打印做蜡模)'))
  const btnH = el('button', 'btn small', '导出高度图 PNG')
  btnH.onclick = () => exportHeightmap(hf, work.name)
  const btnO = el('button', 'btn small', '导出 OBJ 网格')
  btnO.onclick = () => exportObj(hf, work.blank, bendRadius(), work.name)
  gExport.append(btnH, btnO)
  panel.append(gExport)

  const stats = el('div', 'page-sub')
  const range = hf.heightRange()
  stats.textContent = `浮雕高差 ${(range.max - range.min).toFixed(2)} mm · 最薄 ${hf.minThickness().toFixed(2)} mm · ${work.strikes.length} 锤`
  panel.append(stats)

  layout.append(stage, panel)
  root.append(head, layout)
}
