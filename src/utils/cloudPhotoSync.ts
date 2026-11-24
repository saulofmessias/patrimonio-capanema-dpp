import { collection, doc, getCountFromServer, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../services/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  getPhoto,
  isValidImageDataUrl,
  savePhoto,
  validateAndCompressImageDataUrl,
} from './photoStorage';

const UPLOADED_CLOUD_PHOTOS_KEY = 'capanema_cloud_photos_uploaded_v1';
const MAX_DATA_URL_LENGTH = 360000;
const VALID_DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

// Evita leituras repetidas no Firestore na mesma sessão para fotos ainda não enviadas
const missingCloudPhotoIds = new Set<string>();
const inFlightRequests = new Map<string, Promise<string | null>>();

/**
 * Normaliza qualquer caminho ou nome de arquivo AppSheet para um ID determinístico válido no Firestore.
 * Ex: "Patrimonios_Images/PMC - 6b015e9b.Foto.120431.jpg" -> "pmc_6b015e9b_foto_120431_jpg"
 */
export function normalizePhotoDocId(filePathOrName: string): string {
  const baseName = (filePathOrName || '').trim().toLowerCase().split('/').pop() || '';
  const sanitized = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return sanitized;
}

export function getUploadedCloudPhotoSet(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(UPLOADED_CLOUD_PHOTOS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set<string>(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function markCloudPhotosUploaded(docIds: string[]): number {
  if (typeof localStorage === 'undefined' || docIds.length === 0) {
    return getUploadedCloudPhotoSet().size;
  }
  const set = getUploadedCloudPhotoSet();
  docIds.forEach((id) => {
    set.add(id);
    missingCloudPhotoIds.delete(id);
  });
  try {
    localStorage.setItem(UPLOADED_CLOUD_PHOTOS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignora limite de localStorage
  }
  return set.size;
}

export function clearMissingCloudPhotoCache(): void {
  missingCloudPhotoIds.clear();
}

/**
 * Consulta no servidor Firestore quantas fotos realmente estão gravadas em /patrimonio_fotos
 */
export async function getCloudPhotosCount(): Promise<number | null> {
  if (!auth.currentUser) return null;
  try {
    const snap = await getCountFromServer(collection(db, 'patrimonio_fotos'));
    return snap.data().count;
  } catch {
    return null;
  }
}

export function isPhotoKnownMissingInCloud(fotoBem?: string): boolean {
  if (!fotoBem) return true;
  const docId = normalizePhotoDocId(fotoBem);
  return !docId || missingCloudPhotoIds.has(docId);
}

/**
 * Garante que a imagem seja válida (decodificável) e leve (<= 360 KB base64) para envio rápido e estável no Firestore
 */
export async function preparePhotoForCloud(dataUrl: string): Promise<string | null> {
  let candidate = await validateAndCompressImageDataUrl(dataUrl, {
    maxDimension: 480,
    quality: 0.54,
    skipIfSmallerThanBytes: 20 * 1024,
  });

  if (!candidate) return null;

  if (candidate.length > MAX_DATA_URL_LENGTH) {
    candidate = await validateAndCompressImageDataUrl(candidate, {
      maxDimension: 380,
      quality: 0.45,
      skipIfSmallerThanBytes: 0,
    });
  }

  if (!candidate || !isValidImageDataUrl(candidate) || candidate.length > MAX_DATA_URL_LENGTH) {
    return null;
  }

  return candidate;
}

/**
 * Envia uma foto via Firestore REST API autenticada com o token Firebase do usuário.
 * Evita travamentos do canal WebChannel em envios de milhares de fotos e retorna erros (ex: cota) instantaneamente.
 */
async function uploadSinglePhotoRest(
  p: { docId: string; fileName: string; dataUrl: string },
  nowIso: string,
  cleanEmail: string,
  idToken: string,
  timeoutMs = 15000
): Promise<void> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/patrimonio_fotos/${encodeURIComponent(p.docId)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          fileName: { stringValue: p.fileName },
          dataUrl: { stringValue: p.dataUrl },
          updatedAt: { stringValue: nowIso },
          uploadedBy: { stringValue: cleanEmail },
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        const gMsg = errJson?.error?.message || '';
        const gStatus = errJson?.error?.status || '';
        detail = [gStatus, gMsg].filter(Boolean).join(': ') || detail;
      } catch {
        // Mantém status HTTP
      }

      if (res.status === 429 || detail.toLowerCase().includes('resource_exhausted') || detail.toLowerCase().includes('quota')) {
        throw new Error(`Quota exceeded: ${detail}`);
      }
      if (res.status === 403 || detail.toLowerCase().includes('permission_denied')) {
        throw new Error(`Missing or insufficient permissions: ${detail}`);
      }
      throw new Error(detail);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Tempo limite (${Math.round(timeoutMs / 1000)}s) ao enviar foto ${p.fileName}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envia um lote de fotos comprimidas para /patrimonio_fotos/{fotoId} via REST autenticado (rápido e sem travar)
 */
export async function uploadCloudPhotosBatch(
  items: { fileName: string; dataUrl: string }[],
  uploadedBy: string,
  skipAlreadyUploaded = true
): Promise<{ uploaded: number; skipped: number; invalid: number }> {
  if (items.length === 0) return { uploaded: 0, skipped: 0, invalid: 0 };

  if (!auth.currentUser) {
    throw new Error('Sessão Google não autenticada. Faça login novamente antes de enviar para a nuvem.');
  }

  const alreadyUploaded = skipAlreadyUploaded ? getUploadedCloudPhotoSet() : new Set<string>();
  const pending: { docId: string; fileName: string; dataUrl: string }[] = [];
  let skipped = 0;
  let invalid = 0;

  for (const item of items) {
    const fileName = (item.fileName.split('/').pop() || item.fileName).trim().toLowerCase();
    const docId = normalizePhotoDocId(fileName);
    if (!docId || !VALID_DOC_ID_REGEX.test(docId)) {
      invalid++;
      continue;
    }
    if (skipAlreadyUploaded && alreadyUploaded.has(docId)) {
      skipped++;
      continue;
    }

    const readyDataUrl = await preparePhotoForCloud(item.dataUrl);
    if (!readyDataUrl) {
      invalid++;
      continue;
    }

    pending.push({
      docId,
      fileName: fileName.slice(0, 240),
      dataUrl: readyDataUrl,
    });
  }

  if (pending.length === 0) {
    return { uploaded: 0, skipped, invalid };
  }

  const idToken = await auth.currentUser.getIdToken();
  const CONCURRENCY = 4;
  const nowIso = new Date().toISOString();
  const cleanEmail = (uploadedBy || auth.currentUser?.email || 'dpp@capanema.pa.gov.br')
    .trim()
    .toLowerCase()
    .slice(0, 160);

  let uploaded = 0;
  let consecutiveFailures = 0;

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const chunk = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((p) => uploadSinglePhotoRest(p, nowIso, cleanEmail, idToken, 15000))
    );

    const succeededIds: string[] = [];
    let fatalErr: Error | null = null;

    results.forEach((res, idx) => {
      const p = chunk[idx];
      if (res.status === 'fulfilled') {
        succeededIds.push(p.docId);
        uploaded++;
        consecutiveFailures = 0;
      } else {
        const err = res.reason instanceof Error ? res.reason : new Error(String(res.reason));
        const lower = err.message.toLowerCase();
        invalid++;
        consecutiveFailures++;

        if (lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('resource-exhausted')) {
          fatalErr = err;
        } else if (lower.includes('permission') || lower.includes('insufficient') || lower.includes('unauthenticated')) {
          fatalErr = err;
        } else if (consecutiveFailures >= 4 && succeededIds.length === 0) {
          fatalErr = err;
        }
      }
    });

    if (succeededIds.length > 0) {
      markCloudPhotosUploaded(succeededIds);
    }

    if (fatalErr) {
      try {
        handleFirestoreError(fatalErr, OperationType.WRITE, 'patrimonio_fotos');
      } catch {}
      throw fatalErr;
    }
  }

  return { uploaded, skipped, invalid };
}

/**
 * Resolve a foto de um bem priorizando:
 * 1) URL direta ou Base64 já embutido
 * 2) Cache local IndexedDB (0 leituras na nuvem, instantâneo e offline)
 * 3) Nuvem Firestore (/patrimonio_fotos/{fotoId}) sob demanda + salva no cache local para sempre
 */
export async function fetchAndCacheCloudPhoto(fotoBem?: string): Promise<string | null> {
  if (!fotoBem) return null;
  const trimmed = fotoBem.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image') || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // 1. Tenta cache local primeiro (instantâneo e sem gastar cota)
  const localCached = await getPhoto(trimmed);
  if (localCached) return localCached;

  const docId = normalizePhotoDocId(trimmed);
  if (!docId || missingCloudPhotoIds.has(docId)) {
    return null;
  }

  // Só consulta a nuvem se autenticado e online
  if (!auth.currentUser || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return null;
  }

  // Deduplica chamadas simultâneas para a mesma foto
  const existingPromise = inFlightRequests.get(docId);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    try {
      const snap = await getDoc(doc(db, 'patrimonio_fotos', docId));
      if (snap.exists()) {
        const data = snap.data() as { dataUrl?: string; fileName?: string };
        if (data?.dataUrl && data.dataUrl.startsWith('data:image')) {
          const baseFileName = (trimmed.split('/').pop() || trimmed).toLowerCase().trim();
          await savePhoto(baseFileName, data.dataUrl);
          return data.dataUrl;
        }
      }
      missingCloudPhotoIds.add(docId);
      return null;
    } catch (err) {
      console.warn(`Aviso ao buscar foto na nuvem (${docId}):`, err);
      return null;
    } finally {
      inFlightRequests.delete(docId);
    }
  })();

  inFlightRequests.set(docId, promise);
  return promise;
}
