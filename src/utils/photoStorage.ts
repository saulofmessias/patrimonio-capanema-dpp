// Utilitário de Armazenamento Local e Compressão Automática de Fotos (IndexedDB + Canvas)
// Mantém fotos de câmera e importações ZIP leves (~50-120 KB) para caber no Firestore (< 1 MB) e rodar offline

const DB_NAME = 'CapanemaPatrimonioPhotosDB';
const DB_VERSION = 1;
const STORE_NAME = 'bens_photos';

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  skipIfSmallerThanBytes?: number;
}

function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readFileAsDataUrl(file: Blob, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          reader.abort();
        } catch {}
        reject(new Error('Tempo limite ao ler arquivo de imagem'));
      }
    }, timeoutMs);

    reader.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(String(reader.result || ''));
    };
    reader.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(reader.error || new Error('Falha ao ler imagem'));
    };
    reader.readAsDataURL(file);
  });
}

const VALID_IMAGE_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/jpg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
];

/**
 * Verifica se uma string é um Data URL de imagem válido com payload base64 real (não vazio/corrompido)
 */
export function isValidImageDataUrl(dataUrl?: string | null): boolean {
  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.length < 64) {
    return false;
  }
  const hasAllowedPrefix = VALID_IMAGE_PREFIXES.some((prefix) => dataUrl.startsWith(prefix));
  if (!hasAllowedPrefix) return false;
  const commaIdx = dataUrl.indexOf(',');
  return commaIdx > 0 && dataUrl.length - commaIdx - 1 >= 32;
}

/**
 * Valida decodificação real da imagem (descarta arquivos 0-byte ou corrompidos) e comprime via Canvas.
 * Retorna null se o arquivo não for uma imagem decodificável válida.
 */
