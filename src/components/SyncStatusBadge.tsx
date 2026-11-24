import React, { useEffect, useState } from 'react';
import { 
  getPendingQueue, syncQueueWithServer, PendingSyncItem 
} from '../utils/offlineSyncManager';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  onSyncComplete?: () => void;
}

export const SyncStatusBadge: React.FC<Props> = ({ onSyncComplete }) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingItems, setPendingItems] = useState<PendingSyncItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  const refreshPendingCount = () => {
    setPendingItems(getPendingQueue());
  };

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = async () => {
      setIsOnline(true);
      setShowToast('Conexão restabelecida! Iniciando sincronização automática...');
      await handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowToast('Você está offline. O aplicativo continua funcionando normalmente e salvará tudo no seu celular!');
      setTimeout(() => setShowToast(null), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodically check queue length
    const interval = setInterval(refreshPendingCount, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const result = await syncQueueWithServer();
      refreshPendingCount();
      if (result.syncedCount > 0) {
        setShowToast(`Sucesso! ${result.syncedCount} registro(s) sincronizado(s) com o servidor!`);
        setTimeout(() => setShowToast(null), 4000);
        if (onSyncComplete) onSyncComplete();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Toast alert */}
      {showToast && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-xs font-semibold text-white shadow-2xl animate-fade-in max-w-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{showToast}</span>
        </div>
      )}

      {/* When offline */}
      {!isOnline && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-semibold">
          <CloudOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="hidden sm:inline">Modo</span> Offline
          {pendingItems.length > 0 && ` (${pendingItems.length} pendente)`}
        </span>
      )}

      {/* When online with pending items in queue */}
      {isOnline && pendingItems.length > 0 && (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all animate-pulse"
          title="Clique para sincronizar os cadastros pendentes agora"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : `Sincronizar (${pendingItems.length})`}</span>
        </button>
      )}

      {/* When online and 100% in sync */}
      {isOnline && pendingItems.length === 0 && (
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
