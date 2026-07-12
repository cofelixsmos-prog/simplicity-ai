const DB_NAME = "sx-bg"
const STORE = "video"
const KEY = "bg-video"

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveBgVideo(file: File): Promise<string> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(file, KEY)
    tx.oncomplete = () => {
      const url = URL.createObjectURL(file)
      resolve(url)
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadBgVideo(): Promise<string | null> {
  try {
    const db = await open()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly")
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => {
        const blob = req.result as Blob | undefined
        resolve(blob ? URL.createObjectURL(blob) : null)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}
