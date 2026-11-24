import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { toFirestorePayload } from './patrimonioSerializer';

/**
 * Gerenciador de Sincronização Offline-First
 * Permite cadastrar patrimônios, transferências e vistorias sem internet,
 * armazenando na fila local (Outbox) e sincronizando automaticamente com o Firestore ao reconectar.
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
    console.error('Erro ao salvar fila offline:', err);
  }
}

export function addPendingItem(item: Omit<PendingSyncItem, 'id' | 'timestamp' | 'status'>): PendingSyncItem {
  const queue = getPendingQueue();
  const newItem: PendingSyncItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  queue.push(newItem);
  savePendingQueue(queue);
  return newItem;
}

export function removePendingItem(id: string): void {
  const queue = getPendingQueue();
  savePendingQueue(queue.filter(i => i.id !== id));
}

export function clearPendingQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Envia em lote todos os itens pendentes da fila offline diretamente para o Firestore
 */
export async function syncQueueWithServer(
  onProgress?: (syncedCount: number, total: number) => void
): Promise<{ success: boolean; syncedCount: number; errors: number }> {
  const queue = getPendingQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, errors: 0 };
  }

  let syncedCount = 0;
  let errors = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    item.status = 'syncing';
    savePendingQueue(queue);

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
        // Mesmo serializador usado no caminho online: o documento gravado
        // offline fica identico ao gravado com internet.
        const payload = toFirestorePayload(item.type, rawPayload);
        await setDoc(doc(db, colName, docId), payload, { merge: true });
      }
      item.status = 'synced';
      syncedCount++;
    } catch (e: unknown) {
      item.status = 'error';
      item.errorMessage = e instanceof Error ? e.message : 'Falha ao sincronizar com a nuvem';
      errors++;
      try {
        handleFirestoreError(e, OperationType.WRITE, colName);
      } catch {
        // Mantém o loop seguindo para tentar os próximos itens pendentes
      }
    }

    if (onProgress) {
      onProgress(syncedCount, queue.length);
    }
  }

  // Remove apenas os que foram sincronizados com sucesso
  const remaining = queue.filter(i => i.status !== 'synced');
  savePendingQueue(remaining);

  return { success: errors === 0, syncedCount, errors };
}
