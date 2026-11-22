import type { MeshData } from './mesh'

export interface OrbitCamera {
  theta: number
  phi: number
  dist: number
  target: [number, number, number]
}

const WGSL = /* wgsl */ `
struct Uniforms {
  vp: mat4x4<f32>,
  cam: vec4<f32>,
  l1: vec4<f32>,
  l2: vec4<f32>,
  amb: vec4<f32>,
}
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsIn {
  @location(0) pos: vec3<f32>,
  @location(1) nrm: vec3<f32>,
  @location(2) ao: f32,
}
struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) wp: vec3<f32>,
  @location(1) nrm: vec3<f32>,
  @location(2) ao: f32,
}
@vertex fn vs(i: VsIn) -> VsOut {
  var o: VsOut;
  o.pos = u.vp * vec4<f32>(i.pos, 1.0);
  o.wp = i.pos;
  o.nrm = i.nrm;
  o.ao = i.ao;
  return o;
}

fn shadeOne(l: vec3<f32>, n: vec3<f32>, v: vec3<f32>, base: vec3<f32>, li: f32) -> vec3<f32> {
  let ndl = max(dot(n, l), 0.0);
  let h = normalize(l + v);
  let ndh = max(dot(n, h), 0.0);
  // 锐利主高光表现錾痕的细小反光, 宽高光给整体金属感
  let spec = pow(ndh, 220.0) * 1.5 + pow(ndh, 24.0) * 0.22;
  return (base * ndl * 0.55 + vec3<f32>(spec)) * li;
}

@fragment fn fs(i: VsOut) -> @location(0) vec4<f32> {
  let n = normalize(i.nrm);
  let v = normalize(u.cam.xyz - i.wp);
  let patina = u.cam.w;
  // 做旧: 凹处(AO 低)积黑, 凸处保持亮银
  let crev = clamp((1.0 - i.ao) * patina * 1.5, 0.0, 0.92);
  let base = mix(vec3<f32>(0.93, 0.94, 0.96), vec3<f32>(0.07, 0.06, 0.055), crev);
  var col = base * u.amb.xyz * u.amb.w;
  col += shadeOne(u.l1.xyz, n, v, base, u.l1.w);
  col += shadeOne(u.l2.xyz, n, v, base, u.l2.w);
  let fr = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  col += vec3<f32>(0.9, 0.92, 0.95) * fr * 0.35 * (1.0 - crev);
  col = col / (col + vec3<f32>(1.0));
  col = pow(col, vec3<f32>(1.0 / 2.2));
  return vec4<f32>(col, 1.0);
}
`

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fov / 2)
  const nf = 1 / (near - far)
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) * nf
  m[11] = -1
  m[14] = 2 * far * near * nf
  return m
}

function lookAt(eye: number[], tgt: number[], up: number[]): Float32Array {
  let zx = eye[0] - tgt[0]
  let zy = eye[1] - tgt[1]
  let zz = eye[2] - tgt[2]
  let l = Math.hypot(zx, zy, zz)
  zx /= l
  zy /= l
  zz /= l
  let xx = up[1] * zz - up[2] * zy
  let xy = up[2] * zx - up[0] * zz
  let xz = up[0] * zy - up[1] * zx
  l = Math.hypot(xx, xy, xz)
  xx /= l
  xy /= l
  xz /= l
  const yx = zy * xz - zz * xy
  const yy = zz * xx - zx * xz
  const yz = zx * xy - zy * xx
  const m = new Float32Array(16)
  m[0] = xx; m[1] = yx; m[2] = zx
  m[4] = xy; m[5] = yy; m[6] = zy
  m[8] = xz; m[9] = yz; m[10] = zz
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2])
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2])
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2])
  m[15] = 1
  return m
}

function mul4(a: Float32Array, b: Float32Array): Float32Array {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  }
  return o
}

