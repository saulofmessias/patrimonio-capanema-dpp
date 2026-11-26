import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { toFirestorePayload } from './patrimonioSerializer';
import { readCachedEdits, writeCachedEditsBatch } from './datasetCache';
import { PatrimonioRecord } from '../types/appsheet';

/**
 * Gerenciador de Sincronização Offline-First
 * Permite cadastrar patrimônios, transferências e vistorias sem internet,
 * combinando fila local (localStorage) + recuperação automática de registros
 * com `isOfflinePending: true` no IndexedDB (sem limite de 5 MB para fotos).
 */

export interface PendingSyncItem {
  id: string;
  type: 'patrimonio' | 'transferencia' | 'vistoria';
  action: 'create' | 'update' | 'delete';
  timestamp: string;
  payload: Record<string, any>;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
}

export interface SyncQueueResult {
  success: boolean;
  syncedCount: number;
  syncedPatrimonioIds: string[];
  errors: number;
  lastErrorMessage?: string;
}

const STORAGE_KEY = 'patrimonios_capanema_outbox_queue';

export function getPendingQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Erro ao ler fila offline:', err);
    return [];
  }
}

export function savePendingQueue(queue: PendingSyncItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    // Se estourar a cota de 5 MB do localStorage por causa de fotos Base64,
    // salva uma versão enxuta dos metadados (os dados completos + foto já estão no IndexedDB).
    console.warn('localStorage cheio ao salvar fila offline; mantendo referência leve:', err);
    try {
      const compact = queue.map((item) => {
        if (item.type === 'patrimonio' && item.payload && typeof item.payload.fotoBem === 'string' && item.payload.fotoBem.length > 2048) {
          return {
            ...item,
            payload: {
              ...item.payload,
              fotoBem: '__IDB_PHOTO_REF__',
            },
          };
        }
        return item;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // IndexedDB já guarda o registro completo com `isOfflinePending: true`
    }
  }
}

export function addPendingItem(item: Omit<PendingSyncItem, 'id' | 'timestamp' | 'status'>): PendingSyncItem {
  const queue = getPendingQueue();
  const payloadId = item.payload?.id ? String(item.payload.id) : null;
  // Evita duplicar o mesmo bem na fila se o usuário salvar mais de uma vez offline
  const filtered = payloadId
    ? queue.filter((q) => !(q.type === item.type && String(q.payload?.id || '') === payloadId))
    : queue;

  const newItem: PendingSyncItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };
  filtered.push(newItem);
  savePendingQueue(filtered);
  return newItem;
}

export function removePendingItem(id: string): void {
  const queue = getPendingQueue();
  savePendingQueue(queue.filter((i) => i.id !== id));
}

export function clearPendingQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Conta o total real de pendências offline (fila do localStorage + registros
 * `isOfflinePending: true` persistidos no IndexedDB).
 */
export async function getTotalPendingCount(): Promise<number> {
  const queue = getPendingQueue();
  const queuedPatrimonioIds = new Set(
    queue
      .filter((q) => q.type === 'patrimonio' && q.payload?.id)
      .map((q) => String(q.payload.id))
  );

  let extraIdbPending = 0;
  try {
    const edits = await readCachedEdits();
    for (const rec of edits) {
      if (rec && rec.id && rec.isOfflinePending && !queuedPatrimonioIds.has(String(rec.id))) {
        extraIdbPending++;
      }
    }
  } catch {
    // Ignora falha de leitura do IndexedDB
  }

  return queue.length + extraIdbPending;
}

let activeSyncPromise: Promise<SyncQueueResult> | null = null;

/**
 * Envia em lote todos os itens pendentes (fila localStorage + registros
 * `isOfflinePending: true` no IndexedDB) diretamente para o Firestore.
 */
