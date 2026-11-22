import type { Pattern, Work } from '../core/types'

const DB_NAME = 'miao_silver_studio'
const DB_VER = 1

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

let dbp: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER)
      r.onupgradeneeded = () => {
        r.result.createObjectStore('works', { keyPath: 'id' })
        r.result.createObjectStore('patterns', { keyPath: 'id' })
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }
  return dbp
}

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return (await db()).transaction(name, mode).objectStore(name)
}

export const listWorks = async (): Promise<Work[]> =>
  (await req((await store('works', 'readonly')).getAll())) as Work[]

export const putWork = async (w: Work): Promise<void> => {
  await req((await store('works', 'readwrite')).put(w))
}

export const deleteWork = async (id: string): Promise<void> => {
  await req((await store('works', 'readwrite')).delete(id))
}

export const listPatterns = async (): Promise<Pattern[]> =>
  (await req((await store('patterns', 'readonly')).getAll())) as Pattern[]

export const putPattern = async (p: Pattern): Promise<void> => {
  await req((await store('patterns', 'readwrite')).put(p))
}

export const deletePattern = async (id: string): Promise<void> => {
  await req((await store('patterns', 'readwrite')).delete(id))
}