export class SilverRenderer {
  private canvas: HTMLCanvasElement
  private device!: GPUDevice
  private ctx!: GPUCanvasContext
  private format!: GPUTextureFormat
  private pipeline!: GPURenderPipeline
  private uniforms!: GPUBuffer
  private bindGroup!: GPUBindGroup
  private depth: GPUTexture | null = null
  private msaa: GPUTexture | null = null
  private vb: GPUBuffer | null = null
  private nb: GPUBuffer | null = null
  private ab: GPUBuffer | null = null
  private ib: GPUBuffer | null = null
  private indexCount = 0
  patina = 0.5
  lightAngle = 0.9

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static async create(canvas: HTMLCanvasElement): Promise<SilverRenderer | null> {
    if (!navigator.gpu) return null
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) return null
    const device = await adapter.requestDevice()
    const r = new SilverRenderer(canvas)
    r.device = device
    const ctx = canvas.getContext('webgpu')
    if (!ctx) return null
    r.ctx = ctx
    r.format = navigator.gpu.getPreferredCanvasFormat()
    ctx.configure({ device, format: r.format, alphaMode: 'opaque' })
    const mod = device.createShaderModule({ code: WGSL })
    r.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: mod,
        entryPoint: 'vs',
        buffers: [
          { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
          { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
          { arrayStride: 4, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32' }] },
        ],
      },
      fragment: { module: mod, entryPoint: 'fs', targets: [{ format: r.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
      multisample: { count: 4 },
    })
    r.uniforms = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    r.bindGroup = device.createBindGroup({
      layout: r.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: r.uniforms } }],
    })
    return r
  }

  setMesh(m: MeshData): void {
    this.vb?.destroy()
    this.nb?.destroy()
    this.ab?.destroy()
    this.ib?.destroy()
    const mk = (arr: Float32Array | Uint32Array, usage: GPUBufferUsageFlags): GPUBuffer => {
      const b = this.device.createBuffer({ size: Math.max(4, arr.byteLength), usage, mapped: true })
      if (arr instanceof Float32Array) new Float32Array(b.getMappedRange()).set(arr)
      else new Uint32Array(b.getMappedRange()).set(arr)
      b.unmap()
      return b
    }
    this.vb = mk(m.positions, GPUBufferUsage.VERTEX)
    this.nb = mk(m.normals, GPUBufferUsage.VERTEX)
    this.ab = mk(m.ao, GPUBufferUsage.VERTEX)
    this.ib = mk(m.indices, GPUBufferUsage.INDEX)
    this.indexCount = m.indices.length
  }

  private ensureTargets(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(8, Math.floor(this.canvas.clientWidth * dpr))
    const h = Math.max(8, Math.floor(this.canvas.clientHeight * dpr))
    if (this.canvas.width === w && this.canvas.height === h && this.depth && this.msaa) return
    this.canvas.width = w
    this.canvas.height = h
    this.depth?.destroy()
    this.msaa?.destroy()
    this.depth = this.device.createTexture({
      size: [w, h], format: 'depth24plus', sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
    this.msaa = this.device.createTexture({
      size: [w, h], format: this.format, sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
  }

  render(cam: OrbitCamera): void {
    if (!this.ib || this.indexCount === 0) return
    this.ensureTargets()
    const aspect = this.canvas.width / this.canvas.height
    const proj = perspective((40 * Math.PI) / 180, aspect, Math.max(0.5, cam.dist / 100), cam.dist * 10)
    const sp = Math.sin(cam.phi)
    const eye = [
      cam.target[0] + cam.dist * sp * Math.sin(cam.theta),
      cam.target[1] + cam.dist * Math.cos(cam.phi),
      cam.target[2] + cam.dist * sp * Math.cos(cam.theta),
    ]
    const view = lookAt(eye, cam.target, [0, 1, 0])
    const vp = mul4(proj, view)
    const la = this.lightAngle
    const u = new Float32Array(32)
    u.set(vp, 0)
    u.set([eye[0], eye[1], eye[2], this.patina], 16)
    u.set([Math.cos(la) * 0.6, 0.8, Math.sin(la) * 0.6, 1.0], 20)
    u.set([-Math.cos(la) * 0.5, 0.4, -Math.sin(la) * 0.5, 0.45], 24)
    u.set([1, 1, 1, 0.32], 28)
    this.device.queue.writeBuffer(this.uniforms, 0, u)
    const enc = this.device.createCommandEncoder()
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: this.msaa!.createView(),
        resolveTarget: this.ctx.getCurrentTexture().createView(),
        clearValue: { r: 0.14, g: 0.15, b: 0.18, a: 1 },
        loadOp: 'clear',
        storeOp: 'discard',
      }],
      depthStencilAttachment: {
        view: this.depth!.createView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    })
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.setVertexBuffer(0, this.vb!)
    pass.setVertexBuffer(1, this.nb!)
    pass.setVertexBuffer(2, this.ab!)
    pass.setIndexBuffer(this.ib!, 'uint32')
    pass.drawIndexed(this.indexCount)
    pass.end()
    this.device.queue.submit([enc.finish()])
  }
}
