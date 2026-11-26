import React, { useState, useEffect } from 'react';
import {
  AuditLogEntry,
  PatrimonioRecord,
  TransferenciaRecord,
  VistoriaRecord,
} from './types/appsheet';
import { PatrimoniosManager } from './components/PatrimoniosManager';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { OfflineIndicator } from './components/OfflineIndicator';
import { addPendingItem } from './utils/offlineSyncManager';
import { findPatrimonioByCodigo } from './utils/etiquetaQr';
import {
  CLOUD_SYNC_CURSOR_KEY,
  readCachedDataset,
  readCachedEdits,
  subtractClockSkewBuffer,
  writeCachedDataset,
  writeCachedEditsBatch,
} from './utils/datasetCache';
import {
  toFirestorePatrimonio,
  toFirestoreTransferencia,
  toFirestoreVistoria,
} from './utils/patrimonioSerializer';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserAuthBar } from './components/UserAuthBar';
import { LoginScreen } from './components/LoginScreen';
import { db, testConnection, handleFirestoreError, OperationType } from './services/firebase';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

function normalizePatrimonioRecord(base: PatrimonioRecord): PatrimonioRecord {
  const realNum = base.etiquetaNumero || base.numeroTombamento || base.id;
  const localName = base.local || base.localizacaoExata || 'Sede / Geral';
  return {
    ...base,
    etiquetaNumero: realNum,
    numeroTombamento: realNum,
    local: localName,
    localizacaoExata: localName,
    departamento: base.departamento || 'Setor Geral',
  };
}

