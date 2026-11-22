import { CHISELS } from './chisels'
import type { BlankSpec, ChiselId, Strike } from './types'

// 剩余厚度低于此值视为敲穿
const MIN_THICKNESS = 0.05

// 錾痕截面轮廓, q ∈ [0,1) 为归一化距离
function profile(id: ChiselId, q: number): number {
  switch (id) {
    case 'round': return 0.5 + 0.5 * Math.cos(Math.PI * q)
    case 'flat':
      return q < 0.55 ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (q - 0.55)) / 0.45)
    case 'line': {
      const t = 1 - q
      return t * t
    }
    case 'bead': {
      const t = 1 - q * q
      return t * t
    }
  }
}

// 高度场 + 厚度场。变形全程纯定点顺序浮点运算, 同一锤点序列结果完全一致
export class HeightField {
  readonly nx: number
  readonly ny: number
  readonly cell: number
  readonly thickness0: number
  readonly height: Float32Array
  readonly thin: Float32Array
  pierceCount = 0
  private idxBuf = new Int32Array(65536)
  private wBuf = new Float32Array(65536)

  constructor(blank: BlankSpec) {
    this.cell = blank.gridMm
    this.nx = Math.max(2, Math.round(blank.lengthMm / this.cell) + 1)
    this.ny = Math.max(2, Math.round(blank.widthMm / this.cell) + 1)
    this.thickness0 = blank.thicknessMm
    this.height = new Float32Array(this.nx * this.ny)
    this.thin = new Float32Array(this.nx * this.ny)
  }

  reset(): void {
    this.height.fill(0)
    this.thin.fill(0)
    this.pierceCount = 0
  }

  applyStrike(s: Strike): void {
    const ch = CHISELS[s.chisel]
    const sign = s.side === 'back' ? 1 : -1
    const depth = ch.maxDepth * s.force
    const cosA = Math.cos(s.angle)
    const sinA = Math.sin(s.angle)
    const area = this.cell * this.cell
    const rb = ch.radius * ch.elongation

    // 第一遍: 表面位移, 累计排开体积 vol
    let vol = 0
    const x0 = Math.max(0, Math.floor((s.x - rb) / this.cell))
    const x1 = Math.min(this.nx - 1, Math.ceil((s.x + rb) / this.cell))
    const y0 = Math.max(0, Math.floor((s.y - rb) / this.cell))
    const y1 = Math.min(this.ny - 1, Math.ceil((s.y + rb) / this.cell))
    for (let iy = y0; iy <= y1; iy++) {
      const dy = iy * this.cell - s.y
      for (let ix = x0; ix <= x1; ix++) {
        const dx = ix * this.cell - s.x
        const u = dx * cosA + dy * sinA
        const v = -dx * sinA + dy * cosA
        const q = Math.hypot(u / ch.elongation, v) / ch.radius
        if (q >= 1) continue
        const dh = sign * depth * profile(s.chisel, q)
        this.height[iy * this.nx + ix] += dh
        vol += dh * area
      }
    }

    // 第二遍: 金属被拉伸变薄, 变薄总量 = -vol, 体积严格守恒
    const rt = rb * 1.6
    const tx0 = Math.max(0, Math.floor((s.x - rt) / this.cell))
    const tx1 = Math.min(this.nx - 1, Math.ceil((s.x + rt) / this.cell))
    const ty0 = Math.max(0, Math.floor((s.y - rt) / this.cell))
    const ty1 = Math.min(this.ny - 1, Math.ceil((s.y + rt) / this.cell))
    let n = 0
    let wSum = 0
    for (let iy = ty0; iy <= ty1; iy++) {
      const dy = iy * this.cell - s.y
      for (let ix = tx0; ix <= tx1; ix++) {
        const dx = ix * this.cell - s.x
        const d2 = dx * dx + dy * dy
        if (d2 >= rt * rt) continue
        const w = 1 - d2 / (rt * rt)
        this.idxBuf[n] = iy * this.nx + ix
        this.wBuf[n] = w
        n++
        wSum += w
      }
    }
    if (wSum <= 0) return
    const k = vol / (wSum * area)
    for (let m = 0; m < n; m++) {
      const i = this.idxBuf[m]
      this.thin[i] -= k * this.wBuf[m]
      if (this.thickness0 + this.thin[i] < MIN_THICKNESS) {
        this.thin[i] = MIN_THICKNESS - this.thickness0
        this.pierceCount++
      }
    }
  }

  applyAll(strikes: Strike[], count?: number): void {
    this.reset()
    const n = Math.min(count ?? strikes.length, strikes.length)
    for (let i = 0; i < n; i++) this.applyStrike(strikes[i])
  }

  minThickness(): number {
    let m = 0
    for (let i = 0; i < this.thin.length; i++) if (this.thin[i] < m) m = this.thin[i]
    return this.thickness0 + m
  }

  // 体积守恒校验: Σ(高度位移 + 厚度变化) × 单元面积, 应接近 0
  volumeBalance(): number {
    let s = 0
    for (let i = 0; i < this.height.length; i++) s += this.height[i] + this.thin[i]
    return s * this.cell * this.cell
  }

  heightRange(): { min: number; max: number } {
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < this.height.length; i++) {
      const h = this.height[i]
      if (h < lo) lo = h
      if (h > hi) hi = h
    }
    return { min: lo, max: hi }
  }
}
