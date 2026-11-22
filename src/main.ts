import './style.css'
import { ensureSeeded } from './seed'

type PageFn = (root: HTMLElement, id: string) => Promise<void>

const routes: Record<string, () => Promise<{ mount: PageFn }>> = {
  works: () => import('./pages/works'),
  patterns: () => import('./pages/patterns'),
  edit: () => import('./pages/editor'),
  preview: () => import('./pages/preview'),
  replay: () => import('./pages/replay'),
  order: () => import('./pages/workorder'),
}

const NAV_OF: Record<string, string> = {
  works: 'works',
  edit: 'works',
  preview: 'works',
  replay: 'works',
  order: 'works',
  patterns: 'patterns',
}

async function route(): Promise<void> {
  const app = document.getElementById('app')
  if (!app) return
  const parts = (location.hash || '#/works').slice(2).split('/')
  const name = parts[0] in routes ? parts[0] : 'works'
  const id = parts[1] ?? ''
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-nav') === NAV_OF[name])
  })
  app.innerHTML = ''
  const page = await routes[name]()
  await page.mount(app, id)
}

window.addEventListener('hashchange', () => void route())

ensureSeeded()
  .then(route)
  .catch((err) => {
    const app = document.getElementById('app')
    if (app) app.textContent = `初始化失败: ${String(err)}`
  })
