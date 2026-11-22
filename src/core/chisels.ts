import type { ChiselId } from './types'

export interface ChiselDef {
  id: ChiselId
  name: string
  radius: number
  maxDepth: number
  elongation: number
  desc: string
}

export const CHISELS: Record<ChiselId, ChiselDef> = {
  round: { id: 'round', name: '圆头錾', radius: 1.4, maxDepth: 0.45, elongation: 1, desc: '推凸起鼓, 背面主用' },
  flat: { id: 'flat', name: '平头錾', radius: 2.0, maxDepth: 0.25, elongation: 1, desc: '整平压光, 大面积缓变' },
  line: { id: 'line', name: '线錾', radius: 1.6, maxDepth: 0.35, elongation: 3, desc: '勾线走边, 沿纹样排锤' },
  bead: { id: 'bead', name: '珠錾', radius: 0.6, maxDepth: 0.55, elongation: 1, desc: '点珠点缀, 小而深' },
}

export const CHISEL_LIST: ChiselDef[] = [CHISELS.round, CHISELS.flat, CHISELS.line, CHISELS.bead]
