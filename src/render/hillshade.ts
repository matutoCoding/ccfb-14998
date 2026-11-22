import type { HeightField } from '../core/heightfield'

export interface HillshadeOpts {
  heat?: boolean
  dot?: { x: number; y: number } | null
  changed?: Float32Array | null
}

// 2D 落影图: 无 WebGPU 环境的兜底, 也用于回放对比
export function renderHillshade(hf: HeightField, canvas: HTMLCanvasElement, opts: HillshadeOpts = {}): void {
  const { nx, ny, cell, height, thin, thickness0 } = hf
  canvas.width = nx
  canvas.height = ny
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = ctx.createImageData(nx, ny)
  const lx = -0.5
  const ly = 0.7
  const lz = 0.5
  const ll = Math.hypot(lx, ly, lz)
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iy * nx + ix
      const hxl = height[iy * nx + Math.max(0, ix - 1)]
      const hxr = height[iy * nx + Math.min(nx - 1, ix + 1)]
      const hyl = height[Math.max(0, iy - 1) * nx + ix]
      const hyr = height[Math.min(ny - 1, iy + 1) * nx + ix]
      let nvx = -(hxr - hxl) / (2 * cell)
      let nvy = -(hyr - hyl) / (2 * cell)
      let nvz = 1
      const nl = Math.hypot(nvx, nvy, nvz)
      nvx /= nl
      nvy /= nl
      nvz /= nl
      const diff = Math.max(0, (nvx * lx + nvy * ly + nvz * lz) / ll)
      let r = 150 + diff * 100
      let g = 152 + diff * 100
      let b = 158 + diff * 96
      if (opts.heat) {
        const remain = (thickness0 + thin[i]) / thickness0
        if (remain < 0.55) {
          const t = Math.min(1, (0.55 - remain) / 0.4)
          r = r + (200 - r) * t
          g = g * (1 - t * 0.6)
          b = b * (1 - t * 0.6)
        }
      }
      if (opts.changed && opts.changed[i] > 0.0001) {
        r = 70
        g = 150
        b = 130
      }
      const p = i * 4
      img.data[p] = r
      img.data[p + 1] = g
      img.data[p + 2] = b
      img.data[p + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  if (opts.dot) {
    ctx.fillStyle = '#b44040'
    ctx.beginPath()
    ctx.arc(opts.dot.x / cell, opts.dot.y / cell, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
}
