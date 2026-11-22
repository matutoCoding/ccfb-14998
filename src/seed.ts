import { MOTIFS, motifBird, motifButterfly, motifCloud, motifDragon, motifFlower } from './core/patterns'
import { fillEllipse, sampleLines } from './core/sampler'
import type { Pattern, Strike, Work } from './core/types'
import { listPatterns, listWorks, putPattern, putWork } from './lib/store'
import { mulberry32, nowIso, uid } from './lib/util'

const findPat = (pats: Pattern[], name: string): Pattern => {
  const p = pats.find((v) => v.name === name)
  if (!p) throw new Error(`missing seed pattern ${name}`)
  return p
}

const newWork = (partial: Omit<Work, 'id' | 'createdAt' | 'updatedAt'>): Work => ({
  ...partial,
  id: uid(),
  createdAt: nowIso(),
  updatedAt: nowIso(),
})

// 蝴蝶纹银片: 背面推凸鼓起翅膀, 正面线錾勾边, 珠錾点缀
function buildButterflySheet(patternId: string): Work {
  const s = 0.62
  const ox = 19
  const oy = 15.2
  const rng = mulberry32(20260101)
  const strikes: Strike[] = []
  strikes.push(...fillEllipse(ox + 30 * s, oy + 55 * s, 17 * s, 13 * s, 2.4, 'round', 0.55, 'back', rng))
  strikes.push(...fillEllipse(ox + 70 * s, oy + 55 * s, 17 * s, 13 * s, 2.4, 'round', 0.55, 'back', rng))
  strikes.push(...fillEllipse(ox + 37 * s, oy + 33 * s, 10 * s, 8 * s, 2.2, 'round', 0.5, 'back', rng))
  strikes.push(...fillEllipse(ox + 63 * s, oy + 33 * s, 10 * s, 8 * s, 2.2, 'round', 0.5, 'back', rng))
  const lines = motifButterfly()
  strikes.push(...sampleLines(lines, { chisel: 'line', force: 0.7, side: 'front', spacingMm: 1.1, scale: s, offsetX: ox, offsetY: oy }))
  strikes.push(...sampleLines(lines.slice(0, 4), { chisel: 'bead', force: 0.8, side: 'front', spacingMm: 4, scale: s, offsetX: ox, offsetY: oy }))
  return newWork({
    name: '蝴蝶纹银片',
    category: 'sheet',
    blank: { lengthMm: 100, widthMm: 80, thicknessMm: 0.8, gridMm: 0.35, bendRadiusMm: 0 },
    patternId,
    layout: { scale: s, scaleY: s, x: ox, y: oy },
    strikes,
    patina: 0.45,
  })
}

// 花鸟银冠: 中间立鸟, 两侧花卉云纹, 弯成冠弧
function buildBirdCrown(patternId: string): Work {
  const rng = mulberry32(20260202)
  const strikes: Strike[] = []
  const bs = 0.55
  const bx = 82.5
  const by = 7.5
  strikes.push(...fillEllipse(bx + 46 * bs, by + 46 * bs, 18 * bs, 12 * bs, 2.4, 'round', 0.5, 'back', rng))
  strikes.push(...fillEllipse(bx + 66 * bs, by + 62 * bs, 8 * bs, 8 * bs, 2.2, 'round', 0.45, 'back', rng))
  for (const fx of [25, 163]) {
    strikes.push(...fillEllipse(fx + 50 * 0.32, 19 + 50 * 0.32, 12 * 0.32, 12 * 0.32, 2.0, 'round', 0.45, 'back', rng))
  }
  strikes.push(...sampleLines(motifBird(), { chisel: 'line', force: 0.7, side: 'front', spacingMm: 1.2, scale: bs, offsetX: bx, offsetY: by }))
  strikes.push(...sampleLines(motifFlower(), { chisel: 'line', force: 0.65, side: 'front', spacingMm: 1.2, scale: 0.32, offsetX: 25, offsetY: 19 }))
  strikes.push(...sampleLines(motifFlower(), { chisel: 'line', force: 0.65, side: 'front', spacingMm: 1.2, scale: 0.32, offsetX: 163, offsetY: 19 }))
  strikes.push(...sampleLines(motifCloud(), { chisel: 'line', force: 0.6, side: 'front', spacingMm: 1.3, scale: 0.28, offsetX: 52, offsetY: 22 }))
  strikes.push(...sampleLines(motifCloud(), { chisel: 'line', force: 0.6, side: 'front', spacingMm: 1.3, scale: 0.28, offsetX: 140, offsetY: 22 }))
  strikes.push(...sampleLines(motifFlower(), { chisel: 'bead', force: 0.75, side: 'front', spacingMm: 5, scale: 0.32, offsetX: 25, offsetY: 19 }))
  strikes.push(...sampleLines(motifFlower(), { chisel: 'bead', force: 0.75, side: 'front', spacingMm: 5, scale: 0.32, offsetX: 163, offsetY: 19 }))
  return newWork({
    name: '花鸟银冠',
    category: 'crown',
    blank: { lengthMm: 220, widthMm: 70, thicknessMm: 0.9, gridMm: 0.4, bendRadiusMm: 95 },
    patternId,
    layout: { scale: bs, scaleY: bs, x: bx, y: by },
    strikes,
    patina: 0.6,
  })
}

// 龙纹手镯: 龙身沿镯面游走, 背面顶起龙脊, 正面勾鳞甲
function buildDragonBracelet(patternId: string): Work {
  const sx = 1.45
  const sy = 0.2
  const ox = 2.5
  const oy = 1
  const strikes: Strike[] = []
  const spine: { pts: number[]; closed: boolean } = { pts: [], closed: false }
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    spine.pts.push(6 + t * 76, 50 + 11 * Math.sin(t * Math.PI * 3))
  }
  strikes.push(...sampleLines([spine], { chisel: 'round', force: 0.5, side: 'back', spacingMm: 2.2, scale: sx, scaleY: sy, offsetX: ox, offsetY: oy }))
  strikes.push(...sampleLines(motifDragon(), { chisel: 'line', force: 0.65, side: 'front', spacingMm: 1.0, scale: sx, scaleY: sy, offsetX: ox, offsetY: oy }))
  strikes.push({
    x: ox + 89 * sx, y: oy + 54 * sy, angle: 0, force: 0.85, chisel: 'bead', side: 'front',
  })
  return newWork({
    name: '龙纹手镯',
    category: 'bracelet',
    blank: { lengthMm: 150, widthMm: 22, thicknessMm: 1.0, gridMm: 0.3, bendRadiusMm: 26 },
    patternId,
    layout: { scale: sx, scaleY: sy, x: ox, y: oy },
    strikes,
    patina: 0.55,
  })
}

export async function ensureSeeded(): Promise<void> {
  let pats = await listPatterns()
  if (pats.length === 0) {
    for (const m of MOTIFS) {
      await putPattern({ id: uid(), name: m.name, lines: m.gen(), image: null, createdAt: nowIso() })
    }
    pats = await listPatterns()
  }
  const works = await listWorks()
  if (works.length > 0) return
  await putWork(buildButterflySheet(findPat(pats, '蝴蝶').id))
  await putWork(buildBirdCrown(findPat(pats, '鸟').id))
  await putWork(buildDragonBracelet(findPat(pats, '龙').id))
}
