import { CHISELS } from './chisels'
import type { ChiselId, Work } from './types'

export const SILVER_DENSITY = 10.49 // g/cm³
const SECONDS_PER_STRIKE = 4
const SETUP_MINUTES = 30

export interface ChiselUsage {
  name: string
  count: number
}

export interface WorkOrderData {
  weightG: number
  hammerCount: number
  frontCount: number
  backCount: number
  chiselRows: ChiselUsage[]
  minutes: number
}

export function buildWorkOrder(w: Work): WorkOrderData {
  const volCm3 = (w.blank.lengthMm * w.blank.widthMm * w.blank.thicknessMm) / 1000
  const counts = new Map<ChiselId, number>()
  let front = 0
  let back = 0
  for (const s of w.strikes) {
    counts.set(s.chisel, (counts.get(s.chisel) ?? 0) + 1)
    if (s.side === 'front') front++
    else back++
  }
  const chiselRows: ChiselUsage[] = []
  for (const [id, count] of counts) chiselRows.push({ name: CHISELS[id].name, count })
  chiselRows.sort((a, b) => b.count - a.count)
  return {
    weightG: volCm3 * SILVER_DENSITY,
    hammerCount: w.strikes.length,
    frontCount: front,
    backCount: back,
    chiselRows,
    minutes: Math.round((w.strikes.length * SECONDS_PER_STRIKE) / 60 + SETUP_MINUTES),
  }
}

export const fmtMinutes = (m: number): string =>
  m < 60 ? `${m} 分钟` : `${Math.floor(m / 60)} 小时 ${m % 60} 分`
