import { CHISELS } from '../core/chisels'
import { HeightField } from '../core/heightfield'
import { renderHillshade } from '../render/hillshade'
import { listWorks } from '../lib/store'
import { el } from '../lib/util'

export async function mount(root: HTMLElement, id: string): Promise<void> {
  const work = (await listWorks()).find((w) => w.id === id)
  if (!work) {
    root.append(el('div', 'empty', '作品不存在'))
    return
  }
  const total = work.strikes.length
  const hfA = new HeightField(work.blank)
  const hfB = new HeightField(work.blank)
  let k = total
  let compare = false
  let playing = false

  const head = el('div', 'page-head')
  const titleBox = el('div')
  titleBox.append(el('h1', 'page-title', `工艺回放 · ${work.name}`))
  titleBox.append(el('div', 'page-sub', `共 ${total} 锤, 拖动进度条逐锤回看; 锤点序列确定, 回放结果与制作时完全一致`))
  const btnBack = el('button', 'btn', '返回列表')
  btnBack.onclick = () => {
    location.hash = '#/works'
  }
  head.append(titleBox, btnBack)

  const controls = el('div', 'card replay-controls')
  const btnPlay = el('button', 'btn small primary', '播放')
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '0'
  slider.max = String(total)
  slider.step = '1'
  slider.value = String(k)
  const info = el('span', '', '')
  const btnCompare = el('button', 'btn small', '前后对比')
  controls.append(btnPlay, slider, btnCompare, info)

  const grid = el('div', 'replay-grid single')
  const cardA = el('div', 'card')
  const titleA = el('h4', '', '当前状态')
  const canvasA = document.createElement('canvas')
  cardA.append(titleA, canvasA)
  const cardB = el('div', 'card')
  const titleB = el('h4', '', '这一锤之后 (绿色为变化区域)')
  const canvasB = document.createElement('canvas')
  cardB.append(titleB, canvasB)
  grid.append(cardA)

  const show = () => {
    slider.value = String(k)
    if (k > 0 && k <= total) {
      const s = work.strikes[k - 1]
      info.textContent = `第 ${k}/${total} 锤 · ${CHISELS[s.chisel].name} · ${s.side === 'back' ? '背面' : '正面'} · 力度 ${s.force.toFixed(2)} · (${s.x.toFixed(1)}, ${s.y.toFixed(1)})mm`
    } else {
      info.textContent = `第 0/${total} 锤 · 素银坯`
    }
    if (compare && k > 0) {
      grid.classList.remove('single')
      if (!cardB.parentElement) grid.append(cardB)
      titleA.textContent = `第 ${k - 1} 锤后 (这一锤之前)`
      hfA.applyAll(work.strikes, k - 1)
      hfB.applyAll(work.strikes, k)
      const changed = new Float32Array(hfA.height.length)
      for (let i = 0; i < changed.length; i++) {
        changed[i] = Math.abs(hfB.height[i] - hfA.height[i])
      }
      renderHillshade(hfA, canvasA)
      const s = work.strikes[k - 1]
      renderHillshade(hfB, canvasB, { changed, dot: { x: s.x, y: s.y } })
    } else {
      grid.classList.add('single')
      cardB.remove()
      titleA.textContent = '当前状态'
      hfA.applyAll(work.strikes, k)
      const dot = k > 0 && k <= total
        ? { x: work.strikes[k - 1].x, y: work.strikes[k - 1].y }
        : null
      renderHillshade(hfA, canvasA, { dot })
    }
  }

  slider.oninput = () => {
    playing = false
    btnPlay.textContent = '播放'
    k = Number(slider.value)
    show()
  }
  btnCompare.onclick = () => {
    compare = !compare
    btnCompare.classList.toggle('on', compare)
    show()
  }
  btnPlay.onclick = () => {
    playing = !playing
    btnPlay.textContent = playing ? '暂停' : '播放'
    if (playing && k >= total) k = 0
  }

  const step = Math.max(1, Math.round(total / 600))
  const tick = () => {
    if (playing) {
      k = Math.min(total, k + step)
      if (k >= total) {
        playing = false
        btnPlay.textContent = '播放'
      }
      show()
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  show()
  root.append(head, controls, grid)
}
