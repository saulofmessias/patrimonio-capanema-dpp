import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getTotalPendingCount,
  syncQueueWithServer,
} from '../utils/offlineSyncManager';
import { useAuth } from '../context/AuthContext';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  onSyncComplete?: (syncedPatrimonioIds: string[]) => void;
}

export const SyncStatusBadge: React.FC<Props> = ({ onSyncComplete }) => {
  const { firebaseUser, profile } = useAuth();
  const canSyncToCloud = Boolean(firebaseUser && profile && !profile.isSimulated);

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const isSyncingRef = useRef(false);
  const lastAutoAttemptRef = useRef<number>(0);
  const onSyncCompleteRef = useRef(onSyncComplete);
  onSyncCompleteRef.current = onSyncComplete;

  const refreshPendingCount = useCallback(async (): Promise<number> => {
    const count = await getTotalPendingCount();
    setPendingCount(count);
    return count;
  }, []);

  const friendlySyncError = (raw?: string): string => {
    const lower = (raw || '').toLowerCase();
    if (lower.includes('permission') || lower.includes('missing or insufficient')) {
      return 'Sem permissão no Firestore para enviar estes bens. Confira se as regras da nuvem foram atualizadas (deploy:rules) e se seu perfil tem permissão de cadastro.';
    }
    if (lower.includes('quota') || lower.includes('resource-exhausted') || lower.includes('resource_exhausted')) {
      return 'Limite diário gratuito do Firebase atingido hoje. Os bens continuam salvos no celular e serão enviados assim que a cota liberar.';
    }
    return 'Não foi possível enviar os bens pendentes agora. Verifique a internet e toque em "Sincronizar".';
  };

  const handleSync = useCallback(
    async (isManual = false) => {
      if (isSyncingRef.current) return;
      if (!canSyncToCloud) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      isSyncingRef.current = true;
      setIsSyncing(true);
      setLastSyncError(null);

      try {
        const result = await syncQueueWithServer();
        const remaining = await refreshPendingCount();

        if (result.syncedCount > 0) {
          setShowToast({
            type: 'success',
            text: `Sucesso! ${result.syncedCount} registro(s) sincronizado(s) com a nuvem!`,
          });
          setTimeout(() => setShowToast(null), 4500);
          onSyncCompleteRef.current?.(result.syncedPatrimonioIds);
        }

        if (result.errors > 0) {
          const msg = friendlySyncError(result.lastErrorMessage);
          setLastSyncError(msg);
          if (isManual || result.syncedCount === 0) {
            setShowToast({ type: 'error', text: msg });
            setTimeout(() => setShowToast(null), 7000);
          }
        } else if (remaining === 0) {
          setLastSyncError(null);
        }
      } catch (err) {
        console.error('Erro na sincronização offline:', err);
        const msg = friendlySyncError(err instanceof Error ? err.message : undefined);
        setLastSyncError(msg);
        if (isManual) {
          setShowToast({ type: 'error', text: msg });
          setTimeout(() => setShowToast(null), 7000);
        }
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [canSyncToCloud, refreshPendingCount]
  );

  // Atualiza contagem de pendências e dispara envio automático quando online + autenticado
  useEffect(() => {
    let active = true;

    const checkAndAutoSync = async (force = false) => {
      const count = await refreshPendingCount();
      if (!active) return;
      const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(onlineNow);

      if (onlineNow && canSyncToCloud && count > 0 && !isSyncingRef.current) {
        const now = Date.now();
        // Evita loop infinito em erro permanente: intervalo mínimo de 30s para tentativas automáticas
        if (force || now - lastAutoAttemptRef.current > 30000) {
          lastAutoAttemptRef.current = now;
          void handleSync(false);
        }
      }
    };

    void checkAndAutoSync(true);

    const handleOnline = () => {
      setIsOnline(true);
      setShowToast({
        type: 'info',
        text: 'Conexão restabelecida! Sincronizando cadastros pendentes...',
      });
      setTimeout(() => setShowToast((prev) => (prev?.type === 'info' ? null : prev)), 4000);
      void checkAndAutoSync(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowToast({
        type: 'info',
        text: 'Você está offline. Os cadastros ficam salvos no celular e serão enviados ao reconectar!',
      });
      setTimeout(() => setShowToast((prev) => (prev?.type === 'info' ? null : prev)), 5000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkAndAutoSync(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(() => {
      void checkAndAutoSync(false);
    }, 5000);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [canSyncToCloud, handleSync, refreshPendingCount]);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Toast alert */}
      {showToast && (
        <div
          className={`fixed top-16 sm:top-20 right-3 left-3 sm:left-auto sm:right-4 z-50 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs font-semibold text-white shadow-2xl animate-fade-in sm:max-w-sm ${
            showToast.type === 'error'
              ? 'bg-rose-950 border-rose-500/60'
              : 'bg-slate-900 border-slate-700'
          }`}
        >
          {showToast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <span>{showToast.text}</span>
        </div>
      )}

      {/* When offline */}
      {!isOnline && (
        <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] sm:text-xs font-semibold whitespace-nowrap">
          <CloudOff className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
          <span>Offline{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
        </span>
      )}

      {/* When online with pending items in queue */}
      {isOnline && pendingCount > 0 && (
        <button
          type="button"
          onClick={() => void handleSync(true)}
          disabled={isSyncing}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-white text-[11px] sm:text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap ${
            lastSyncError
              ? 'bg-amber-600 hover:bg-amber-500 border border-amber-400/60'
              : 'bg-indigo-600 hover:bg-indigo-500 animate-pulse'
          }`}
          title={lastSyncError || 'Toque para sincronizar os cadastros offline agora'}
        >
          <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Enviando...' : `Sincronizar (${pendingCount})`}</span>
        </button>
      )}

      {/* When online and 100% in sync */}
      {isOnline && pendingCount === 0 && (
        <span
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium cursor-default"
          title="Todos os dados estão 100% salvos e sincronizados no servidor"
        >
          <Cloud className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sincronizado</span>
        </span>
      )}
    </div>
  );
};
