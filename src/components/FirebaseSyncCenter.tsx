import React, { useState, useEffect } from 'react';
import { 
  Cloud, CloudUpload, CloudDownload, CheckCircle2, AlertTriangle, 
  RefreshCw, Database, ShieldCheck, Zap, Lock, HardDrive, 
  ExternalLink, Layers, ArrowRight, Play, Pause, Check, X
} from 'lucide-react';
import { db, testConnection, handleFirestoreError, OperationType } from '../services/firebase';
import { collection, writeBatch, doc, getDocs, limit, query, getCountFromServer } from 'firebase/firestore';
import { PatrimonioRecord } from '../types/appsheet';
import { CLOUD_SYNC_CURSOR_KEY } from '../utils/datasetCache';
import { useAuth } from '../context/AuthContext';
import { formatCadastroDate } from '../utils/patrimonioFormatters';
import firebaseConfig from '../../firebase-applet-config.json';

interface Props {
  patrimonios: PatrimonioRecord[];
  onUpdateDatasetFromFirestore?: (bens: PatrimonioRecord[]) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const FirebaseSyncCenter: React.FC<Props> = ({
  patrimonios,
  onUpdateDatasetFromFirestore,
  isOpen = false,
  onClose
}) => {
  const { profile, firebaseUser, loginGoogle } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [remoteCount, setRemoteCount] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState<boolean>(false);

  // Estados de Upload em Lote (Bulk Upload)
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const [totalToUpload, setTotalToUpload] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [batchStatusText, setBatchStatusText] = useState<string>('');

  // Estados de Download
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Testar conexão ao abrir
  useEffect(() => {
    verificarConexao();
  }, []);

  const verificarConexao = async () => {
    setIsTesting(true);
    try {
      const ok = await testConnection();
      setIsConnected(ok);
      await contarDocumentosFirestore();
    } catch (e) {
      console.warn('Erro ao testar conexão Firestore:', e);
      setIsConnected(false);
    } finally {
      setIsTesting(false);
    }
  };

  const contarDocumentosFirestore = async () => {
    setIsCounting(true);
    try {
      const colRef = collection(db, 'patrimonios');
      const snap = await getCountFromServer(colRef);
      setRemoteCount(snap.data().count);
    } catch (e) {
      console.warn('Erro ao contar documentos remotos:', e);
    } finally {
      setIsCounting(false);
    }
  };

  // Executar Carga em Lote (Chunks de 250 itens por commit do writeBatch)
  const handleExecutarCargaEmLote = async () => {
    if (patrimonios.length === 0) return;
    
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    setUploadedCount(0);
    setTotalToUpload(patrimonios.length);
    setUploadProgress(0);

    const BATCH_SIZE = 250;
    const total = patrimonios.length;

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = patrimonios.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        setBatchStatusText(`Preparando lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(total / BATCH_SIZE)} (${chunk.length} bens)...`);

        for (const bem of chunk) {
          // Document ID: usando id original ou número de tombamento sanitizado
          const docId = bem.id ? String(bem.id) : `tombo_${bem.numeroTombamento.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          const docRef = doc(db, 'patrimonios', docId);
          const numReal = bem.etiquetaNumero || bem.numeroTombamento || docId;
          const localReal = bem.local || bem.localizacaoExata || 'Sede / Geral';

          // Payload sanitizado em conformidade com as regras e esquema do Firestore
          const payload = {
            id: docId,
            etiquetaNumero: numReal,
            numeroTombamento: numReal,
            descricao: bem.descricao,
            categoria: bem.categoria || 'Geral',
            secretariaSetor: bem.secretariaSetor,
            local: localReal,
            localizacaoExata: localReal,
            departamento: bem.departamento || 'Setor Geral',
            responsavel: bem.responsavel || 'A Definir',
            servidorDetentor: bem.servidorDetentor || '',
            marcaModelo: bem.marcaModelo || '',
            numeroSerie: bem.numeroSerie || '',
            estadoConservacao: bem.estadoConservacao || 'Bom',
            status: bem.status || 'Ativo / Em Uso',
            valorAquisicao: Number(bem.valorAquisicao) || 0,
            dataAquisicao: bem.dataAquisicao || '',
            numeroNotaFiscal: bem.numeroNotaFiscal || '',
            garantiaAte: bem.garantiaAte || '',
            fotoBem: bem.fotoBem || '',
            observacoes: bem.observacoes || '',
            origemDados: 'Migração AppSheet Capanema',
            dataCadastro: bem.dataCadastro || formatCadastroDate(bem.atualizadoEm, false),
            atualizadoEm: new Date().toISOString()
          };

          batch.set(docRef, payload, { merge: true });
        }

        setBatchStatusText(`Enviando lote ${Math.floor(i / BATCH_SIZE) + 1} ao Firestore...`);
        await batch.commit();

        const currentCount = Math.min(total, i + BATCH_SIZE);
        setUploadedCount(currentCount);
        setUploadProgress(Math.round((currentCount / total) * 100));

        // Pequeno intervalo para liberar o event loop e atualizar a barra de progresso no navegador
        await new Promise(res => setTimeout(res, 40));
      }

      try {
        localStorage.setItem(CLOUD_SYNC_CURSOR_KEY, new Date().toISOString());
      } catch {}

      setUploadSuccess(true);
      setBatchStatusText('Carga em lote finalizada com sucesso!');
      await contarDocumentosFirestore();
    } catch (err: unknown) {
      console.error('Erro na carga em lote:', err);
      setUploadError(err instanceof Error ? err.message : 'Falha durante o envio dos lotes ao Firestore.');
      try {
        handleFirestoreError(err, OperationType.WRITE, 'patrimonios');
      } catch {
        // Ignora rethrow local para manter UI funcional
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Baixar todos os registros atualizados do Firestore para a aplicação
  const handleBaixarDoFirestore = async () => {
    setIsDownloading(true);
    try {
      const snap = await getDocs(collection(db, 'patrimonios'));
      const baixados: PatrimonioRecord[] = [];
      snap.forEach(d => {
        const raw = d.data() as PatrimonioRecord;
        const numReal = raw.etiquetaNumero || raw.numeroTombamento || raw.id || d.id;
        const localReal = raw.local || raw.localizacaoExata || 'Sede / Geral';
        baixados.push({
          ...raw,
          id: raw.id || d.id,
          etiquetaNumero: numReal,
          numeroTombamento: numReal,
          local: localReal,
          localizacaoExata: localReal,
          departamento: raw.departamento || 'Setor Geral'
        });
      });

      if (baixados.length > 0 && onUpdateDatasetFromFirestore) {
        onUpdateDatasetFromFirestore(baixados);
        try {
          localStorage.setItem(CLOUD_SYNC_CURSOR_KEY, new Date().toISOString());
        } catch {}
        await contarDocumentosFirestore();
        alert(`${baixados.length.toLocaleString('pt-BR')} patrimônios sincronizados diretamente da nuvem!`);
      } else {
        alert('Nenhum registro encontrado na nuvem ainda. Use "Iniciar Carga em Lote" acima para enviar a base inicial.');
      }
    } catch (err) {
      console.error('Erro ao baixar do Firestore:', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'patrimonios');
      } catch {}
      alert('Erro ao consultar a nuvem. Verifique se você está logado com sua conta Google institucional.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Central de Sincronização Firebase Firestore</h2>
                <span className="bg-blue-500/20 text-blue-300 text-[11px] px-2 py-0.5 rounded-full border border-blue-400/30 font-semibold">
                  Nuvem Ativa
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Banco de Dados NoSQL em Nuvem • Prefeitura Municipal de Capanema
              </p>
            </div>
          </div>

          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          
          {/* Status do Projeto e Conexão */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status da Conexão</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {isConnected ? 'Conectado à Nuvem' : (isTesting ? 'Verificando...' : 'Reconectando')}
                </div>
                <button
                  type="button"
                  onClick={verificarConexao}
                  className="mt-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                  Testar Novamente
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
              <Database className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Coleção Remota</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                  {remoteCount !== null ? `${remoteCount.toLocaleString('pt-BR')} docs` : (isCounting ? 'Contando...' : 'patrimonios')}
                </div>
                <span className="text-[10px] text-slate-500 truncate block">
                  BD: {firebaseConfig.firestoreDatabaseId.slice(0, 20)}...
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Autenticação</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                  {firebaseUser ? (firebaseUser.email || 'Usuário Google') : (profile ? profile.nome : 'Modo Local')}
                </div>
                {!firebaseUser && (
                  <button
                    type="button"
                    onClick={loginGoogle}
                    className="mt-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
                  >
                    Login com Google
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card Principal: Carga em Lote (Passo 2) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CloudUpload className="w-5 h-5 text-blue-600" />
                  Carga em Lote dos {patrimonios.length.toLocaleString('pt-BR')} Bens no Firestore
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Envia todos os bens migrados do AppSheet diretamente para o Firestore em lotes atômicos de 250 registros.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExecutarCargaEmLote}
                disabled={isUploading}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 active:scale-95"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enviando ({uploadedCount}/{totalToUpload})...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Iniciar Carga em Lote ({patrimonios.length} bens)
                  </>
                )}
              </button>
            </div>

            {/* Barra de Progresso Durante Carga */}
            {isUploading && (
              <div className="space-y-2 pt-2 border-t border-blue-200/60">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-950">
                  <span>{batchStatusText}</span>
                  <span className="font-mono text-sm">{uploadProgress}%</span>
                </div>
                <div className="w-full h-3 bg-blue-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-200 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between font-mono">
                  <span>Enviados: {uploadedCount.toLocaleString('pt-BR')} itens</span>
                  <span>Restantes: {(totalToUpload - uploadedCount).toLocaleString('pt-BR')} itens</span>
                </div>
              </div>
            )}

            {/* Mensagem de Sucesso */}
            {uploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <strong>Carga Concluída:</strong> Todos os bens foram sincronizados e armazenados com sucesso no Firestore da Prefeitura de Capanema!
                </span>
              </div>
            )}

            {/* Mensagem de Erro */}
            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <strong>Erro na Sincronização:</strong> {uploadError}
                  <p className="text-[10px] text-rose-700 mt-0.5">
                    Dica: Faça login com Google no canto superior ou verifique se as regras de segurança permitem escrita.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Opções de Download / Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CloudDownload className="w-4 h-4 text-slate-600" />
              Sincronização Inversa (Baixar do Firestore)
            </h4>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Atualiza os dados locais com as últimas alterações salvas na nuvem por outros operadores ou auditores em campo.
              </p>
              <button
                type="button"
                onClick={handleBaixarDoFirestore}
                disabled={isDownloading}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold shrink-0 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDownloading ? 'animate-spin' : ''}`} />
                Atualizar da Nuvem
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono text-[11px]">
            Projeto: <strong>{firebaseConfig.projectId}</strong>
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold"
            >
              Fechar
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
