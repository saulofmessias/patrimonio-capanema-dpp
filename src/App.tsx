import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  TableDefinition, ActionDefinition, BotDefinition, MigrationStep, AuditLogEntry,
  PatrimonioRecord, TransferenciaRecord, VistoriaRecord
} from './types/appsheet';
import { 
  INITIAL_MIGRATION_STEPS, 
  DEMO_SAMPLE_TABLES, 
  DEMO_SAMPLE_ACTIONS, 
  DEMO_SAMPLE_BOTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_PATRIMONIOS,
  INITIAL_TRANSFERENCIAS,
  INITIAL_VISTORIAS
} from './data/sampleAppsheetSchema';
import { PatrimoniosManager } from './components/PatrimoniosManager';
import { PWAInstallButton } from './components/PWAInstallButton';

// Módulos técnicos de migração/diagnóstico (apenas administradores): carregados sob demanda
const AppSheetAuditReport = lazy(() =>
  import('./components/AppSheetAuditReport').then(m => ({ default: m.AppSheetAuditReport }))
);
const DiagnosticChecklist = lazy(() =>
  import('./components/DiagnosticChecklist').then(m => ({ default: m.DiagnosticChecklist }))
);
const MigrationDashboard = lazy(() =>
  import('./components/MigrationDashboard').then(m => ({ default: m.MigrationDashboard }))
);
const SchemaManager = lazy(() =>
  import('./components/SchemaManager').then(m => ({ default: m.SchemaManager }))
);
const FormulaConverter = lazy(() =>
  import('./components/FormulaConverter').then(m => ({ default: m.FormulaConverter }))
);
const AutomationMapper = lazy(() =>
  import('./components/AutomationMapper').then(m => ({ default: m.AutomationMapper }))
);
const ArchitectureAdvisor = lazy(() =>
  import('./components/ArchitectureAdvisor').then(m => ({ default: m.ArchitectureAdvisor }))
);
const DataImporterModal = lazy(() =>
  import('./components/DataImporterModal').then(m => ({ default: m.DataImporterModal }))
);
const MigrationAuditLog = lazy(() =>
  import('./components/MigrationAuditLog').then(m => ({ default: m.MigrationAuditLog }))
);
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { OfflineIndicator } from './components/OfflineIndicator';
import { addPendingItem } from './utils/offlineSyncManager';
import { findPatrimonioByCodigo } from './utils/etiquetaQr';
import { readCachedDataset, writeCachedDataset } from './utils/datasetCache';
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
  collection, doc, documentId, getDocs, limit, onSnapshot, orderBy, query,
  setDoc, startAfter, where
} from 'firebase/firestore';
import { 
  ClipboardCheck, Database, Calculator, Bot, Layers, 
  FileSpreadsheet, Shield, Download, FileText, CheckCircle2,
  RefreshCw, HelpCircle, History, Building2, Sparkles, BarChart3
} from 'lucide-react';

function normalizePatrimonioRecord(base: PatrimonioRecord): PatrimonioRecord {
  const realNum = base.etiquetaNumero || base.numeroTombamento || base.id;
  const localName = base.local || base.localizacaoExata || 'Sede / Geral';
  return {
    ...base,
    etiquetaNumero: realNum,
    numeroTombamento: realNum,
    local: localName,
    localizacaoExata: localName,
    departamento: base.departamento || 'Setor Geral'
  };
}

