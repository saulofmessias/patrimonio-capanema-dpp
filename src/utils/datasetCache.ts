import { PatrimonioRecord } from '../types/appsheet';

/**
 * Cache local do catalogo oficial de bens (public/data/patrimonios_capanema.json)
 * e das edicoes / sincronizacoes incrementais vindas da nuvem ou feitas offline.
 *
 * Usar IndexedDB para ambos evita:
 * 1) O limite rigido de ~5 MB do localStorage (que falhava com fotos em Base64);
 * 2) A perda de registros apos F5 quando a sincronizacao inicial baixava lotes > 300 bens;
 * 3) Travamentos sincronos de JSON.parse/JSON.stringify na thread principal.
 *
 * IMPORTANTE: ao regenerar o JSON da base, incremente CACHE_VERSION para
 * que todos os dispositivos descartem o catalogo antigo.
 */

const DB_NAME = 'CapanemaDatasetDB';
const DB_VERSION = 2;
const STORE_NAME = 'dataset';
const EDITS_STORE_NAME = 'edits';
const CACHE_KEY = 'patrimonios_capanema';
const LEGACY_LOCALSTORAGE_EDITS_KEY = 'patrimonios_edicoes_capanema_v3';

export const CACHE_VERSION = 'v4';
export const CLOUD_SYNC_CURSOR_KEY = 'patrimonios_cloud_sync_at_v2';

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
      if (!db.objectStoreNames.contains(EDITS_STORE_NAME)) {
        db.createObjectStore(EDITS_STORE_NAME, { keyPath: 'id' });
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

/**
 * Grava um lote de bens editados ou sincronizados do Firestore no IndexedDB
 * (uma unica transacao, sem limite de 5 MB do localStorage e sem duplicar chaves).
 */
export async function writeCachedEditsBatch(records: PatrimonioRecord[]): Promise<void> {
  if (!records || records.length === 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([EDITS_STORE_NAME], 'readwrite');
      const store = tx.objectStore(EDITS_STORE_NAME);
      for (const rec of records) {
        if (rec && rec.id) {
          store.put(rec);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Não foi possível salvar edições no IndexedDB:', err);
  }
}

/**
 * Le todas as edicoes/sincronizacoes locais do IndexedDB.
 * Se existirem dados legados em localStorage (`patrimonios_edicoes_capanema_v3`),
 * migra automaticamente para o IndexedDB e libera o espaco do localStorage.
 */
export async function readCachedEdits(): Promise<PatrimonioRecord[]> {
  const byId = new Map<string, PatrimonioRecord>();

  // 1. Ler edicoes ja persistidas no IndexedDB
  try {
    const db = await openDb();
    const idbItems = await new Promise<PatrimonioRecord[]>((resolve) => {
      const tx = db.transaction([EDITS_STORE_NAME], 'readonly');
      const req = tx.objectStore(EDITS_STORE_NAME).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as PatrimonioRecord[]) : []);
      req.onerror = () => resolve([]);
    });
    for (const item of idbItems) {
      if (item && item.id) byId.set(item.id, item);
    }
  } catch {
    // Continua para eventual fallback legado
  }

  // 2. Migrar uma unica vez eventuais edicoes legadas do localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const rawLegacy = localStorage.getItem(LEGACY_LOCALSTORAGE_EDITS_KEY);
      if (rawLegacy) {
        const parsed = JSON.parse(rawLegacy) as Record<string, PatrimonioRecord>;
        const migrated: PatrimonioRecord[] = [];
        for (const val of Object.values(parsed || {})) {
          if (val && val.id && !byId.has(val.id)) {
            byId.set(val.id, val);
            migrated.push(val);
          }
        }
        if (migrated.length > 0) {
          await writeCachedEditsBatch(migrated);
        }
        localStorage.removeItem(LEGACY_LOCALSTORAGE_EDITS_KEY);
      }
    } catch {
      // Ignora erro de parse do cache legado
    }
  }

  return Array.from(byId.values());
}

/**
 * Recua um timestamp ISO em `bufferMs` (padrao: 5 minutos) para proteger consultas
 * incrementais (`atualizadoEm > cursor`) contra pequenas diferencas de relogio entre aparelhos.
 */
export function subtractClockSkewBuffer(isoTimestamp: string, bufferMs = 5 * 60 * 1000): string {
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return isoTimestamp;
  return new Date(Math.max(0, parsed - bufferMs)).toISOString();
}
