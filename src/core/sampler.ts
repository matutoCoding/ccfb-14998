import type { ChiselId, Polyline, Strike, StrikeSide } from './types'

export interface SampleOpts {
  chisel: ChiselId
  force: number
  side: StrikeSide
  spacingMm: number
  scale: number
  scaleY?: number
  offsetX: number
  offsetY: number
}

// 沿折线按弧长等距排锤, 锤向取切线方向。纯函数, 同样输入必得同样序列
export function sampleLines(lines: Polyline[], o: SampleOpts): Strike[] {
  const sy = o.scaleY ?? o.scale
  const out: Strike[] = []
  for (const ln of lines) {
    const pts = ln.pts
    const n = pts.length / 2
    if (n < 2) continue
    const segs = ln.closed ? n : n - 1
    let carry = 0
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n
      const ax = pts[i * 2] * o.scale + o.offsetX
      const ay = pts[i * 2 + 1] * sy + o.offsetY
      const bx = pts[j * 2] * o.scale + o.offsetX
      const by = pts[j * 2 + 1] * sy + o.offsetY
      const dx = bx - ax
      const dy = by - ay
      const len = Math.hypot(dx, dy)
      if (len < 1e-6) continue
      const ang = Math.atan2(dy, dx)
      let d = carry
      while (d <= len) {
        out.push({
          x: ax + (dx * d) / len,
          y: ay + (dy * d) / len,
          angle: ang,
          force: o.force,
          chisel: o.chisel,
          side: o.side,
        })
        d += o.spacingMm
      }
      carry = d - len
    }
  }
  return out
}

// 在椭圆区域内按三角网格填充锤点(背面推凸用), rng 用于微抖动, 传入固定种子即确定
export function fillEllipse(
  cx: number, cy: number, rx: number, ry: number,
  spacing: number, chisel: ChiselId, force: number, side: StrikeSide,
  rng: () => number,
): Strike[] {
  const out: Strike[] = []
  let row = 0
  for (let y = cy - ry; y <= cy + ry; y += spacing * 0.87, row++) {
    const xoff = row % 2 === 0 ? 0 : spacing / 2
    for (let x = cx - rx + xoff; x <= cx + rx; x += spacing) {
      const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (q > 0.82) continue
      out.push({
        x: x + (rng() - 0.5) * spacing * 0.3,
        y: y + (rng() - 0.5) * spacing * 0.3,
        angle: rng() * Math.PI,
        force,
        chisel,
        side,
      })
    }
  }
  return out
}
