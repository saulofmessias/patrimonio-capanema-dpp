type Loader<T> = () => Promise<T>;

const cache = new Map<string, Promise<unknown>>();

/**
 * Carrega um modulo sob demanda e guarda o resultado para os proximos usos.
 *
 * Usado para as bibliotecas pesadas (qrcode, jsQR, JSZip, jspdf): elas sao
 * baixadas apenas quando a acao que precisa delas acontece, tirando centenas
 * de KB do pacote inicial do app. Em campo, com 3G, essa diferenca decide se
 * o app abre ou nao.
 */
export function lazyImport<T>(key: string, loader: Loader<T>): Promise<T> {
  const cached = cache.get(key) as Promise<T> | undefined;
  if (cached) return cached;

  const promise = loader().catch((err) => {
    // Remove do cache para permitir nova tentativa em caso de falha de rede.
    cache.delete(key);
    throw err;
  });
  cache.set(key, promise);
  return promise;
}

/** Precarrega um modulo sem bloquear (use para aquecer antes do primeiro uso). */
export function prefetchImport<T>(key: string, loader: Loader<T>): Promise<T | null> {
  return lazyImport(key, loader).catch(() => null);
}
