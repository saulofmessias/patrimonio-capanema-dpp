import { PatrimonioRecord } from '../types/appsheet';

/**
 * Cache local do catalogo oficial de bens (public/data/patrimonios_capanema.json).
 *
 * O arquivo tem ~4,5 MB / 6.700 registros. Baixar e reinterpretar isso a cada
 * abertura do app atrasa a primeira pintura e, sem conexao, o catalogo nao
 * aparecia. O cache em IndexedDB guarda os registros ja interpretados:
 * a proxima abertura le do disco (sem rede, sem JSON.parse de 4,5 MB) e o
 * app funciona offline com a base completa.
 *
 * IMPORTANTE: ao regenerar o JSON da base, incremente CACHE_VERSION para
 * que todos os dispositivos descartem o catalogo antigo.
 */

const DB_NAME = 'CapanemaDatasetDB';
const DB_VERSION = 1;
const STORE_NAME = 'dataset';
const CACHE_KEY = 'patrimonios_capanema';
export const CACHE_VERSION = 'v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readCachedDataset(): Promise<PatrimonioRecord[] | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const req = tx.objectStore(STORE_NAME).get(CACHE_KEY);
      req.onsuccess = () => {
        const registro = req.result as { key: string; version: string; data: PatrimonioRecord[] } | undefined;
        if (!registro || registro.version !== CACHE_VERSION || !Array.isArray(registro.data)) {
          resolve(null);
          return;
        }
        resolve(registro.data);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeCachedDataset(data: PatrimonioRecord[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      tx.objectStore(STORE_NAME).put({ key: CACHE_KEY, version: CACHE_VERSION, data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Não foi possível salvar o catálogo em cache local:', err);
  }
}

export async function clearCachedDataset(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      tx.objectStore(STORE_NAME).delete(CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignora: cache e apenas uma otimizacao
  }
}
