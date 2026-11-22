import type { Polyline } from './types'

// 所有内置纹样定义在 0..100 的坐标盒里, 用时再缩放到银片尺寸

const pl = (pts: number[], closed = false): Polyline => ({ pts, closed })

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 24): number[] {
  const p: number[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    p.push(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  return p
}

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 32): number[] {
  const p: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n
    p.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a))
  }
  return p
}

function bez(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, n = 20,
): number[] {
  const p: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    p.push(
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    )
  }
  return p
}

const mirrorX = (pts: number[]): number[] => {
  const p: number[] = []
  for (let i = 0; i < pts.length; i += 2) p.push(100 - pts[i], pts[i + 1])
  return p
}

export function motifButterfly(): Polyline[] {
  const upperL = [
    ...bez(48, 58, 30, 76, 10, 70, 12, 52),
    ...bez(12, 52, 14, 40, 34, 40, 48, 50).slice(2),
  ]
  const lowerL = [
    ...bez(48, 46, 32, 42, 24, 34, 28, 26),
    ...bez(28, 26, 34, 20, 44, 32, 48, 40).slice(2),
  ]
  return [
    pl(upperL, true),
    pl(mirrorX(upperL), true),
    pl(lowerL, true),
    pl(mirrorX(lowerL), true),
    pl([50, 34, 50, 66]),
    pl(ellipse(50, 69, 3.5, 3.5, 16), true),
    pl(bez(48, 71, 42, 78, 38, 82, 36, 86, 10)),
    pl(bez(52, 71, 58, 78, 62, 82, 64, 86, 10)),
    pl(bez(46, 56, 34, 62, 24, 60, 18, 54, 12)),
    pl(bez(54, 56, 66, 62, 76, 60, 82, 54, 12)),
    pl(bez(46, 44, 38, 38, 34, 34, 32, 30, 10)),
    pl(bez(54, 44, 62, 38, 66, 34, 68, 30, 10)),
  ]
}

export function motifBird(): Polyline[] {
  return [
    pl(ellipse(46, 46, 20, 13, 32), true),
    pl(ellipse(66, 62, 9, 9, 20), true),
    pl([74, 63, 84, 59, 74, 58], true),
    pl(ellipse(68, 64, 1.6, 1.6, 10), true),
    pl(bez(36, 50, 44, 56, 54, 54, 58, 46, 14)),
    pl(bez(36, 50, 42, 44, 50, 42, 56, 40, 12)),
    pl(bez(28, 50, 18, 56, 10, 62, 4, 66, 12)),
    pl(bez(27, 46, 16, 48, 8, 50, 2, 50, 12)),
    pl(bez(28, 42, 18, 40, 10, 36, 4, 32, 12)),
    pl([44, 34, 42, 22, 38, 20]),
    pl([52, 34, 52, 22, 56, 20]),
    pl([10, 16, 90, 16]),
  ]
}

export function motifDragon(): Polyline[] {
  const bodyTop: number[] = []
  const bodyBot: number[] = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const x = 6 + t * 76
    const y = 50 + 11 * Math.sin(t * Math.PI * 3)
    bodyTop.push(x, y + 4)
    bodyBot.push(x, y - 4)
  }
  const scales: Polyline[] = []
  for (let i = 0; i < 12; i++) {
    const t = 0.08 + (i / 12) * 0.8
    const x = 6 + t * 76
    const y = 50 + 11 * Math.sin(t * Math.PI * 3)
    scales.push(pl(arc(x, y - 2.5, 2.5, 0, Math.PI, 8)))
  }
  return [
    pl(bodyTop),
    pl(bodyBot),
    pl(ellipse(88, 52, 7, 5.5, 20), true),
    pl([93, 55, 99, 57]),
    pl([93, 49, 99, 47]),
    pl(ellipse(89, 54, 1.2, 1.2, 8), true),
    pl(bez(86, 57, 84, 64, 80, 68, 78, 72, 10)),
    pl(bez(90, 57, 90, 64, 88, 70, 86, 74, 10)),
    pl(bez(82, 48, 76, 44, 72, 46, 68, 42, 10)),
    pl(bez(6, 54, 2, 58, 1, 62, 2, 66, 8)),
    pl(bez(6, 46, 2, 42, 1, 38, 2, 34, 8)),
    pl([30, 44, 28, 34, 26, 32]),
    pl([54, 44, 52, 34, 50, 32]),
    ...scales,
  ]
}

export function motifFish(): Polyline[] {
  return [
    pl([...bez(14, 50, 34, 68, 58, 66, 72, 50), ...bez(72, 50, 58, 34, 34, 32, 14, 50).slice(2)], true),
    pl([72, 50, 88, 64, 84, 50, 88, 36], true),
    pl(bez(34, 60, 40, 68, 46, 68, 50, 62, 10)),
    pl(arc(46, 50, 14, Math.PI * 0.6, Math.PI * 1.4, 14)),
    pl(arc(52, 50, 10, Math.PI * 0.6, Math.PI * 1.4, 12)),
    pl(arc(58, 50, 6, Math.PI * 0.6, Math.PI * 1.4, 10)),
    pl(ellipse(24, 54, 2.4, 2.4, 10), true),
    pl(arc(30, 50, 6, Math.PI * 1.2, Math.PI * 1.8, 8)),
  ]
}

export function motifFlower(): Polyline[] {
  const lines: Polyline[] = []
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 2 + (k * Math.PI * 2) / 5
    lines.push(pl(ellipse(50 + 13 * Math.cos(a), 50 + 13 * Math.sin(a), 9, 9, 18), true))
  }
  lines.push(pl(ellipse(50, 50, 4.5, 4.5, 14), true))
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + 0.3
    lines.push(pl([50, 50, 50 + 8 * Math.cos(a), 50 + 8 * Math.sin(a)]))
  }
  return lines
}

export function motifCloud(): Polyline[] {
  return [
    pl(arc(38, 52, 12, Math.PI * 0.2, Math.PI * 1.9, 22)),
    pl(arc(38, 52, 6, Math.PI * 0.4, Math.PI * 2.1, 16)),
    pl(bez(50, 56, 62, 60, 70, 58, 78, 52, 12)),
    pl(bez(50, 48, 60, 46, 70, 44, 82, 44, 12)),
    pl(arc(80, 48, 5, Math.PI * 1.2, Math.PI * 2.6, 10)),
  ]
}

export interface Motif {
  id: string
  name: string
  gen: () => Polyline[]
}

export const MOTIFS: Motif[] = [
  { id: 'butterfly', name: '蝴蝶', gen: motifButterfly },
  { id: 'bird', name: '鸟', gen: motifBird },
  { id: 'dragon', name: '龙', gen: motifDragon },
  { id: 'fish', name: '鱼', gen: motifFish },
  { id: 'flower', name: '花', gen: motifFlower },
  { id: 'cloud', name: '云纹', gen: motifCloud },
]
