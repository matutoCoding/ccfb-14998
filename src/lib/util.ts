export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const nowIso = (): string => new Date().toISOString()

export const fmtDate = (iso: string): string => iso.slice(0, 16).replace('T', ' ')

export function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text) e.textContent = text
  return e
}

// 确定性伪随机, 只用于生成测试作品的抖动, 不参与变形计算
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
