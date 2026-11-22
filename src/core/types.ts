export type Category = 'crown' | 'collar' | 'bracelet' | 'sheet'

export const CATEGORY_NAMES: Record<Category, string> = {
  crown: '银冠',
  collar: '项圈',
  bracelet: '手镯',
  sheet: '银片',
}

export type ChiselId = 'round' | 'flat' | 'line' | 'bead'

export interface BlankSpec {
  lengthMm: number
  widthMm: number
  thicknessMm: number
  gridMm: number
  bendRadiusMm: number
}

export type StrikeSide = 'back' | 'front'

export interface Strike {
  x: number
  y: number
  angle: number
  force: number
  chisel: ChiselId
  side: StrikeSide
}

export interface PatternLayout {
  scale: number
  scaleY: number
  x: number
  y: number
}

export interface Work {
  id: string
  name: string
  category: Category
  blank: BlankSpec
  patternId: string | null
  layout: PatternLayout
  strikes: Strike[]
  patina: number
  createdAt: string
  updatedAt: string
}

export interface Polyline {
  pts: number[]
  closed: boolean
}

export interface Pattern {
  id: string
  name: string
  lines: Polyline[]
  image: string | null
  createdAt: string
}
