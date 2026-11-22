import type { HeightField } from '../core/heightfield'
import type { BlankSpec } from '../core/types'
import { clamp } from '../lib/util'

export interface MeshData {
  positions: Float32Array
  normals: Float32Array
  ao: Float32Array
  indices: Uint32Array
  center: [number, number, number]
  radius: number
}

// 由高度场构建网格。bendRadius > 0 时把银片绕圆柱弯曲(沿长度方向),
// 浮雕随外表面半径增大自然拉伸, 与真实弯曲一致
export function buildMesh(hf: HeightField, blank: BlankSpec, bendRadius: number): MeshData {
  const { nx, ny, cell, height } = hf
  const count = nx * ny
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const ao = new Float32Array(count)
  const xc = ((nx - 1) * cell) / 2
  const bend = bendRadius > 0 && Number.isFinite(bendRadius)

  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iy * nx + ix
      const h = height[i]
      const x = ix * cell
      const y = iy * cell
      const hxl = height[iy * nx + Math.max(0, ix - 1)]
      const hxr = height[iy * nx + Math.min(nx - 1, ix + 1)]
      const hyl = height[Math.max(0, iy - 1) * nx + ix]
      const hyr = height[Math.min(ny - 1, iy + 1) * nx + ix]
      let nvx = -(hxr - hxl) / (2 * cell)
      let nvy = 1
      let nvz = -(hyr - hyl) / (2 * cell)
      let px = x
      let py = h
      let pz = y
      if (bend) {
        const th = (x - xc) / bendRadius
        const c = Math.cos(th)
        const s = Math.sin(th)
        const rr = bendRadius + h
        px = rr * s
        pz = rr * c - bendRadius
        py = y
        const tnx = nvx * c + nvz * s
        const tnz = -nvx * s + nvz * c
        nvx = tnx
        nvz = tnz
      }
      const nl = Math.hypot(nvx, nvy, nvz)
      positions[i * 3] = px
      positions[i * 3 + 1] = py
      positions[i * 3 + 2] = pz
      normals[i * 3] = nvx / nl
      normals[i * 3 + 1] = nvy / nl
      normals[i * 3 + 2] = nvz / nl
      // 曲率转 AO: 凸处亮凹处暗, 做旧发黑的基础
      const lap = hxl + hxr + hyl + hyr - 4 * h
      ao[i] = clamp(0.55 - lap * 1.2, 0.06, 1)
    }
  }

  const quads = (nx - 1) * (ny - 1)
  const indices = new Uint32Array(quads * 6)
  let k = 0
  for (let iy = 0; iy < ny - 1; iy++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iy * nx + ix
      const b = a + 1
      const c = a + nx
      const d = c + 1
      indices[k++] = a
      indices[k++] = c
      indices[k++] = b
      indices[k++] = b
      indices[k++] = c
      indices[k++] = d
    }
  }

  let cx = 0
  let cy = 0
  let cz = 0
  for (let i = 0; i < count; i++) {
    cx += positions[i * 3]
    cy += positions[i * 3 + 1]
    cz += positions[i * 3 + 2]
  }
  cx /= count
  cy /= count
  cz /= count
  let r = 0
  for (let i = 0; i < count; i++) {
    const d = Math.hypot(positions[i * 3] - cx, positions[i * 3 + 1] - cy, positions[i * 3 + 2] - cz)
    if (d > r) r = d
  }
  return { positions, normals, ao, indices, center: [cx, cy, cz], radius: r }
}
