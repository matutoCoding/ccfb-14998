import type { HeightField } from './heightfield'
import type { BlankSpec } from './types'
import { buildMesh } from '../render/mesh'

function downloadBlob(name: string, blob: Blob): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// 高度图 PNG: 灰度归一化, 供 3D 打印/蜡模流程使用
export function exportHeightmap(hf: HeightField, name: string): void {
  const { nx, ny, height } = hf
  const { min, max } = hf.heightRange()
  const span = Math.max(1e-6, max - min)
  const canvas = document.createElement('canvas')
  canvas.width = nx
  canvas.height = ny
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = ctx.createImageData(nx, ny)
  for (let i = 0; i < height.length; i++) {
    const g = Math.round(((height[i] - min) / span) * 255)
    img.data[i * 4] = g
    img.data[i * 4 + 1] = g
    img.data[i * 4 + 2] = g
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  canvas.toBlob((b) => {
    if (b) downloadBlob(`${name}_heightmap.png`, b)
  })
}

// OBJ 网格(含法线), bendRadius 与预览一致, 可直接切片做蜡模
export function exportObj(hf: HeightField, blank: BlankSpec, bendRadius: number, name: string): void {
  const m = buildMesh(hf, blank, bendRadius)
  const lines: string[] = [`# miao silver export, unit=mm, vertices=${m.positions.length / 3}`]
  for (let i = 0; i < m.positions.length; i += 3) {
    lines.push(`v ${m.positions[i].toFixed(4)} ${m.positions[i + 1].toFixed(4)} ${m.positions[i + 2].toFixed(4)}`)
  }
  for (let i = 0; i < m.normals.length; i += 3) {
    lines.push(`vn ${m.normals[i].toFixed(4)} ${m.normals[i + 1].toFixed(4)} ${m.normals[i + 2].toFixed(4)}`)
  }
  for (let i = 0; i < m.indices.length; i += 3) {
    const a = m.indices[i] + 1
    const b = m.indices[i + 1] + 1
    const c = m.indices[i + 2] + 1
    lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`)
  }
  downloadBlob(`${name}.obj`, new Blob([lines.join('\n')], { type: 'text/plain' }))
}