export function validateAndCompressImageDataUrl(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<string | null> {
  const {
    maxDimension = 960,
    quality = 0.74,
    skipIfSmallerThanBytes = 140 * 1024,
  } = options;

  if (!isValidImageDataUrl(dataUrl)) {
    return Promise.resolve(null);
  }
  if (typeof document === 'undefined') {
    return Promise.resolve(dataUrl);
  }

  const approxBytes = Math.floor(dataUrl.length * 0.75);

  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (val: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(val);
    };

    const timer = setTimeout(() => {
      try {
        img.src = '';
      } catch {}
      finish(null);
    }, 8000);

    img.onload = () => {
      try {
        let { width, height } = img;
        if (!width || !height) {
          finish(null);
          return;
        }

        // Imagem já é JPEG válida e pequena o suficiente: mantém sem reprocessar
        if (
          approxBytes <= skipIfSmallerThanBytes &&
          width <= maxDimension &&
          height <= maxDimension &&
          dataUrl.startsWith('data:image/jpeg;base64,')
        ) {
          finish(dataUrl);
          return;
        }

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.max(1, Math.round((height * maxDimension) / width));
            width = maxDimension;
          } else {
            width = Math.max(1, Math.round((width * maxDimension) / height));
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(isValidImageDataUrl(dataUrl) ? dataUrl : null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        const chosen = compressed.length < dataUrl.length ? compressed : dataUrl;
        finish(isValidImageDataUrl(chosen) ? chosen : null);
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = dataUrl;
  });
}

/**
 * Redimensiona e comprime uma imagem (data URL) via Canvas mantendo proporção.
 * Garante tamanho seguro para sincronização Firestore (< 1 MB) e economia de espaço offline.
 */
export function compressImageDataUrl(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<string> {
  return validateAndCompressImageDataUrl(dataUrl, options).then((res) => res || dataUrl);
}

/**
 * Lê e valida um arquivo de imagem da câmera/galeria/pasta, descartando arquivos 0-byte ou corrompidos.
 */
export async function validateAndCompressImageFile(
  file: Blob,
  options: CompressOptions = {}
): Promise<string | null> {
  if (!file || file.size < 64) {
    return null;
  }
  try {
    const rawDataUrl = await readFileAsDataUrl(file);
    return validateAndCompressImageDataUrl(rawDataUrl, {
      maxDimension: 960,
      quality: 0.74,
      skipIfSmallerThanBytes: 120 * 1024,
      ...options,
    });
  } catch {
    return null;
  }
}

/**
 * Lê um arquivo de imagem da câmera/galeria e já retorna em JPEG comprimido.
 */
export async function compressImageFile(
  file: Blob,
  options: CompressOptions = {}
): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file);
  return compressImageDataUrl(rawDataUrl, {
    maxDimension: 960,
    quality: 0.74,
    skipIfSmallerThanBytes: 120 * 1024,
    ...options,
  });
}

/**
 * Salva uma foto associada a uma chave (caminho AppSheet ou ID do bem)
 */
export async function savePhoto(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const normalizedKey = key.trim().toLowerCase();

      const req = store.put({ key: normalizedKey, dataUrl, timestamp: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao salvar foto no IndexedDB:', err);
  }
}

/**
 * Salva um lote de fotos em chunks para suportar milhares de imagens sem travar a memória
 */
export async function savePhotosBatch(
  photos: { key: string; dataUrl: string }[]
): Promise<number> {
  if (photos.length === 0) return 0;
  try {
    const db = await openPhotoDB();
    const CHUNK_SIZE = 100;
    let totalSaved = 0;

    for (let i = 0; i < photos.length; i += CHUNK_SIZE) {
      const chunk = photos.slice(i, i + CHUNK_SIZE);
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        chunk.forEach((p) => {
          const normalizedKey = p.key.trim().toLowerCase();
          store.put({ key: normalizedKey, dataUrl: p.dataUrl, timestamp: Date.now() });
        });

        transaction.oncomplete = () => {
          totalSaved += chunk.length;
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    }

    return totalSaved;
  } catch (err) {
    console.warn('Erro ao salvar lote de fotos:', err);
    return 0;
  }
}

/**
 * Busca uma foto por chave (tenta caminho completo e depois apenas o nome do arquivo)
 */
export async function getPhoto(key: string): Promise<string | null> {
  if (!key) return null;
  try {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const normalizedKey = key.trim().toLowerCase();

      const req = store.get(normalizedKey);
      req.onsuccess = () => {
        if (req.result && req.result.dataUrl) {
          resolve(req.result.dataUrl);
        } else {
          const filename = normalizedKey.split('/').pop() || '';
          if (filename && filename !== normalizedKey) {
            const req2 = store.get(filename);
            req2.onsuccess = () => {
              resolve(req2.result?.dataUrl || null);
            };
            req2.onerror = () => resolve(null);
          } else {
            resolve(null);
          }
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Resolve o campo fotoBem para uma URL exibível (HTTP, Data URL ou cache IndexedDB)
 */
export async function resolveBemPhoto(fotoBem?: string): Promise<string | null> {
  if (!fotoBem) return null;
  const trimmed = fotoBem.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image') || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return getPhoto(trimmed);
}

/**
 * Retorna todas as fotos salvas em um dicionário { key: dataUrl }
 */
export async function getAllPhotosMap(): Promise<Record<string, string>> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const map: Record<string, string> = {};
        if (Array.isArray(req.result)) {
          req.result.forEach((item: { key: string; dataUrl: string }) => {
            if (item.key && item.dataUrl) {
              map[item.key] = item.dataUrl;
              const filename = item.key.split('/').pop();
              if (filename) {
                map[filename] = item.dataUrl;
                map[`patrimonios_images/${filename}`] = item.dataUrl;
              }
            }
          });
        }
        resolve(map);
      };

      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

/**
 * Retorna a lista única de fotos armazenadas no IndexedDB (sem duplicatas de chave)
 */
export async function getAllStoredPhotoEntries(): Promise<{ key: string; dataUrl: string }[]> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const deduped = new Map<string, string>();
        if (Array.isArray(req.result)) {
          req.result.forEach((item: { key: string; dataUrl: string }) => {
            if (item.key && item.dataUrl) {
              const fileName = (item.key.split('/').pop() || item.key).trim().toLowerCase();
              if (fileName && !deduped.has(fileName)) {
                deduped.set(fileName, item.dataUrl);
              }
            }
          });
        }
        resolve(Array.from(deduped.entries()).map(([key, dataUrl]) => ({ key, dataUrl })));
      };

      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Conta o número de fotos armazenadas localmente
 */
export async function countStoredPhotos(): Promise<number> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