function AppContent() {
  const { firebaseUser, profile, isLoading: isAuthLoading } = useAuth();
  const [patrimonios, setPatrimonios] = useState<PatrimonioRecord[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaRecord[]>([]);
  const [vistorias, setVistorias] = useState<VistoriaRecord[]>([]);
  const [hasLoadedDataset, setHasLoadedDataset] = useState<boolean>(false);
  const [pendingQrEtiqueta, setPendingQrEtiqueta] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const cod =
      params.get('etiqueta') ||
      params.get('patrimonio') ||
      params.get('tombo') ||
      params.get('id');
    return cod ? cod.trim() : null;
  });
  const [initialBemToOpen, setInitialBemToOpen] = useState<PatrimonioRecord | null>(null);

  // Auto-carregar base completa dos bens reais de Capanema e testar Firestore
  useEffect(() => {
    testConnection().catch(err => console.warn('Conexão inicial Firestore:', err));

    const loadFullCapanemaDataset = async () => {
      try {
        // 1) Catalogo em cache local (IndexedDB): leitura instantanea e funciona offline.
        let data: PatrimonioRecord[] | null = await readCachedDataset();

        // 2) Sem cache: busca o arquivo oficial e guarda em cache para as proximas visitas.
        if (!data || data.length === 0) {
          const res = await fetch('/data/patrimonios_capanema.json');
          if (res.ok) {
            const parsed: unknown = await res.json();
            if (Array.isArray(parsed) && parsed.length > 0) {
              data = parsed as PatrimonioRecord[];
              void writeCachedDataset(data);
            }
          }
        }

        if (data && data.length > 0) {
          // Recupera edições, exclusões (soft delete) e sincronizações salvas no IndexedDB
          const cachedEdits = await readCachedEdits();
          const editsById = new Map<string, PatrimonioRecord>();
          for (const edit of cachedEdits) {
            if (!edit || !edit.id) continue;
            editsById.set(edit.id, edit);
          }

          // Mescla alterações APENAS por `id` (nunca sobrescreve outro bem do catálogo
          // apenas por coincidência de etiquetaNumero, o que antes duplicava bens novos).
          const normalized = data
            .map(p => {
              const edited = editsById.get(p.id);
              return normalizePatrimonioRecord(edited ? { ...p, ...edited } : p);
            })
            .filter(p => !p.excluido);

          // Também inclui eventuais bens novos criados localmente/nuvem que ainda não estão no JSON base
          const baseIds = new Set(data.map(item => item.id));
          const unicosNovos = cachedEdits
            .filter(item => item && item.id && !baseIds.has(item.id) && !item.excluido)
            .map(normalizePatrimonioRecord);

          const seenIds = new Set<string>();
          const mergedUnique: PatrimonioRecord[] = [];
          for (const rec of [...unicosNovos, ...normalized]) {
            if (!rec.id || seenIds.has(rec.id)) continue;
            seenIds.add(rec.id);
            mergedUnique.push(rec);
          }

          setPatrimonios(mergedUnique);
        }
      } catch (err) {
        console.warn('Erro ao carregar base completa:', err);
      } finally {
        setHasLoadedDataset(true);
      }
    };

    loadFullCapanemaDataset();
  }, []);

  const scannedBemPreview =
    hasLoadedDataset && pendingQrEtiqueta
      ? findPatrimonioByCodigo(patrimonios, pendingQrEtiqueta) || null
      : null;

  // Mescla atualizações e exclusões (soft delete) vindas da nuvem Firestore com o catálogo em memória
  const handleMergeFromFirestore = (cloudRecords: PatrimonioRecord[]) => {
    if (!cloudRecords || cloudRecords.length === 0) return;

    const normalizedCloud = cloudRecords.map(normalizePatrimonioRecord);
    const cloudById = new Map<string, PatrimonioRecord>();
    const deletedIds = new Set<string>();

    normalizedCloud.forEach(item => {
      cloudById.set(item.id, item);
      if (item.excluido) {
        deletedIds.add(item.id);
      }
    });

    setPatrimonios(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const novos = normalizedCloud.filter(item => !item.excluido && !existingIds.has(item.id));
      let houveMudanca = false;
      const atualizados: PatrimonioRecord[] = [];

      for (const item of prev) {
        if (deletedIds.has(item.id)) {
          houveMudanca = true;
          continue;
        }
        const cloudItem = cloudById.get(item.id);
        if (!cloudItem) {
          atualizados.push(item);
          continue;
        }
        // Sem alteracao de `atualizadoEm` o documento da nuvem e o mesmo que ja
        // esta em memoria: mantem o objeto original para nao invalidar os
        // caches (useMemo) de filtro e ordenacao sobre ~6.700 bens.
        if (cloudItem.atualizadoEm === item.atualizadoEm) {
          atualizados.push(item);
          continue;
        }
        houveMudanca = true;
        atualizados.push({
          ...item,
          ...cloudItem,
          dataCadastro: cloudItem.dataCadastro || item.dataCadastro,
          isOfflinePending: false,
        });
      }

      if (!houveMudanca && novos.length === 0) return prev;
      return [...novos, ...atualizados];
    });

    // Persiste todos os lotes (incluindo marcadores excluido: true) no IndexedDB
    void writeCachedEditsBatch(normalizedCloud);
  };

  // Sincronização automática com a nuvem Firestore ao abrir/autenticar (delta incremental + tempo real)
  useEffect(() => {
    if (!firebaseUser || !profile || profile.isSimulated || !hasLoadedDataset) return;

    let isActive = true;
    const SYNC_KEY = CLOUD_SYNC_CURSOR_KEY;
    const sessionStartIso = subtractClockSkewBuffer(new Date().toISOString());

    const syncInitialCloudDelta = async () => {
      try {
        // Reaproveita cursor legado se existir; em dispositivo novo, busca apenas o delta
        // recente (ultimos 30 dias, limitado a 500 docs) em vez de varrer todos os 6.688 bens,
        // preservando a cota gratuita diaria de 50.000 leituras do Firestore Spark.
        // (Carga completa continua disponivel sob demanda no modal "Nuvem Firebase".)
        const storedCursor =
          localStorage.getItem(SYNC_KEY) || localStorage.getItem('patrimonios_cloud_sync_at_v1');
        const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        // Janela mínima de 48h garante capturar bens cadastrados offline em outros aparelhos
        // que subiram posteriormente com timestamp anterior, gastando apenas 1 leitura por
        // bem alterado recentemente (preservando a cota gratuita de 50k leituras/dia).
        const fortyEightHoursAgoIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const cursorWithBuffer = storedCursor ? subtractClockSkewBuffer(storedCursor) : null;
        const deltaSince = cursorWithBuffer
          ? (cursorWithBuffer < fortyEightHoursAgoIso ? cursorWithBuffer : fortyEightHoursAgoIso)
          : thirtyDaysAgoIso;

        const colRef = collection(db, 'patrimonios');
        const snap = await getDocs(
          query(colRef, where('atualizadoEm', '>', deltaSince), limit(500))
        );
        if (!isActive) return;

        const baixados: PatrimonioRecord[] = [];
        snap.forEach(d => {
          const raw = d.data() as PatrimonioRecord;
          baixados.push({ ...raw, id: raw.id || d.id });
        });

        if (baixados.length > 0) {
          handleMergeFromFirestore(baixados);
        }

        try {
          localStorage.setItem(SYNC_KEY, new Date().toISOString());
        } catch {}
      } catch (err) {
        console.warn('Erro na sincronização inicial de patrimônios:', err);
        try {
          handleFirestoreError(err, OperationType.LIST, 'patrimonios');
        } catch {}
      }
    };

    syncInitialCloudDelta();

    // Listeners em tempo real para mudanças e exclusões feitas por outros aparelhos durante a sessão
    const unsubPatrimonios = onSnapshot(
      query(collection(db, 'patrimonios'), where('atualizadoEm', '>', sessionStartIso)),
      (snapshot) => {
        if (!isActive || snapshot.empty) return;
        const alterados: PatrimonioRecord[] = [];
        const removidosIds: string[] = [];

        snapshot.docChanges().forEach(change => {
          if (change.type === 'added' || change.type === 'modified') {
            const raw = change.doc.data() as PatrimonioRecord;
            alterados.push({ ...raw, id: raw.id || change.doc.id });
          } else if (change.type === 'removed') {
            removidosIds.push(change.doc.id);
          }
        });

        if (alterados.length > 0) {
          handleMergeFromFirestore(alterados);
          try {
            localStorage.setItem(SYNC_KEY, new Date().toISOString());
          } catch {}
        }

        if (removidosIds.length > 0) {
          const removedSet = new Set(removidosIds);
          setPatrimonios(prev => prev.filter(item => !removedSet.has(item.id)));
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'patrimonios');
        } catch {}
      }
    );

    const unsubTransferencias = onSnapshot(
      query(collection(db, 'transferencias'), limit(100)),
      (snapshot) => {
        if (!isActive || snapshot.empty) return;
        const cloudTransf: TransferenciaRecord[] = [];
        snapshot.forEach(d => cloudTransf.push({ ...(d.data() as TransferenciaRecord), id: d.id }));
        if (cloudTransf.length > 0) {
          setTransferencias(prev => {
            const cloudIds = new Set(cloudTransf.map(t => t.id));
            const locaisRestantes = prev.filter(t => !cloudIds.has(t.id));
            return [...cloudTransf, ...locaisRestantes];
          });
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'transferencias');
        } catch {}
      }
    );

    const unsubVistorias = onSnapshot(
      query(collection(db, 'vistorias'), limit(100)),
      (snapshot) => {
        if (!isActive || snapshot.empty) return;
        const cloudVist: VistoriaRecord[] = [];
        snapshot.forEach(d => cloudVist.push({ ...(d.data() as VistoriaRecord), id: d.id }));
        if (cloudVist.length > 0) {
          setVistorias(prev => {
            const cloudIds = new Set(cloudVist.map(v => v.id));
            const locaisRestantes = prev.filter(v => !cloudIds.has(v.id));
            return [...cloudVist, ...locaisRestantes];
          });
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'vistorias');
        } catch {}
      }
    );

    return () => {
      isActive = false;
      unsubPatrimonios();
      unsubTransferencias();
      unsubVistorias();
    };
  }, [firebaseUser, profile?.uid, profile?.isSimulated, hasLoadedDataset]);

  // Ao abrir via link direto do QR Code (?etiqueta=466), abrir automaticamente a ficha do bem após login e carregamento da base
  useEffect(() => {
    if (!profile || !hasLoadedDataset || !pendingQrEtiqueta || patrimonios.length === 0) return;

    const achado = findPatrimonioByCodigo(patrimonios, pendingQrEtiqueta);
    if (achado) {
      setInitialBemToOpen(achado);
    }
    setPendingQrEtiqueta(null);

    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [profile, hasLoadedDataset, pendingQrEtiqueta, patrimonios]);

  const handleAddAuditLog = (entry: AuditLogEntry) => {
    // Persistir trilha de auditoria imutável no Firestore se online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setDoc(doc(db, 'auditLogs', entry.id), {
        id: entry.id,
        timestamp: entry.timestamp,
        category: entry.category,
        severity: entry.severity,
        title: entry.title,
        description: entry.description,
        entityAffected: entry.entityAffected || '',
        author: entry.author,
      }).catch(err => console.warn('Erro ao salvar auditoria no Firestore:', err));
    }
  };

  const handleSyncComplete = (syncedPatrimonioIds: string[] = []) => {
    const syncedSet = new Set(syncedPatrimonioIds);
    setPatrimonios(prev =>
      prev.map(p =>
        syncedSet.size === 0 || syncedSet.has(p.id)
          ? { ...p, isOfflinePending: false }
          : p
      )
    );
    setTransferencias(prev => prev.map(t => ({ ...t, isOfflinePending: false })));
    setVistorias(prev => prev.map(v => ({ ...v, isOfflinePending: false })));
  };

  const handleAddPatrimonio = (p: PatrimonioRecord) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const nowIso = new Date().toISOString();
    const normalized = normalizePatrimonioRecord({
      ...p,
      dataCadastro: p.dataCadastro || nowIso,
      atualizadoEm: nowIso,
    });
    const recordToAdd: PatrimonioRecord = {
      ...normalized,
      isOfflinePending: isOffline,
    };

    // Gravar no IndexedDB para persistência imediata mesmo offline ou após reload
    void writeCachedEditsBatch([recordToAdd]);

    if (isOffline) {
      addPendingItem({
        type: 'patrimonio',
        action: 'create',
        payload: recordToAdd,
      });
    } else {
      setDoc(doc(db, 'patrimonios', normalized.id), toFirestorePatrimonio(normalized, nowIso)).catch(err => {
        console.warn('Erro ao persistir patrimônio no Firestore; enfileirando para reenvio offline:', err);
        const pendingRecord: PatrimonioRecord = { ...recordToAdd, isOfflinePending: true };
        void writeCachedEditsBatch([pendingRecord]);
        addPendingItem({
          type: 'patrimonio',
          action: 'create',
          payload: pendingRecord,
        });
        setPatrimonios(prev =>
          prev.map(item => (item.id === pendingRecord.id ? pendingRecord : item))
        );
        try {
          handleFirestoreError(err, OperationType.CREATE, 'patrimonios');
        } catch {}
      });
    }

    setPatrimonios(prev => [recordToAdd, ...prev.filter(item => item.id !== recordToAdd.id)]);
    handleAddAuditLog({
      id: `log-${Date.now().toString(36)}`,
      timestamp: nowIso.replace('T', ' ').substring(0, 19),
      category: 'Tabelas & Esquema',
      severity: isOffline ? 'warning' : 'conversion',
      title: `${isOffline ? '[OFFLINE] ' : ''}Novo Tombamento: ${normalized.etiquetaNumero || normalized.numeroTombamento}`,
      description: `Inclusão do bem "${normalized.descricao}" na ${normalized.secretariaSetor} sob a guarda de ${normalized.responsavel}.${isOffline ? ' (Salvo localmente no dispositivo para envio automático ao reconectar)' : ' [Sincronizado na Nuvem]'}`,
      entityAffected: `Patrimonios: ${normalized.etiquetaNumero || normalized.numeroTombamento}`,
      author: isOffline ? 'Operador DPP (Em Campo / Offline)' : (profile?.nome || 'Operador DPP'),
      afterState: `Etiqueta: ${normalized.etiquetaNumero || normalized.numeroTombamento} | R$ ${normalized.valorAquisicao}${isOffline ? ' [Aguardando Sincronização]' : ' [Nuvem Ativa]'}`,
    });
  };

  const handleUpdatePatrimonio = (p: PatrimonioRecord) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const nowIso = new Date().toISOString();
    const updated = normalizePatrimonioRecord({
      ...p,
      atualizadoEm: nowIso,
      isOfflinePending: isOffline,
    });

    // 1. Atualizar imediatamente o estado em memória no React
    setPatrimonios(prev =>
      prev.map(item =>
        item.id === updated.id || (updated.etiquetaNumero && item.etiquetaNumero === updated.etiquetaNumero)
          ? { ...item, ...updated }
          : item
      )
    );

    // 2. Gravar no IndexedDB para que a edição nunca se perca ao recarregar
    void writeCachedEditsBatch([updated]);

    // 3. Atualizar no Firestore (ou enfileirar se offline)
    if (isOffline) {
      addPendingItem({
        type: 'patrimonio',
        action: 'update',
        payload: updated,
      });
    } else {
      setDoc(doc(db, 'patrimonios', updated.id), toFirestorePatrimonio(updated, nowIso), { merge: true }).catch(err => {
        console.warn('Erro ao atualizar no Firestore; enfileirando para reenvio offline:', err);
        const pendingUpdated: PatrimonioRecord = { ...updated, isOfflinePending: true };
        void writeCachedEditsBatch([pendingUpdated]);
        addPendingItem({
          type: 'patrimonio',
          action: 'update',
          payload: pendingUpdated,
        });
        setPatrimonios(prev =>
          prev.map(item => (item.id === pendingUpdated.id ? pendingUpdated : item))
        );
        try {
          handleFirestoreError(err, OperationType.UPDATE, 'patrimonios');
        } catch {}
      });
    }
  };

  // Exclusão lógica (soft delete) sincronizada entre todos os celulares via delta/onSnapshot
  const handleDeletePatrimonio = (p: PatrimonioRecord) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const nowIso = new Date().toISOString();
    const softDeleted = normalizePatrimonioRecord({
      ...p,
      excluido: true,
      excluidoEm: nowIso,
      excluidoPor: profile?.email || 'dpp@capanema.pa.gov.br',
      atualizadoEm: nowIso,
      isOfflinePending: isOffline,
    });

    // 1. Remover imediatamente da listagem em memória
    setPatrimonios(prev => prev.filter(item => item.id !== softDeleted.id));

    // 2. Gravar marcador excluido: true no IndexedDB para não reaparecer no reload
    void writeCachedEditsBatch([softDeleted]);

    // 3. Propagar para o Firestore (todos os demais aparelhos removem via onSnapshot/delta)
    if (isOffline) {
      addPendingItem({
        type: 'patrimonio',
        action: 'update',
        payload: softDeleted,
      });
    } else {
      setDoc(doc(db, 'patrimonios', softDeleted.id), toFirestorePatrimonio(softDeleted, nowIso), { merge: true }).catch(err => {
        console.warn('Erro ao excluir patrimônio no Firestore:', err);
        try {
          handleFirestoreError(err, OperationType.UPDATE, 'patrimonios');
        } catch {}
      });
    }

    handleAddAuditLog({
      id: `log-${Date.now().toString(36)}`,
      timestamp: nowIso.replace('T', ' ').substring(0, 19),
      category: 'Segurança & RBAC',
      severity: 'warning',
      title: `${isOffline ? '[OFFLINE] ' : ''}Exclusão de Bem: ${softDeleted.etiquetaNumero || softDeleted.numeroTombamento}`,
      description: `Remoção lógica do bem "${softDeleted.descricao}" (${softDeleted.secretariaSetor}) realizada por ${profile?.nome || profile?.email || 'Administrador DPP'}.`,
      entityAffected: `Patrimonios: ${softDeleted.etiquetaNumero || softDeleted.numeroTombamento}`,
      author: profile?.nome || 'Administrador DPP',
    });
  };

  const handleAddTransferencia = (t: TransferenciaRecord) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const recordToAdd: TransferenciaRecord = {
      ...t,
      isOfflinePending: isOffline,
    };

    if (isOffline) {
      addPendingItem({
        type: 'transferencia',
        action: 'create',
        payload: recordToAdd,
      });
    } else {
      setDoc(doc(db, 'transferencias', t.id), toFirestoreTransferencia(t))
        .catch(err => console.warn('Erro ao persistir transferência no Firestore:', err));
    }

    setTransferencias(prev => [recordToAdd, ...prev]);
    handleAddAuditLog({
      id: `log-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      category: 'Automações & Bots',
      severity: isOffline ? 'warning' : 'conversion',
      title: `${isOffline ? '[OFFLINE] ' : ''}Guia de Transferência: ${t.patrimonioNumero}`,
      description: `Movimentação de ${t.secretariaOrigem} para ${t.secretariaDestino} com novo responsável ${t.novoResponsavel}.${isOffline ? ' (Registrado offline)' : ''}`,
      entityAffected: `Transferencias: ${t.patrimonioNumero}`,
      author: isOffline ? 'Diretoria de Patrimônio (Offline)' : 'Diretoria de Patrimônio (DPP)',
      afterState: `Guia emitida com termo de responsabilidade${isOffline ? ' [Pendente]' : ''}`,
    });
  };

  const handleAddVistoria = (v: VistoriaRecord) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const recordToAdd: VistoriaRecord = {
      ...v,
      isOfflinePending: isOffline,
    };

    if (isOffline) {
      addPendingItem({
        type: 'vistoria',
        action: 'create',
        payload: recordToAdd,
      });
    } else {
      setDoc(doc(db, 'vistorias', v.id), toFirestoreVistoria(v))
        .catch(err => console.warn('Erro ao persistir vistoria no Firestore:', err));
    }

    setVistorias(prev => [recordToAdd, ...prev]);
    handleAddAuditLog({
      id: `log-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      category: 'Checklist & Diagnóstico',
      severity: isOffline ? 'warning' : 'validation',
      title: `${isOffline ? '[OFFLINE] ' : ''}Vistoria Registrada: ${v.patrimonioNumero}`,
      description: `Conferência física: "${v.statusEncontrado}". Parecer: ${v.parecer || 'Sem observações'}.${isOffline ? ' (Salvo no dispositivo)' : ''}`,
      entityAffected: `Vistorias: ${v.patrimonioNumero}`,
      author: `${v.vistoriador}${isOffline ? ' (Offline)' : ''}`,
      afterState: `Status conferido: ${v.statusEncontrado}`,
    });
  };

  // Tela de carregamento inicial do Auth
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#080c44] flex flex-col items-center justify-center p-6 text-white space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#1e1b4b] border border-blue-400/40 p-1.5 flex items-center justify-center shadow-lg animate-pulse">
          <img src="/assets/aistudio/brasao_capanema_limpo.png" alt="Brasão Capanema" className="h-full w-auto object-contain" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-xs font-black tracking-widest uppercase text-amber-400">Prefeitura de Capanema • Pará</div>
          <div className="text-sm text-slate-300 font-medium">Verificando credenciais na Diretoria de Patrimônio (DPP)...</div>
        </div>
      </div>
    );
  }

  // Se o servidor não está autenticado, exibe a tela oficial de Login com Google
  if (!profile) {
    return <LoginScreen scannedBem={scannedBemPreview} scannedCodigo={pendingQrEtiqueta} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-x-hidden w-full max-w-full">
      {/* Top Navbar Oficial Prefeitura de Capanema */}
      <header className="bg-[#080c44] text-white sticky top-0 z-30 shadow-md border-b border-blue-900/60 w-full max-w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-xl bg-[#1e1b4b] border border-blue-400/40 p-1 flex items-center justify-center shadow-md shrink-0">
              <img
                src="/assets/aistudio/brasao_capanema_limpo.png"
                alt="Brasão da Prefeitura Municipal de Capanema - PA"
                className="h-full w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase text-amber-400 font-sans">
                  PREFEITURA DE CAPANEMA • PARÁ
                </span>
                <span className="hidden sm:inline-flex text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  DPP Oficial
                </span>
              </div>
              <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight truncate text-white leading-tight">
                Diretoria de Patrimônio Público (DPP)
              </h1>
              <p className="hidden md:block text-[11px] text-slate-300/80 truncate">
                Sistema Oficial de Gestão, Inventário e Tombamento de Bens Públicos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <SyncStatusBadge onSyncComplete={handleSyncComplete} />

            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Barra de Autenticação RBAC e Conexão em Nuvem Firestore */}
      <UserAuthBar />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-8 flex-1 w-full max-w-full overflow-x-hidden">
        <PatrimoniosManager
          patrimonios={patrimonios}
          transferencias={transferencias}
          vistorias={vistorias}
          onAddPatrimonio={handleAddPatrimonio}
          onUpdatePatrimonio={handleUpdatePatrimonio}
          onDeletePatrimonio={handleDeletePatrimonio}
          onAddTransferencia={handleAddTransferencia}
          onAddVistoria={handleAddVistoria}
          onUpdateDatasetFromFirestore={handleMergeFromFirestore}
          initialBemToOpen={initialBemToOpen}
          onConsumeInitialBem={() => setInitialBemToOpen(null)}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Prefeitura Municipal de Capanema • Pará — Diretoria de Patrimônio Público (DPP)
          </span>
          <span className="text-slate-400">
            Sistema Oficial de Controle Patrimonial • Sincronizado em Nuvem
          </span>
        </div>
      </footer>

      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