export async function syncQueueWithServer(
  onProgress?: (syncedCount: number, total: number) => void
): Promise<SyncQueueResult> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = runSyncQueue(onProgress).finally(() => {
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

async function runSyncQueue(
  onProgress?: (syncedCount: number, total: number) => void
): Promise<SyncQueueResult> {
  const queue = getPendingQueue();
  const idbEdits = await readCachedEdits();
  const idbById = new Map<string, PatrimonioRecord>();
  for (const rec of idbEdits) {
    if (rec && rec.id) {
      idbById.set(String(rec.id), rec);
    }
  }

  // Hidrata eventuais itens compactados com foto no IndexedDB
  const combinedQueue: PendingSyncItem[] = queue.map((item) => {
    if (item.type === 'patrimonio' && item.payload?.id) {
      const fullRec = idbById.get(String(item.payload.id));
      if (fullRec && item.payload.fotoBem === '__IDB_PHOTO_REF__') {
        return { ...item, payload: fullRec };
      }
    }
    return item;
  });

  // Recupera bens salvos no IndexedDB com `isOfflinePending: true` que não estavam na fila do localStorage
  // (ex.: quando o localStorage estourou 5 MB por causa de fotos ou em recarregamentos antigos).
  const queuedPatrimonioIds = new Set(
    combinedQueue
      .filter((q) => q.type === 'patrimonio' && q.payload?.id)
      .map((q) => String(q.payload.id))
  );
  for (const rec of idbEdits) {
    if (rec && rec.id && rec.isOfflinePending && !queuedPatrimonioIds.has(String(rec.id))) {
      combinedQueue.push({
        id: `idb_recover_${rec.id}`,
        type: 'patrimonio',
        action: 'create',
        timestamp: rec.atualizadoEm || new Date().toISOString(),
        payload: rec,
        status: 'pending',
      });
      queuedPatrimonioIds.add(String(rec.id));
    }
  }

  if (combinedQueue.length === 0) {
    return { success: true, syncedCount: 0, syncedPatrimonioIds: [], errors: 0 };
  }

  let syncedCount = 0;
  let errors = 0;
  let lastErrorMessage: string | undefined;
  const syncedPatrimonioIds: string[] = [];
  const clearedIdbRecords: PatrimonioRecord[] = [];

  for (let i = 0; i < combinedQueue.length; i++) {
    const item = combinedQueue[i];
    item.status = 'syncing';

    const colName =
      item.type === 'patrimonio'
        ? 'patrimonios'
        : item.type === 'transferencia'
        ? 'transferencias'
        : 'vistorias';

    try {
      const rawPayload = item.payload || {};
      const docId = String(rawPayload.id || item.id);

      if (item.action === 'delete') {
        await deleteDoc(doc(db, colName, docId));
      } else {
        const nowIso = new Date().toISOString();
        const payload = toFirestorePayload(item.type, {
          ...rawPayload,
          atualizadoEm: rawPayload.atualizadoEm || nowIso,
        });
        if (item.action === 'create') {
          await setDoc(doc(db, colName, docId), payload);
        } else {
          await setDoc(doc(db, colName, docId), payload, { merge: true });
        }
      }

      item.status = 'synced';
      syncedCount++;

      if (item.type === 'patrimonio') {
        const docId = String(item.payload?.id || '');
        if (docId) {
          syncedPatrimonioIds.push(docId);
          const idbRec = idbById.get(docId) || (item.payload as PatrimonioRecord);
          if (idbRec && idbRec.id) {
            clearedIdbRecords.push({
              ...idbRec,
              isOfflinePending: false,
            });
          }
        }
      }
    } catch (e: unknown) {
      item.status = 'error';
      const msg = e instanceof Error ? e.message : 'Falha ao sincronizar com a nuvem';
      item.errorMessage = msg;
      lastErrorMessage = msg;
      errors++;
      try {
        handleFirestoreError(e, OperationType.WRITE, colName);
      } catch {
        // Mantém o loop seguindo para tentar os próximos itens pendentes
      }
    }

    if (onProgress) {
      onProgress(syncedCount, combinedQueue.length);
    }
  }

  // Atualiza IndexedDB marcando os bens enviados como `isOfflinePending: false`
  // para que o selo "Offline" nunca volte após recarregar a página.
  if (clearedIdbRecords.length > 0) {
    await writeCachedEditsBatch(clearedIdbRecords);
  }

  // Mantém na fila do localStorage apenas os itens que realmente falharam
  const remaining = combinedQueue.filter((i) => i.status !== 'synced');
  savePendingQueue(remaining);

  return {
    success: errors === 0,
    syncedCount,
    syncedPatrimonioIds,
    errors,
    lastErrorMessage,
  };
}