function AppContent() {
  const { firebaseUser, profile, isAdmin, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'analise' | 'patrimonios' | 'checklist' | 'schema' | 'formulas' | 'automations' | 'architecture' | 'audit'>('patrimonios');

  // Fiscais, gerentes e leitores acessam diretamente a Gestão de Patrimônios (sem abas técnicas de migração)
  useEffect(() => {
    if (!isAdmin && activeTab !== 'patrimonios') {
      setActiveTab('patrimonios');
    }
  }, [isAdmin, activeTab]);
  const [patrimonios, setPatrimonios] = useState<PatrimonioRecord[]>(INITIAL_PATRIMONIOS);
  const [transferencias, setTransferencias] = useState<TransferenciaRecord[]>(INITIAL_TRANSFERENCIAS);
  const [vistorias, setVistorias] = useState<VistoriaRecord[]>(INITIAL_VISTORIAS);
  const [steps, setSteps] = useState<MigrationStep[]>(INITIAL_MIGRATION_STEPS);
  const [tables, setTables] = useState<TableDefinition[]>(DEMO_SAMPLE_TABLES);
  const [actions, setActions] = useState<ActionDefinition[]>(DEMO_SAMPLE_ACTIONS);
  const [bots, setBots] = useState<BotDefinition[]>(DEMO_SAMPLE_BOTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [selectedArchitecture, setSelectedArchitecture] = useState<string>('firestore');
  const [showDataImporter, setShowDataImporter] = useState<boolean>(false);
  const [isLoadingDataset, setIsLoadingDataset] = useState<boolean>(true);
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

  // Auto-carregar base completa dos 6.663 bens reais de Capanema e testar Firestore
  useEffect(() => {
    testConnection().catch(err => console.warn('Conexão inicial Firestore:', err));

    const loadFullCapanemaDataset = async () => {
      try {
        setIsLoadingDataset(true);

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
          // Recupera edições salvas localmente pelo usuário para sobrepor com prioridade
          let localEdits: Record<string, PatrimonioRecord> = {};
          try {
            const saved = localStorage.getItem('patrimonios_edicoes_capanema_v3');
            if (saved) localEdits = JSON.parse(saved);
          } catch {}

          const normalized = data.map(p => {
            const edited = localEdits[p.id] || (p.etiquetaNumero ? localEdits[`etq_${p.etiquetaNumero}`] : undefined);
            return normalizePatrimonioRecord(edited ? { ...p, ...edited } : p);
          });

          // Também inclui eventuais bens novos criados localmente que ainda não estão no JSON base
          const baseIds = new Set(normalized.map(item => item.id));
          const novosLocais = Object.values(localEdits)
            .filter(item => item && item.id && !baseIds.has(item.id))
            .map(normalizePatrimonioRecord);
          const seenNew = new Set<string>();
          const unicosNovos = novosLocais.filter(item => {
            if (seenNew.has(item.id)) return false;
            seenNew.add(item.id);
            return true;
          });

          setPatrimonios([...unicosNovos, ...normalized]);
        }
      } catch (err) {
        console.warn('Erro ao carregar base completa:', err);
      } finally {
        setIsLoadingDataset(false);
        setHasLoadedDataset(true);
      }
    };

    loadFullCapanemaDataset();
  }, []);

  const scannedBemPreview =
    hasLoadedDataset && pendingQrEtiqueta
      ? findPatrimonioByCodigo(patrimonios, pendingQrEtiqueta) || null
      : null;

  // Mescla atualizações vindas da nuvem Firestore com o catálogo atual em memória
  const handleMergeFromFirestore = (cloudRecords: PatrimonioRecord[]) => {
    if (!cloudRecords || cloudRecords.length === 0) return;

    const normalizedCloud = cloudRecords.map(normalizePatrimonioRecord);
    const cloudById = new Map<string, PatrimonioRecord>();
    normalizedCloud.forEach(item => {
      cloudById.set(item.id, item);
    });

    setPatrimonios(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const novos = normalizedCloud.filter(item => !existingIds.has(item.id));
      let houveMudanca = false;
      const atualizados = prev.map(item => {
        const cloudItem = cloudById.get(item.id);
        if (!cloudItem) return item;
        // Sem alteracao de `atualizadoEm` o documento da nuvem e o mesmo que ja
        // esta em memoria: mantem o objeto original para nao invalidar os
        // caches (useMemo) de filtro e ordenacao sobre ~6.700 bens.
        if (cloudItem.atualizadoEm === item.atualizadoEm) return item;
        houveMudanca = true;
        return {
          ...item,
          ...cloudItem,
          dataCadastro: cloudItem.dataCadastro || item.dataCadastro,
          isOfflinePending: false
        };
      });
      if (!houveMudanca && novos.length === 0) return prev;
      return [...novos, ...atualizados];
    });

    // Atualiza cache local incremental apenas para lotes pontuais (evita estourar 5MB do localStorage)
    if (normalizedCloud.length <= 300) {
      try {
        const saved = localStorage.getItem('patrimonios_edicoes_capanema_v3');
        const edits = saved ? JSON.parse(saved) : {};
        normalizedCloud.forEach(item => {
          edits[item.id] = item;
          if (item.etiquetaNumero) edits[`etq_${item.etiquetaNumero}`] = item;
        });
        localStorage.setItem('patrimonios_edicoes_capanema_v3', JSON.stringify(edits));
      } catch {}
    }
  };

  // Sincronização automática com a nuvem Firestore ao abrir/autenticar (delta incremental + tempo real)
  useEffect(() => {
    if (!firebaseUser || !profile || profile.isSimulated || !hasLoadedDataset) return;

    let isActive = true;
    const SYNC_KEY = 'patrimonios_cloud_sync_at_v1';
    const sessionStartIso = new Date().toISOString();

    const syncInitialCloudDelta = async () => {
      try {
        const lastSyncAt = localStorage.getItem(SYNC_KEY);
        const colRef = collection(db, 'patrimonios');

        // Delta: somente o que mudou depois da ultima sincronizacao.
        // Consulta simples em um campo -> nao exige indice composto.
        if (lastSyncAt) {
          const snap = await getDocs(query(colRef, where('atualizadoEm', '>', lastSyncAt)));
          if (!isActive) return;

          const baixados: PatrimonioRecord[] = [];
          snap.forEach(d => {
            const raw = d.data() as PatrimonioRecord;
            baixados.push({ ...raw, id: raw.id || d.id });
          });

          if (baixados.length > 0) {
            handleMergeFromFirestore(baixados);
          }
        } else {
          // Primeira sincronizacao do dispositivo: percorre a colecao em paginas
          // de 400 documentos, ordenadas por id. Evita baixar os ~6.700 bens em
          // uma unica resposta (estoura memoria e conexao em celular) e usa
          // apenas o indice nativo de documento, sem exigir indice composto.
          const PAGE_SIZE = 400;
          const MAX_PAGINAS = 60;
          let cursor: string | undefined = undefined;
          let ultimaPagina: string | undefined;
          let pagina = 0;

          do {
            const q = cursor
              ? query(colRef, orderBy(documentId()), startAfter(cursor), limit(PAGE_SIZE))
              : query(colRef, orderBy(documentId()), limit(PAGE_SIZE));
            const snap = await getDocs(q);
            if (!isActive) return;
            if (snap.empty) break;

            const baixados: PatrimonioRecord[] = [];
            snap.forEach(d => {
              const raw = d.data() as PatrimonioRecord;
              baixados.push({ ...raw, id: raw.id || d.id });
              ultimaPagina = d.id;
            });
            if (baixados.length > 0) {
              handleMergeFromFirestore(baixados);
            }
            cursor = ultimaPagina;
            pagina += 1;
          } while (pagina < MAX_PAGINAS && ultimaPagina);
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

    // Listeners em tempo real para mudanças feitas por outros aparelhos durante a sessão
    const unsubPatrimonios = onSnapshot(
      query(collection(db, 'patrimonios'), where('atualizadoEm', '>', sessionStartIso)),
      (snapshot) => {
        if (!isActive || snapshot.empty) return;
        const alterados: PatrimonioRecord[] = [];
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added' || change.type === 'modified') {
            const raw = change.doc.data() as PatrimonioRecord;
            alterados.push({ ...raw, id: raw.id || change.doc.id });
          }
        });
        if (alterados.length > 0) {
          handleMergeFromFirestore(alterados);
          try {
            localStorage.setItem(SYNC_KEY, new Date().toISOString());
          } catch {}
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'patrimonios');
        } catch {}
      }
    );

    const unsubTransferencias = onSnapshot(
      query(collection(db, 'transferencias'), limit(300)),
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
      query(collection(db, 'vistorias'), limit(300)),
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

    const unsubAudit = onSnapshot(
      query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100)),
      (snapshot) => {
        if (!isActive || snapshot.empty) return;
        const cloudLogs: AuditLogEntry[] = [];
        snapshot.forEach(d => cloudLogs.push({ ...(d.data() as AuditLogEntry), id: d.id }));
        if (cloudLogs.length > 0) {
          setAuditLogs(prev => {
            const cloudIds = new Set(cloudLogs.map(l => l.id));
            const locaisRestantes = prev.filter(l => !cloudIds.has(l.id));
            return [...cloudLogs, ...locaisRestantes];
          });
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'auditLogs');
        } catch {}
      }
    );

    return () => {
      isActive = false;
      unsubPatrimonios();
      unsubTransferencias();
      unsubVistorias();
      unsubAudit();
    };
  }, [firebaseUser, profile?.uid, profile?.isSimulated, hasLoadedDataset]);

  // Ao abrir via link direto do QR Code (?etiqueta=466), abrir automaticamente a ficha do bem após login e carregamento da base
  useEffect(() => {
    if (!profile || !hasLoadedDataset || !pendingQrEtiqueta || patrimonios.length === 0) return;

    const achado = findPatrimonioByCodigo(patrimonios, pendingQrEtiqueta);
    setActiveTab('patrimonios');
    if (achado) {
      setInitialBemToOpen(achado);
    }
    setPendingQrEtiqueta(null);

    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [profile, hasLoadedDataset, pendingQrEtiqueta, patrimonios]);

  const handleToggleChecklist = (stepId: number, itemIndex: number) => {
    setSteps(prev => prev.map(s => {
      if (s.id === stepId) {
        const newChecklist = [...s.checklist];
        newChecklist[itemIndex] = {
          ...newChecklist[itemIndex],
          completed: !newChecklist[itemIndex].completed
        };
        const allCompleted = newChecklist.every(c => c.completed);
        return {
          ...s,
          checklist: newChecklist,
          status: allCompleted ? 'completed' : 'in_progress'
        };
      }
      return s;
    }));
  };

  const handleAddAuditLog = (entry: AuditLogEntry) => {
    setAuditLogs(prev => [entry, ...prev]);

    // Persistir trilha de auditoria no Firestore se online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setDoc(doc(db, 'auditLogs', entry.id), {
        id: entry.id,
        timestamp: entry.timestamp,
        category: entry.category,
        severity: entry.severity,
        title: entry.title,
        description: entry.description,
        entityAffected: entry.entityAffected || '',
        author: entry.author
      }).catch(err => console.warn('Erro ao salvar auditoria no Firestore:', err));
    }
  };

  const handleSyncComplete = () => {
    setPatrimonios(prev => prev.map(p => ({ ...p, isOfflinePending: false })));
    setTransferencias(prev => prev.map(t => ({ ...t, isOfflinePending: false })));
    setVistorias(prev => prev.map(v => ({ ...v, isOfflinePending: false })));
  };

  const handleAddPatrimonio = (p: PatrimonioRecord) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const nowIso = new Date().toISOString();
    const normalized = normalizePatrimonioRecord({
      ...p,
      dataCadastro: p.dataCadastro || new Date().toISOString(),
      atualizadoEm: nowIso
    });
    const recordToAdd: PatrimonioRecord = {
      ...normalized,
      isOfflinePending: isOffline
    };

    // Gravar no cache local também para garantir persistência imediata mesmo em reloads
    try {
      const saved = localStorage.getItem('patrimonios_edicoes_capanema_v3');
      const edits = saved ? JSON.parse(saved) : {};
      edits[normalized.id] = normalized;
      if (normalized.etiquetaNumero) edits[`etq_${normalized.etiquetaNumero}`] = normalized;
      localStorage.setItem('patrimonios_edicoes_capanema_v3', JSON.stringify(edits));
    } catch {}

    if (isOffline) {
      addPendingItem({
        type: 'patrimonio',
        action: 'create',
        payload: recordToAdd
      });
    } else {
      // Sincronizar em tempo real com o Firestore no projeto oficial.
      // O payload usa o mesmo serializador do caminho offline (offlineSyncManager),
      // garantindo que o documento gravado seja identico nos dois casos.
      setDoc(doc(db, 'patrimonios', normalized.id), toFirestorePatrimonio(normalized, nowIso)).catch(err => {
        console.warn('Erro ao persistir patrimônio no Firestore:', err);
        try {
          handleFirestoreError(err, OperationType.CREATE, 'patrimonios');
        } catch {}
      });
    }

    setPatrimonios(prev => [recordToAdd, ...prev]);
    handleAddAuditLog({
      id: `log-${Date.now().toString(36)}`,
      timestamp: nowIso.replace('T', ' ').substring(0, 19),
      category: 'Tabelas & Esquema',
      severity: isOffline ? 'warning' : 'conversion',
      title: `${isOffline ? '[OFFLINE] ' : ''}Novo Tombamento: ${normalized.etiquetaNumero || normalized.numeroTombamento}`,
      description: `Inclusão do bem "${normalized.descricao}" na ${normalized.secretariaSetor} sob a guarda de ${normalized.responsavel}.${isOffline ? ' (Salvo localmente no dispositivo para envio automático ao reconectar)' : ' [Sincronizado na Nuvem]'}` ,
      entityAffected: `Patrimonios: ${normalized.etiquetaNumero || normalized.numeroTombamento}`,
      author: isOffline ? 'Operador DPP (Em Campo / Offline)' : (profile?.nome || 'Operador DPP'),
      afterState: `Etiqueta: ${normalized.etiquetaNumero || normalized.numeroTombamento} | R$ ${normalized.valorAquisicao}${isOffline ? ' [Aguardando Sincronização]' : ' [Nuvem Ativa]'}`
    });
  };

  const handleUpdatePatrimonio = (p: PatrimonioRecord) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const nowIso = new Date().toISOString();
    const updated = normalizePatrimonioRecord({
      ...p,
      atualizadoEm: nowIso,
      isOfflinePending: isOffline
    });

    // 1. Atualizar imediatamente o estado em memória no React
    setPatrimonios(prev => prev.map(item => (item.id === updated.id || (updated.etiquetaNumero && item.etiquetaNumero === updated.etiquetaNumero)) ? { ...item, ...updated } : item));

    // 2. Gravar no localStorage para que a edição nunca se perca ao recarregar
    try {
      const saved = localStorage.getItem('patrimonios_edicoes_capanema_v3');
      const edits = saved ? JSON.parse(saved) : {};
      edits[updated.id] = updated;
      if (updated.etiquetaNumero) edits[`etq_${updated.etiquetaNumero}`] = updated;
      localStorage.setItem('patrimonios_edicoes_capanema_v3', JSON.stringify(edits));
    } catch (e) {
      console.warn('Erro ao salvar edição localmente:', e);
    }

    // 3. Atualizar no Firestore (ou enfileirar se offline)
    if (isOffline) {
      addPendingItem({
        type: 'patrimonio',
        action: 'update',
        payload: updated
      });
    } else {
      setDoc(doc(db, 'patrimonios', updated.id), toFirestorePatrimonio(updated, nowIso), { merge: true }).catch(err => {
        console.warn('Erro ao atualizar no Firestore:', err);
        try {
          handleFirestoreError(err, OperationType.UPDATE, 'patrimonios');
        } catch {}
      });
    }
  };

  const handleAddTransferencia = (t: TransferenciaRecord) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const recordToAdd: TransferenciaRecord = {
      ...t,
      isOfflinePending: isOffline
    };

    if (isOffline) {
      addPendingItem({
        type: 'transferencia',
        action: 'create',
        payload: recordToAdd
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
      afterState: `Guia emitida com termo de responsabilidade${isOffline ? ' [Pendente]' : ''}`
    });
  };

  const handleAddVistoria = (v: VistoriaRecord) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const recordToAdd: VistoriaRecord = {
      ...v,
      isOfflinePending: isOffline
    };

    if (isOffline) {
      addPendingItem({
        type: 'vistoria',
        action: 'create',
        payload: recordToAdd
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
      afterState: `Status conferido: ${v.statusEncontrado}`
    });
  };

  const handleLoadSample = () => {
    setPatrimonios(INITIAL_PATRIMONIOS);
    setTransferencias(INITIAL_TRANSFERENCIAS);
    setVistorias(INITIAL_VISTORIAS);
    setTables(DEMO_SAMPLE_TABLES);
    setActions(DEMO_SAMPLE_ACTIONS);
    setBots(DEMO_SAMPLE_BOTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    alert('Dados oficiais do Patrimônios Capanema carregados para referência!');
  };

  const handleExportDiagnosticReport = () => {
    const report = `# RELATÓRIO DE DIAGNÓSTICO E PLANO DE MIGRAÇÃO APPSHEET -> WEB MODERNA
Gerado em: ${new Date().toLocaleString('pt-BR')}

## 1. TABELAS IDENTIFICADAS (${tables.length})
${tables.map(t => `### Tabela: ${t.name} (Chave: ${t.primaryKey}, Origem: ${t.sheetSource || 'Planilha'})
- Colunas:
${t.columns.map(c => `  * ${c.name} [Tipo AppSheet: ${c.type}${c.isKey ? ' | PRIMARY KEY' : ''}${c.isRequired ? ' | OBRIGATÓRIO' : ''}${c.isVirtual ? ' | COLUNA VIRTUAL' : ''}${c.refTable ? ` | REF: ${c.refTable}` : ''}${c.appFormula ? ` | FORMULA: ${c.appFormula}` : ''}]`).join('\n')}
`).join('\n')}

## 2. AÇÕES DE BOTÃO (${actions.length})
${actions.map(a => `- **${a.name}** (Tabela: ${a.targetTable}) -> ${a.details} [Condição: ${a.condition || 'Nenhuma'}]`).join('\n')}

## 3. BOTS E AUTOMAÇÕES (${bots.length})
${bots.map(b => `- **${b.name}** (Tabela: ${b.targetTable}, Gatilho: ${b.eventTrigger})
  Tarefas:
${b.tasks.map(tsk => `    * [${tsk.type}] ${tsk.description}`).join('\n')}`).join('\n')}

## 4. ARQUITETURA PROPOSTA
- Banco de Dados Selecionado: ${selectedArchitecture.toUpperCase()}
- Frontend: React + TypeScript + Tailwind CSS
- Autenticação: Controle RBAC com verificação de email / sessão
- Integridade: Preservação de IDs originais e chaves de relacionamento sem perda de dados

## 5. HISTÓRICO DE AUDITORIA E DECISÕES (${auditLogs.length})
${auditLogs.map(l => `- [${l.timestamp}] **${l.title}** (${l.category} - ${l.severity.toUpperCase()})
  Responsável: ${l.author}
  ${l.description}
  ${l.technicalRationale ? `Justificativa: ${l.technicalRationale}` : ''}
`).join('\n')}
`;

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagnostico-migracao-appsheet.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#080c44] via-[#101962] to-[#060824] flex flex-col items-center justify-center text-white font-sans p-4">
        <div className="relative">
          <div className="h-24 w-24 rounded-2xl bg-[#1e1b4b] border border-blue-400/40 p-2 shadow-2xl mb-4 flex items-center justify-center">
            <img 
              src="/assets/aistudio/brasao_capanema_limpo.png" 
              alt="Prefeitura de Capanema - Pará" 
              className="h-full w-auto object-contain animate-pulse"
            />
          </div>
          <div className="w-4 h-4 rounded-full bg-blue-500 animate-ping absolute -top-1 -right-1" />
        </div>
        <div className="text-base font-bold tracking-tight text-white mt-2">
          Carregando Sistema de Patrimônio...
        </div>
        <div className="text-xs text-blue-200/70 mt-1">
          Prefeitura Municipal de Capanema • Diretoria de Patrimônio Público (DPP)
        </div>
      </div>
    );
  }

  // TRAVA DE SEGURANÇA: Se não estiver autenticado, exibe a tela oficial de login da Prefeitura
  if (!profile) {
    return <LoginScreen scannedBem={scannedBemPreview} scannedCodigo={pendingQrEtiqueta} />;
  }

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 font-sans flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[58px] py-2 sm:py-0 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 sm:h-13 sm:w-13 rounded-xl bg-[#1e1b4b] border border-blue-400/40 p-1 flex items-center justify-center shadow-md shrink-0">
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
            <div className="hidden sm:block">
              <SyncStatusBadge onSyncComplete={handleSyncComplete} />
            </div>
            
            <PWAInstallButton />

            {isAdmin && (
              <>
                <button
                  onClick={() => setShowDataImporter(true)}
                  className="hidden lg:inline-flex px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-sm items-center gap-1.5 transition-colors"
                  title="Importar dados do Google Sheets ou CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Validar Dados</span>
                </button>

                <button
                  onClick={handleExportDiagnosticReport}
                  className="hidden md:inline-flex px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg items-center gap-1.5 transition-colors"
                  title="Baixar Relatório de Diagnóstico em Markdown"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs (Ferramentas técnicas visíveis apenas para Administradores Gerais da DPP) */}
        {isAdmin && (
          <div className="w-full max-w-full overflow-x-auto border-t border-slate-800/80 text-xs py-1 sm:py-0 scrollbar-none">
            <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 flex space-x-1 w-max">
            {[
              { id: 'analise', label: 'Análise Patrimonios_AppSheet', icon: BarChart3, badge: `${patrimonios.length.toLocaleString('pt-BR')} Bens` },
              { id: 'patrimonios', label: 'Gestão de Patrimônios (DPP)', icon: Building2, badge: `${patrimonios.length}` },
              { id: 'checklist', label: '1. Diagnóstico & Dashboard', icon: ClipboardCheck },
              { id: 'schema', label: '2. Tabelas & Esquema', icon: Database, badge: `${tables.length}` },
              { id: 'formulas', label: '3. Fórmulas & Expressões', icon: Calculator },
              { id: 'automations', label: '4. Bots & Automações', icon: Bot, badge: `${bots.length}` },
              { id: 'architecture', label: '5. Planejamento de Arquitetura', icon: Layers },
              { id: 'audit', label: '6. Auditoria de Migração', icon: History, badge: `${auditLogs.length}` },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-3.5 font-medium whitespace-nowrap border-b-2 flex items-center gap-2 transition-all ${
                    isActive
                      ? 'border-indigo-400 text-indigo-300 bg-slate-800/60 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      tab.id === 'analise' 
                        ? 'bg-indigo-500 text-white font-bold'
                        : isActive ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
            </div>
          </div>
        )}
      </header>

      {/* Barra de Autenticação RBAC e Conexão em Nuvem Firestore */}
      <UserAuthBar />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-8 flex-1 w-full max-w-full overflow-x-hidden">
        {activeTab === 'patrimonios' && (
          <PatrimoniosManager
            patrimonios={patrimonios}
            transferencias={transferencias}
            vistorias={vistorias}
            onAddPatrimonio={handleAddPatrimonio}
            onUpdatePatrimonio={handleUpdatePatrimonio}
            onAddTransferencia={handleAddTransferencia}
            onAddVistoria={handleAddVistoria}
            onUpdateDatasetFromFirestore={handleMergeFromFirestore}
            initialBemToOpen={initialBemToOpen}
            onConsumeInitialBem={() => setInitialBemToOpen(null)}
          />
        )}

        {activeTab !== 'patrimonios' && (
          <Suspense
            fallback={
              <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Carregando módulo técnico...</span>
              </div>
            }
          >
            {activeTab === 'analise' && (
              <AppSheetAuditReport onNavigateToTab={(tab) => setActiveTab(tab as any)} />
            )}

            {activeTab === 'checklist' && (
              <div className="space-y-6">
                <MigrationDashboard
                  steps={steps}
                  tables={tables}
                  actions={actions}
                  bots={bots}
                  selectedArchitecture={selectedArchitecture}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
                <DiagnosticChecklist
                  steps={steps}
                  onToggleChecklist={handleToggleChecklist}
                  onOpenSchemaTab={() => setActiveTab('schema')}
                  onOpenArchitectureTab={() => setActiveTab('architecture')}
                />
              </div>
            )}

            {activeTab === 'schema' && (
              <SchemaManager
                tables={tables}
                onUpdateTables={setTables}
                onLoadSample={handleLoadSample}
              />
            )}

            {activeTab === 'formulas' && (
              <FormulaConverter />
            )}

            {activeTab === 'automations' && (
              <AutomationMapper
                actions={actions}
                bots={bots}
                onUpdateActions={setActions}
                onUpdateBots={setBots}
              />
            )}

            {activeTab === 'architecture' && (
              <ArchitectureAdvisor
                selectedArchitecture={selectedArchitecture}
                onSelectArchitecture={setSelectedArchitecture}
              />
            )}

            {activeTab === 'audit' && (
              <MigrationAuditLog
                logs={auditLogs}
                onAddLog={handleAddAuditLog}
              />
            )}
          </Suspense>
        )}
      </main>

      {/* Modal Importador de Dados */}
      {showDataImporter && (
        <Suspense fallback={null}>
          <DataImporterModal
            tables={tables}
            onClose={() => setShowDataImporter(false)}
          />
        </Suspense>
      )}

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
