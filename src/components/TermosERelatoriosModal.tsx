import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, Printer, Check, X, Building2, User, 
  Calendar, Shield, AlertCircle, ChevronDown, Download,
  Layers, Filter, ArrowRightLeft, DollarSign, CheckCircle2,
  TrendingUp, Send, FileSpreadsheet, ListFilter, MapPin
} from 'lucide-react';
import { PatrimonioRecord, TransferenciaRecord } from '../types/appsheet';
import { GERENTES_LIST } from './AppSheetPatrimonioForm';
import { gerarRelatorioPdfTombamentoDescricao } from '../utils/pdfRelatorioSimplificado';
import { MultiDepartamentoSelector } from './MultiDepartamentoSelector';
import { MultiLocalSelector } from './MultiLocalSelector';
import { useAuth } from '../context/AuthContext';

export type TipoDocumentoOficial = 
  | 'termo_cautela' 
  | 'termo_transferencia' 
  | 'relatorio_tcm' 
  | 'relatorio_simplificado';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patrimonios: PatrimonioRecord[];
  transferencias: TransferenciaRecord[];
  initialTipo?: TipoDocumentoOficial;
  initialSecretaria?: string;
  initialLocal?: string;
  initialLocais?: string[];
  initialDepartamento?: string;
  initialDepartamentos?: string[];
}

export const TermosERelatoriosModal: React.FC<Props> = ({
  isOpen,
  onClose,
  patrimonios,
  transferencias,
  initialTipo = 'termo_cautela',
  initialSecretaria,
  initialLocal,
  initialLocais,
  initialDepartamento,
  initialDepartamentos
}) => {
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoOficial>(initialTipo);
  
  // Filtros de Secretaria e Responsável (Origem / Fiel Depositário)
  const [secretariaSelecionada, setSecretariaSelecionada] = useState<string>(
    initialSecretaria && initialSecretaria !== 'Todas' 
      ? initialSecretaria 
      : 'SECRETARIA DE EDUCAÇÃO'
  );
  const [departamentosSelecionados, setDepartamentosSelecionados] = useState<string[]>(() => {
    if (initialDepartamentos && initialDepartamentos.length > 0) return initialDepartamentos;
    if (initialDepartamento && initialDepartamento !== 'Todos') return [initialDepartamento];
    return [];
  });
  const [modoOrganizacao, setModoOrganizacao] = useState<'continuo' | 'separado'>('continuo');
  const [previewDeptoIndex, setPreviewDeptoIndex] = useState<number>(0);
  const { profile } = useAuth();
  const [exibirColunaLocal, setExibirColunaLocal] = useState<boolean>(true);
  const [exibirColunaDepartamento, setExibirColunaDepartamento] = useState<boolean>(true);
  const [exibirColunaConservacao, setExibirColunaConservacao] = useState<boolean>(false);
  const [exibirColunaConferencia, setExibirColunaConferencia] = useState<boolean>(false);
  const [isPrintingAll, setIsPrintingAll] = useState<boolean>(false);

  useEffect(() => {
    const onBeforePrint = () => setIsPrintingAll(true);
    const onAfterPrint = () => setIsPrintingAll(false);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);
  const [nomeResponsavel, setNomeResponsavel] = useState<string>('WALCYLENE CARDOSO COSTA');
  const [matriculaOuCpf, setMatriculaOuCpf] = useState<string>('Matrícula: 1042-8');
  const [cargoResponsavel, setCargoResponsavel] = useState<string>('Chefe de Departamento / Gerente de Patrimônio');
  const [localizacaoSetor, setLocalizacaoSetor] = useState<string>('Almoxarifado Central e Sala da Chefia');

  // Sincronizar quando initialTipo, initialSecretaria, initialLocais ou initialDepartamentos mudarem ao abrir
  useEffect(() => {
    if (initialTipo) {
      setTipoDocumento(initialTipo);
    }
    if (initialSecretaria && initialSecretaria !== 'Todas') {
      setSecretariaSelecionada(initialSecretaria);
      const gerente = GERENTES_LIST.find(g => g.secretaria === initialSecretaria);
      if (gerente) {
        setNomeResponsavel(gerente.nome);
      }
    }
    if (initialLocais && initialLocais.length > 0) {
      setLocaisSelecionados(initialLocais);
    } else if (initialLocal && initialLocal !== 'Todos') {
      setLocaisSelecionados([initialLocal]);
    } else if (isOpen) {
      setLocaisSelecionados([]);
    }
    if (initialDepartamentos && initialDepartamentos.length > 0) {
      setDepartamentosSelecionados(initialDepartamentos);
      setPreviewDeptoIndex(0);
    } else if (initialDepartamento) {
      setDepartamentosSelecionados(initialDepartamento === 'Todos' ? [] : [initialDepartamento]);
      setPreviewDeptoIndex(0);
    }
  }, [initialTipo, initialSecretaria, initialLocal, initialLocais, initialDepartamento, initialDepartamentos, isOpen]);
  
  // Dados Específicos para Transferência (Destino)
  const [secretariaDestino, setSecretariaDestino] = useState<string>('SECRETARIA DE EDUCAÇÃO');
  const [nomeResponsavelDestino, setNomeResponsavelDestino] = useState<string>('WALCYLENE CARDOSO COSTA');
  const [motivoTransferencia, setMotivoTransferencia] = useState<string>('Remanejamento setorial para atendimento da demanda operacional');
  const [numeroGuia, setNumeroGuia] = useState<string>(() => `2026/${Math.floor(100 + Math.random() * 900)}`);

  // Diretor de Patrimônio Público (DPP)
  const [nomeDiretorDpp, setNomeDiretorDpp] = useState<string>('Eliel da Silva Marques');
  const [cargoDiretorDpp, setCargoDiretorDpp] = useState<string>('Diretor de Patrimônio Público (DPP)');

  // Dados para Relatório TCM
  const [presidenteComissao, setPresidenteComissao] = useState<string>('Comissão Especial de Inventário Anual (Dec. PMC 018/2026)');

  // Bens selecionados para inclusão no termo
  const [selecionarTodos, setSelecionarTodos] = useState<boolean>(true);
  const [bensIdsSelecionados, setBensIdsSelecionados] = useState<string[]>([]);

  // Locais / Unidades selecionados ([] = Todos os Locais)
  const [locaisSelecionados, setLocaisSelecionados] = useState<string[]>(() => {
    if (initialLocais && initialLocais.length > 0) return initialLocais;
    if (initialLocal && initialLocal !== 'Todos') return [initialLocal];
    return [];
  });
  const [localDestino, setLocalDestino] = useState<string>('Sede Administrativa');

  // Atualizar responsável ao mudar secretaria de origem
  const handleSecretariaChange = (sec: string) => {
    setSecretariaSelecionada(sec);
    setLocaisSelecionados([]);
    setDepartamentosSelecionados([]);
    setPreviewDeptoIndex(0);
    const gerente = GERENTES_LIST.find(g => g.secretaria === sec);
    if (gerente) {
      setNomeResponsavel(gerente.nome);
    }
  };

  // Atualizar responsável de destino ao mudar secretaria de destino
  const handleSecretariaDestinoChange = (sec: string) => {
    setSecretariaDestino(sec);
    const gerente = GERENTES_LIST.find(g => g.secretaria === sec);
    if (gerente) {
      setNomeResponsavelDestino(gerente.nome);
    }
  };

  // Bens da secretaria selecionada (ou todos se for 'Todas')
  const bensDaSecretaria = secretariaSelecionada === 'Todas'
    ? patrimonios
    : patrimonios.filter(p => p.secretariaSetor === secretariaSelecionada);

  // Locais / Unidades disponíveis para a secretaria selecionada
  const locaisDisponiveis = useMemo(() => {
    const setLocs = new Set<string>();
    bensDaSecretaria.forEach(p => {
      const loc = (p.local || p.localizacaoExata || '').trim();
      if (loc) setLocs.add(loc);
    });
    return Array.from(setLocs).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [bensDaSecretaria]);

  // Contagem de bens por Local / Unidade
  const bensCountPorLocal = useMemo(() => {
    const map: Record<string, number> = {};
    bensDaSecretaria.forEach(p => {
      const loc = (p.local || p.localizacaoExata || '').trim();
      if (loc) {
        map[loc] = (map[loc] || 0) + 1;
      }
    });
    return map;
  }, [bensDaSecretaria]);

  // Bens filtrados pelos Locais selecionados
  const bensFiltradosPorLocais = useMemo(() => {
    if (locaisSelecionados.length === 0) return bensDaSecretaria;
    const locSet = new Set(locaisSelecionados.map(l => l.trim().toLowerCase()));
    return bensDaSecretaria.filter(p => locSet.has((p.local || p.localizacaoExata || '').trim().toLowerCase()));
  }, [bensDaSecretaria, locaisSelecionados]);

  // Departamentos disponíveis para a secretaria e locais selecionados
  const departamentosDisponiveis = useMemo(() => {
    const setDeps = new Set<string>();
    bensFiltradosPorLocais.forEach(p => {
      const dep = (p.departamento || '').trim();
      if (dep) setDeps.add(dep);
    });
    return Array.from(setDeps).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [bensFiltradosPorLocais]);

  // Contagem de bens por departamento
  const bensCountPorDepto = useMemo(() => {
    const map: Record<string, number> = {};
    bensFiltradosPorLocais.forEach(p => {
      const dep = (p.departamento || '').trim();
      if (dep) {
        map[dep] = (map[dep] || 0) + 1;
      }
    });
    return map;
  }, [bensFiltradosPorLocais]);

  // Departamento ativo no preview visual (em ordem alfabética quando múltiplos)
  const departamentosOrdenados = useMemo(() => {
    return [...departamentosSelecionados].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [departamentosSelecionados]);

  const deptoPreviewAtivo = departamentosOrdenados.length > 1
    ? (departamentosOrdenados[previewDeptoIndex] || departamentosOrdenados[0])
    : (departamentosOrdenados.length === 1 ? departamentosOrdenados[0] : null);

  // Comparadores oficiais para espelhar exatamente a ordenação do PDF exportado
  const compararTombamento = (a: PatrimonioRecord, b: PatrimonioRecord) => {
    const refA = (a.numeroTombamento || a.etiquetaNumero || '').replace(/\D/g, '');
    const refB = (b.numeroTombamento || b.etiquetaNumero || '').replace(/\D/g, '');
    const numA = parseInt(refA, 10);
    const numB = parseInt(refB, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return (a.numeroTombamento || a.etiquetaNumero || a.id).localeCompare(b.numeroTombamento || b.etiquetaNumero || b.id);
  };

  const ordenarPorLocalETombamento = (lista: PatrimonioRecord[]) => {
    return [...lista].sort((a, b) => {
      const locA = (a.local || a.localizacaoExata || 'Sede / Geral').trim();
      const locB = (b.local || b.localizacaoExata || 'Sede / Geral').trim();
      const cmpLoc = locA.localeCompare(locB, 'pt-BR', { sensitivity: 'base' });
      if (cmpLoc !== 0) return cmpLoc;
      return compararTombamento(a, b);
    });
  };

  const ordenarHierarquia = (lista: PatrimonioRecord[]) => {
    return [...lista].sort((a, b) => {
      const locA = (a.local || a.localizacaoExata || 'Sede / Geral').trim();
      const locB = (b.local || b.localizacaoExata || 'Sede / Geral').trim();
      const depA = (a.departamento || 'Setor Geral').trim();
      const depB = (b.departamento || 'Setor Geral').trim();

      if (exibirColunaLocal && locaisSelecionados.length !== 1) {
        const cmpLoc = locA.localeCompare(locB, 'pt-BR', { sensitivity: 'base' });
        if (cmpLoc !== 0) return cmpLoc;
        const cmpDep = depA.localeCompare(depB, 'pt-BR', { sensitivity: 'base' });
        if (cmpDep !== 0) return cmpDep;
      } else {
        const cmpDep = depA.localeCompare(depB, 'pt-BR', { sensitivity: 'base' });
        if (cmpDep !== 0) return cmpDep;
        const cmpLoc = locA.localeCompare(locB, 'pt-BR', { sensitivity: 'base' });
        if (cmpLoc !== 0) return cmpLoc;
      }

      return compararTombamento(a, b);
    });
  };

  const labelLocalResumo = locaisSelecionados.length === 0
    ? 'TODOS OS LOCAIS / UNIDADES'
    : locaisSelecionados.length === 1
    ? locaisSelecionados[0].toUpperCase()
    : `${locaisSelecionados.length} LOCAIS SELECIONADOS`;

  // Bens do relatório simplificado (filtrados por Secretaria, Locais e Departamento(s) em sequência hierárquica)
  const bensSimplificados = useMemo(() => {
    if (departamentosOrdenados.length === 0) {
      return ordenarHierarquia(bensFiltradosPorLocais);
    }
    if (departamentosOrdenados.length === 1) {
      return ordenarPorLocalETombamento(
        bensFiltradosPorLocais.filter(p => {
          const dep = (p.departamento || '').trim().toLowerCase();
          return dep === departamentosOrdenados[0].trim().toLowerCase();
        })
      );
    }
    // Múltiplos departamentos: no preview do modo separado mostramos a folha do departamento selecionado no alternador
    const target = deptoPreviewAtivo ? deptoPreviewAtivo.trim().toLowerCase() : '';
    return ordenarPorLocalETombamento(
      bensFiltradosPorLocais.filter(p => {
        const dep = (p.departamento || '').trim().toLowerCase();
        return dep === target;
      })
    );
  }, [bensFiltradosPorLocais, locaisSelecionados, departamentosOrdenados, deptoPreviewAtivo, exibirColunaLocal]);

  // Bens ordenados em lista única contínua (sem divisões) para múltiplos departamentos no modo contínuo
  const bensContinuosOrdenados = useMemo(() => {
    if (departamentosOrdenados.length === 0) {
      return ordenarHierarquia(bensFiltradosPorLocais);
    }
    const lowerSet = new Set(departamentosOrdenados.map(d => d.trim().toLowerCase()));
    const filtrados = bensFiltradosPorLocais.filter(p => {
      const dep = (p.departamento || '').trim().toLowerCase();
      return lowerSet.has(dep);
    });
    return ordenarHierarquia(filtrados);
  }, [bensFiltradosPorLocais, locaisSelecionados, departamentosOrdenados, exibirColunaLocal]);

  // Total geral de bens somando os departamentos selecionados
  const totalBensTodosDeptosSelecionados = useMemo(() => {
    if (departamentosOrdenados.length === 0) return bensFiltradosPorLocais.length;
    const lowerSet = new Set(departamentosOrdenados.map(d => d.trim().toLowerCase()));
    return bensFiltradosPorLocais.filter(p => {
      const dep = (p.departamento || '').trim().toLowerCase();
      return lowerSet.has(dep);
    }).length;
  }, [bensFiltradosPorLocais, departamentosOrdenados]);

  const bensFiltradosLocalTermo = useMemo(() => {
    return ordenarHierarquia(bensFiltradosPorLocais);
  }, [bensFiltradosPorLocais, locaisSelecionados, exibirColunaLocal]);

  const bensNoTermo = selecionarTodos 
    ? bensFiltradosLocalTermo.slice(0, 100) 
    : bensFiltradosLocalTermo.filter(b => bensIdsSelecionados.includes(b.id));

  const valorTotalTermo = bensNoTermo.reduce((acc, b) => acc + (Number(b.valorAquisicao) || 0), 0);

  // Estatísticas para o Relatório Consolidado do TCM
  const secretariasStats = useMemo(() => {
    const map: Record<string, { count: number; totalValor: number; emUso: number; inserviveis: number; locais: Set<string> }> = {};
    patrimonios.forEach(p => {
      const sec = p.secretariaSetor || 'Outros / Setor Geral';
      if (!map[sec]) {
        map[sec] = { count: 0, totalValor: 0, emUso: 0, inserviveis: 0, locais: new Set<string>() };
      }
      map[sec].count += 1;
      map[sec].totalValor += Number(p.valorAquisicao || 0);
      const loc = (p.local || p.localizacaoExata || '').trim();
      if (loc) map[sec].locais.add(loc);
      if (p.estadoConservacao === 'Inservível / Ocioso' || p.estadoConservacao === 'Ruim / Danificado') {
        map[sec].inserviveis += 1;
      } else {
        map[sec].emUso += 1;
      }
    });

    return Object.entries(map).map(([nome, data]) => ({
      nome,
      count: data.count,
      totalValor: data.totalValor,
      emUso: data.emUso,
      inserviveis: data.inserviveis,
      locaisCount: data.locais.size,
      pct: (data.count / (patrimonios.length || 1)) * 100
    })).sort((a, b) => b.count - a.count);
  }, [patrimonios]);

  const totalGeralBens = patrimonios.length;
  const totalGeralValor = patrimonios.reduce((acc, b) => acc + (Number(b.valorAquisicao) || 0), 0);
  const totalBensEmUso = patrimonios.filter(p => p.estadoConservacao !== 'Inservível / Ocioso' && p.estadoConservacao !== 'Ruim / Danificado').length;
  const totalBensInserviveis = totalGeralBens - totalBensEmUso;
  const totalLocaisUnidades = useMemo(() => {
    const set = new Set<string>();
    patrimonios.forEach(p => {
      const l = (p.local || p.localizacaoExata || '').trim();
      if (l) set.add(l);
    });
    return set.size;
  }, [patrimonios]);

  const handleImprimir = () => {
    setIsPrintingAll(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  const handleBaixarPdf = async () => {
    await gerarRelatorioPdfTombamentoDescricao({
      secretaria: secretariaSelecionada,
      locais: locaisSelecionados,
      departamento: departamentosSelecionados.length === 1 ? departamentosSelecionados[0] : (departamentosSelecionados.length === 0 ? 'Todos' : undefined),
      departamentos: departamentosSelecionados,
      modoOrganizacao,
      incluirColunaLocal: exibirColunaLocal,
      incluirColunaDepartamento: exibirColunaDepartamento,
      incluirColunaConservacao: exibirColunaConservacao,
      incluirColunaConferencia: exibirColunaConferencia,
      patrimonios,
      nomeDiretorDpp,
      cargoDiretorDpp,
      nomeEmissor: profile?.nome || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:static print:inset-auto print:block print:bg-white print:p-0 print:overflow-visible">
      {/* Estilos específicos de impressão para folhas A4 oficiais (sem position:fixed para não repetir página 1) */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 14mm 10mm;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > #root *:not(:has(#termo-print-area)):not(#termo-print-area):not(#termo-print-area *) {
            display: none !important;
          }
          *:has(> #termo-print-area),
          *:has(#termo-print-area) {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            display: block !important;
          }
          #termo-print-area {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          #termo-print-area table {
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1px solid #1e293b !important;
          }
          #termo-print-area thead {
            display: table-header-group !important;
          }
          #termo-print-area tfoot {
            display: table-row-group !important;
          }
          #termo-print-area tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:h-auto print:overflow-visible print:shadow-none print:border-0 print:rounded-none print:block">
        
        {/* Header do Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-[#080c44] to-slate-950 text-white flex items-center justify-between shrink-0 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Emissão de Termos e Relatórios Oficiais</h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-400/30 font-semibold">
                  Lei 4.320/64 • TCM/PA
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Prefeitura Municipal de Capanema • Diretoria de Patrimônio Público (DPP)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setExibirColunaLocal(prev => !prev)}
              className={`px-2.5 py-2 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                exibirColunaLocal
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
              title="Clique para incluir ou ocultar Local / Unidade no relatório"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Local: {exibirColunaLocal ? 'Sim' : 'Não'}</span>
            </button>

            {tipoDocumento === 'relatorio_simplificado' && (
              <>
                <button
                  type="button"
                  onClick={() => setExibirColunaConservacao(prev => !prev)}
                  className={`px-2.5 py-2 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                    exibirColunaConservacao
                      ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                  }`}
                  title="Incluir coluna de Estado de Conservação no relatório"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Estado: {exibirColunaConservacao ? 'Sim' : 'Não'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExibirColunaConferencia(prev => !prev)}
                  className={`px-2.5 py-2 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                    exibirColunaConferencia
                      ? 'bg-sky-600 text-white border-sky-400 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                  }`}
                  title="Incluir coluna [ ] para conferência física em prancheta"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Conf. [ ]: {exibirColunaConferencia ? 'Sim' : 'Não'}</span>
                </button>
              </>
            )}

            <button
              onClick={handleBaixarPdf}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              title="Baixar arquivo PDF formatado e pronto para impressão ou arquivo"
            >
              <Download className="w-4 h-4" />
              <span>Baixar PDF (.pdf)</span>
            </button>

            <button
              onClick={handleImprimir}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-1.5 active:scale-95 transition-all"
              title="Imprimir ou Salvar em PDF pelo navegador"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir (A4)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Layout Dividido: Painel de Configurações (4 cols) e Visualização Formal (8 cols) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 print:block print:overflow-visible print:divide-none">
          
          {/* LADO ESQUERDO: CONTROLES */}
          <div className="lg:col-span-4 p-5 overflow-y-auto space-y-5 bg-slate-50/80 print:hidden">
            
            {/* Escolha do Tipo de Documento */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Tipo de Documento Oficial:
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setTipoDocumento('relatorio_simplificado')}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-start gap-2.5 ${
                    tipoDocumento === 'relatorio_simplificado'
                      ? 'bg-blue-900 text-white border-blue-600 ring-2 ring-blue-500/30 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <ListFilter className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span>Relação Simples (Tombo & Descrição)</span>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded font-semibold border border-emerald-400/40">
                        Por Secretaria
                      </span>
                    </div>
                    <p className={`text-[11px] font-normal mt-0.5 ${tipoDocumento === 'relatorio_simplificado' ? 'text-blue-200' : 'text-slate-500'}`}>
                      Relatório oficial com apenas Nº de Tombamento e Descrição.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoDocumento('termo_cautela')}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-start gap-2.5 ${
                    tipoDocumento === 'termo_cautela'
                      ? 'bg-blue-900 text-white border-blue-600 ring-2 ring-blue-500/30 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div>Termo de Responsabilidade e Guarda</div>
                    <p className={`text-[11px] font-normal mt-0.5 ${tipoDocumento === 'termo_cautela' ? 'text-blue-200' : 'text-slate-500'}`}>
                      Fiel depósito e guarda de bens móveis (Art. 70 CF/88 e Lei 4.320/64).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoDocumento('termo_transferencia')}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-start gap-2.5 ${
                    tipoDocumento === 'termo_transferencia'
                      ? 'bg-blue-900 text-white border-blue-600 ring-2 ring-blue-500/30 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div>Guia de Remessa e Transferência</div>
                    <p className={`text-[11px] font-normal mt-0.5 ${tipoDocumento === 'termo_transferencia' ? 'text-blue-200' : 'text-slate-500'}`}>
                      Trâmite formal entre secretarias: Cedente, Cessionário e DPP.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoDocumento('relatorio_tcm')}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-start gap-2.5 ${
                    tipoDocumento === 'relatorio_tcm'
                      ? 'bg-blue-900 text-white border-blue-600 ring-2 ring-blue-500/30 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div>Relatório Consolidado TCM/PA</div>
                    <p className={`text-[11px] font-normal mt-0.5 ${tipoDocumento === 'relatorio_tcm' ? 'text-blue-200' : 'text-slate-500'}`}>
                      Balanço e inventário de encerramento do exercício de {patrimonios.length.toLocaleString('pt-BR')} bens.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Configuração dos Dados Específicos por Tipo */}
            {tipoDocumento === 'relatorio_simplificado' && (
              <div className="space-y-3 pt-3 border-t border-slate-200 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Parâmetros do Relatório:
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                    Tombo & Descrição
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    1. Secretaria / Órgão:
                  </span>
                  <select
                    value={secretariaSelecionada}
                    onChange={(e) => handleSecretariaChange(e.target.value)}
                    className="w-full text-xs py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-bold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Todas">TODAS AS SECRETARIAS REUNIDAS ({patrimonios.length.toLocaleString('pt-BR')} bens)</option>
                    {GERENTES_LIST.map(g => (
                      <option key={g.secretaria} value={g.secretaria}>{g.secretaria}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-700">
                      2. Locais / Unidades (Incluir ou filtrar):
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {locaisDisponiveis.length} disponíveis
                    </span>
                  </div>
                  <MultiLocalSelector
                    locais={locaisDisponiveis}
                    selectedLocais={locaisSelecionados}
                    onChange={(novos) => {
                      setLocaisSelecionados(novos);
                      setDepartamentosSelecionados([]);
                      setPreviewDeptoIndex(0);
                    }}
                    bensCountMap={bensCountPorLocal}
                  />

                  {locaisSelecionados.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {locaisSelecionados.map((loc) => (
                        <span
                          key={loc}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-950 border border-indigo-200"
                        >
                          <span className="truncate max-w-[150px]">{loc}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setLocaisSelecionados(locaisSelecionados.filter(l => l !== loc));
                              setDepartamentosSelecionados([]);
                              setPreviewDeptoIndex(0);
                            }}
                            className="text-indigo-700 hover:text-indigo-950 font-bold ml-0.5"
                            title="Remover local"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-700">
                      3. Departamentos / Salas:
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {departamentosDisponiveis.length} disponíveis
                    </span>
                  </div>

                  <MultiDepartamentoSelector
                    departamentos={departamentosDisponiveis}
                    selectedDepartamentos={departamentosSelecionados}
                    onChange={(novos) => {
                      setDepartamentosSelecionados(novos);
                      setPreviewDeptoIndex(0);
                    }}
                    bensCountMap={bensCountPorDepto}
                  />

                  {/* Chips dos departamentos selecionados */}
                  {departamentosSelecionados.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {departamentosSelecionados.map((dep, idx) => (
                        <span 
                          key={dep}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200"
                        >
                          <span className="truncate max-w-[150px]">{dep}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = departamentosSelecionados.filter(d => d !== dep);
                              setDepartamentosSelecionados(updated);
                              if (previewDeptoIndex >= updated.length) {
                                setPreviewDeptoIndex(Math.max(0, updated.length - 1));
                              }
                            }}
                            className="text-blue-700 hover:text-blue-950 font-bold ml-0.5"
                            title="Remover departamento"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-1 space-y-1.5">
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700 select-none bg-white p-2 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={exibirColunaLocal}
                      onChange={(e) => setExibirColunaLocal(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 shrink-0"
                    />
                    <div>
                      <span className="text-[11px] font-medium block">
                        Incluir <strong>Local / Unidade</strong> no relatório
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Opcional: exibe no cabeçalho e na coluna da tabela
                      </span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none bg-white p-2 rounded-lg border border-slate-200 hover:border-slate-300">
                    <input
                      type="checkbox"
                      checked={exibirColunaDepartamento}
                      onChange={(e) => setExibirColunaDepartamento(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-[11px] font-medium">
                      Exibir coluna <strong>Departamento</strong> na listagem
                    </span>
                  </label>
                </div>

                {/* Seletor de Formato de Impressão: Contínuo (Economia de Papel) vs Folha Separada */}
                {departamentosSelecionados.length > 1 && (
                  <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-700" />
                        Formato de Impressão / Folhas:
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded">
                        {departamentosSelecionados.length} setores
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setModoOrganizacao('continuo')}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          modoOrganizacao === 'continuo'
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">🌿 Contínuo</span>
                          {modoOrganizacao === 'continuo' && (
                            <span className="text-[9px] bg-emerald-500 text-white px-1 py-0.2 rounded font-bold">
                              Ativo
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] mt-0.5 leading-tight ${
                          modoOrganizacao === 'continuo' ? 'text-emerald-100' : 'text-slate-500'
                        }`}>
                          Economia de papel. Lista todos os setores em sequência.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModoOrganizacao('separado')}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          modoOrganizacao === 'separado'
                            ? 'bg-blue-900 text-white border-blue-950 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">📄 1 por Folha</span>
                          {modoOrganizacao === 'separado' && (
                            <span className="text-[9px] bg-blue-700 text-white px-1 py-0.2 rounded font-bold">
                              Ativo
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] mt-0.5 leading-tight ${
                          modoOrganizacao === 'separado' ? 'text-blue-200' : 'text-slate-500'
                        }`}>
                          Página individual separada por departamento.
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-950 space-y-2">
                  <div className="font-bold flex items-center justify-between text-blue-900">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        {departamentosSelecionados.length > 1 
                          ? `${departamentosSelecionados.length} Departamentos Selecionados`
                          : departamentosSelecionados.length === 1
                          ? `1 Departamento Selecionado`
                          : 'Todos os Departamentos'}
                      </span>
                    </div>
                    {departamentosSelecionados.length > 0 && (
                      <span className="text-[10px] bg-blue-200/80 text-blue-950 font-mono px-1.5 py-0.2 rounded font-bold">
                        {departamentosSelecionados.length} selecionado{departamentosSelecionados.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    {departamentosSelecionados.length > 1 ? (
                      modoOrganizacao === 'continuo' ? (
                        <>
                          <strong>🌿 Modo Contínuo (Economia de Papel):</strong> Os bens dos <strong>{departamentosSelecionados.length} departamentos</strong> são listados em tabela única corrida (sem divisões de bloco), em ordem sequencial.
                        </>
                      ) : (
                        <>
                          <strong>📄 Folhas Separadas:</strong> O PDF gerará <strong>1 página separada para cada um dos {departamentosSelecionados.length} departamentos</strong> com cabeçalho oficial individual.
                        </>
                      )
                    ) : departamentosSelecionados.length === 1 ? (
                      <>Exibindo exclusivamente os bens lotados no setor <strong>{departamentosSelecionados[0]}</strong>.</>
                    ) : (
                      <>Exibindo todos os bens da pasta reunidos com opção de identificação por setor.</>
                    )}
                  </p>

                  <div className="pt-1.5 border-t border-blue-200 flex items-center justify-between font-medium text-slate-700 text-[11px]">
                    <span>Total de Bens no Lote:</span>
                    <strong className="text-blue-900 font-mono text-xs">
                      {totalBensTodosDeptosSelecionados.toLocaleString('pt-BR')} {totalBensTodosDeptosSelecionados === 1 ? 'item' : 'itens'}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBaixarPdf}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 active:scale-98 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Arquivo PDF (.pdf)</span>
                </button>
              </div>
            )}

            {tipoDocumento === 'termo_cautela' && (
              <div className="space-y-3 pt-3 border-t border-slate-200 animate-fadeIn">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Dados da Secretaria e Servidor:
                </label>

                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Secretaria / Órgão:
                  </span>
                  <select
                    value={secretariaSelecionada}
                    onChange={(e) => handleSecretariaChange(e.target.value)}
                    className="w-full text-xs py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    {GERENTES_LIST.map(g => (
                      <option key={g.secretaria} value={g.secretaria}>{g.secretaria}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Servidor Responsável (Fiel Depositário):
                  </span>
                  <input
                    type="text"
                    value={nomeResponsavel}
                    onChange={(e) => setNomeResponsavel(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Matrícula / CPF:
                    </span>
                    <input
                      type="text"
                      value={matriculaOuCpf}
                      onChange={(e) => setMatriculaOuCpf(e.target.value)}
                      className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Cargo / Função:
                    </span>
                    <input
                      type="text"
                      value={cargoResponsavel}
                      onChange={(e) => setCargoResponsavel(e.target.value)}
                      className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Locais / Unidades (Escola, Posto, Prédio):
                  </span>
                  <MultiLocalSelector
                    locais={locaisDisponiveis}
                    selectedLocais={locaisSelecionados}
                    onChange={setLocaisSelecionados}
                    bensCountMap={bensCountPorLocal}
                  />
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Departamento / Setor Físico:
                  </span>
                  <input
                    type="text"
                    value={localizacaoSetor}
                    onChange={(e) => setLocalizacaoSetor(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>
            )}

            {tipoDocumento === 'termo_transferencia' && (
              <div className="space-y-3 pt-3 border-t border-slate-200 animate-fadeIn">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Dados da Remessa / Transferência:
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Nº da Guia:
                    </span>
                    <input
                      type="text"
                      value={numeroGuia}
                      onChange={(e) => setNumeroGuia(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Data da Guia:
                    </span>
                    <div className="text-xs py-1.5 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-mono">
                      {new Date().toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                {/* Órgão Cedente */}
                <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                  <span className="text-[11px] font-bold text-blue-900 block">1. Órgão Cedente (Origem):</span>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Secretaria de Origem:</span>
                    <select
                      value={secretariaSelecionada}
                      onChange={(e) => handleSecretariaChange(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                    >
                      {GERENTES_LIST.map(g => (
                        <option key={g.secretaria} value={g.secretaria}>{g.secretaria}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Locais / Unidades (Origem):</span>
                    <MultiLocalSelector
                      locais={locaisDisponiveis}
                      selectedLocais={locaisSelecionados}
                      onChange={setLocaisSelecionados}
                      bensCountMap={bensCountPorLocal}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Responsável Cedente:</span>
                    <input
                      type="text"
                      value={nomeResponsavel}
                      onChange={(e) => setNomeResponsavel(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Órgão Cessionário */}
                <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2">
                  <span className="text-[11px] font-bold text-indigo-900 block">2. Órgão Cessionário (Destino):</span>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Secretaria de Destino:</span>
                    <select
                      value={secretariaDestino}
                      onChange={(e) => handleSecretariaDestinoChange(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                    >
                      {GERENTES_LIST.map(g => (
                        <option key={g.secretaria} value={g.secretaria}>{g.secretaria}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Local / Unidade (Destino):</span>
                    <input
                      type="text"
                      value={localDestino}
                      onChange={(e) => setLocalDestino(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg"
                      placeholder="Ex: Escola, Posto de Saúde, Sede..."
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Novo Responsável:</span>
                    <input
                      type="text"
                      value={nomeResponsavelDestino}
                      onChange={(e) => setNomeResponsavelDestino(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Justificativa / Motivo da Transferência:
                  </span>
                  <textarea
                    rows={2}
                    value={motivoTransferencia}
                    onChange={(e) => setMotivoTransferencia(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>
            )}

            {tipoDocumento === 'relatorio_tcm' && (
              <div className="space-y-3 pt-3 border-t border-slate-200 animate-fadeIn">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Parâmetros de Prestação de Contas (TCM/PA):
                </label>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-700" />
                    <span>Consolidação Geral do Município</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    O relatório agrega automaticamente todos os <strong>{totalGeralBens.toLocaleString('pt-BR')} bens</strong> tombados das 15 secretarias municipais.
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Comissão de Inventário (Presidente / Portaria):
                  </span>
                  <input
                    type="text"
                    value={presidenteComissao}
                    onChange={(e) => setPresidenteComissao(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>
            )}

            {/* Opção de Local / Unidade + Diretor DPP - Para termos e relatório TCM */}
            {tipoDocumento !== 'relatorio_simplificado' && (
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700 select-none bg-white p-2 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={exibirColunaLocal}
                    onChange={(e) => setExibirColunaLocal(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 shrink-0"
                  />
                  <div>
                    <span className="text-[11px] font-medium block">
                      Incluir <strong>Local / Unidade</strong> no documento
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Opcional: exibe no cabeçalho e na listagem
                    </span>
                  </div>
                </label>

                <div>
                  <span className="text-[11px] font-semibold text-blue-900 block mb-1">
                    Diretor de Patrimônio Público (DPP):
                  </span>
                  <input
                    type="text"
                    value={nomeDiretorDpp}
                    onChange={(e) => setNomeDiretorDpp(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 bg-blue-50/50 border border-blue-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do Diretor do DPP"
                  />
                </div>
              </div>
            )}

            {/* Resumo da Tabela de Bens para Relatório Simplificado */}
            {tipoDocumento === 'relatorio_simplificado' && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1.5">
                <div className="font-bold flex items-center justify-between">
                  <span>Itens Listados no Relatório:</span>
                  <span className="font-mono bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded font-bold">
                    {bensSimplificados.length.toLocaleString('pt-BR')} bens
                  </span>
                </div>
                <div className="text-[11px] text-emerald-800">
                  {departamentosSelecionados.length > 0 ? (
                    <>Filtrado por: <strong>{departamentosSelecionados.join(', ')}</strong> ({departamentosSelecionados.length} {departamentosSelecionados.length === 1 ? 'setor' : 'setores'})</>
                  ) : (
                    <>Documento com <strong>Nº de Tombamento</strong> e <strong>Descrição</strong></>
                  )}
                </div>
              </div>
            )}

            {/* Resumo da Tabela de Bens para Termo e Transferência */}
            {(tipoDocumento === 'termo_cautela' || tipoDocumento === 'termo_transferencia') && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span>Bens Vinculados ao Documento:</span>
                  <span className="font-mono bg-blue-200 text-blue-950 px-2 py-0.5 rounded text-[11px]">
                    {bensNoTermo.length} bens
                  </span>
                </div>
                <div className="flex items-center justify-between text-blue-800 font-semibold pt-1">
                  <span>Valor Contábil Total:</span>
                  <span className="font-mono text-emerald-800 font-bold">
                    {valorTotalTermo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            )}

            {/* Resumo para TCM */}
            {tipoDocumento === 'relatorio_tcm' && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1.5">
                <div className="font-bold flex items-center justify-between">
                  <span>Ativo Imobilizado Geral:</span>
                  <span className="font-mono bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded font-bold">
                    {totalGeralBens} bens
                  </span>
                </div>
                <div className="flex items-center justify-between font-semibold pt-1 text-emerald-900">
                  <span>Valor Total Consolidado:</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {totalGeralValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* LADO DIREITO: DOCUMENTO FORMATADO A4 OFICIAL (PREVIEW & IMPRESSÃO) */}
          <div className="lg:col-span-8 p-6 overflow-y-auto bg-slate-200/70 flex justify-center print:block print:p-0 print:bg-white print:overflow-visible">
            
            <div 
              id="termo-print-area"
              className="bg-white w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 shadow-xl border border-slate-300 text-slate-900 font-serif flex flex-col justify-between"
            >
              
              {/* CABEÇALHO OFICIAL PMC */}
              <div className="space-y-4">
                {tipoDocumento === 'relatorio_simplificado' ? (
                  <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-3">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center p-1 bg-white border border-slate-300 rounded-xl shadow-2xs">
                      <img 
                        src="/assets/aistudio/brasao_capanema_limpo.png" 
                        alt="Brasão da Prefeitura Municipal de Capanema - PA" 
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        ESTADO DO PARÁ • PODER EXECUTIVO
                      </div>
                      <div className="text-[16px] sm:text-[18px] font-black tracking-wider text-slate-950 uppercase leading-tight">
                        PREFEITURA MUNICIPAL DE CAPANEMA
                      </div>
                      <div className="text-[12px] font-bold text-slate-800 uppercase mt-0.5">
                        DIRETORIA DE PATRIMÔNIO PÚBLICO (DPP)
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase mt-0.5 font-medium">
                        RELATÓRIO OFICIAL DE BENS PATRIMONIAIS • TOMBAMENTO E DESCRIÇÃO
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                    <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                      <img 
                        src="/assets/aistudio/brasao_capanema_limpo.png" 
                        alt="Brasão de Capanema" 
                        className="max-h-16 max-w-16 object-contain"
                        onError={(e) => {
                          // Fallback caso imagem local não responda
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    <div className="text-center flex-1 px-4">
                      <div className="text-xs font-bold text-slate-700 tracking-wider">
                        ESTADO DO PARÁ
                      </div>
                      <div className="text-[15px] font-black tracking-wider text-slate-950 uppercase mt-0.5">
                        PREFEITURA MUNICIPAL DE CAPANEMA
                      </div>
                      <div className="text-[11px] font-bold text-slate-700 uppercase">
                        DIRETORIA DE PATRIMÔNIO PÚBLICO (DPP)
                      </div>
                      <div className="text-[10px] text-slate-600 uppercase">
                        {tipoDocumento === 'relatorio_tcm' 
                          ? 'PRESTAÇÃO DE CONTAS ANUAL • TRIBUNAL DE CONTAS DOS MUNICÍPIOS (TCM/PA)'
                          : secretariaSelecionada === 'Todas' ? 'TODAS AS SECRETARIAS REUNIDAS' : secretariaSelecionada}
                      </div>
                    </div>

                    <div className="w-16 h-20 shrink-0 flex flex-col items-center justify-center border border-slate-300 rounded p-1 text-center font-mono">
                      <span className="text-[8px] text-slate-500 uppercase">Exercício</span>
                      <span className="text-sm font-black text-slate-900">2026</span>
                      <span className="text-[7.5px] text-slate-500 mt-1">LEI 4.320/64</span>
                    </div>
                  </div>
                )}

                {/* TÍTULO DO DOCUMENTO (Não exibido no simplificado para manter estritamente as informações solicitadas) */}
                {tipoDocumento !== 'relatorio_simplificado' && (
                  <div className="text-center pt-2">
                    <h1 className="text-base font-black uppercase tracking-wider text-slate-950 font-sans underline decoration-1 underline-offset-4">
                      {tipoDocumento === 'termo_cautela' && 'TERMO DE RESPONSABILIDADE E GUARDA DE BENS MÓVEIS Nº 2026/DPP'}
                      {tipoDocumento === 'termo_transferencia' && `GUIA DE REMESSA E TRANSFERÊNCIA DE BENS PATRIMONIAIS Nº ${numeroGuia}`}
                      {tipoDocumento === 'relatorio_tcm' && 'DEMONSTRATIVO CONSOLIDADO DO INVENTÁRIO DO ATIVO IMOBILIZADO (TCM-PA)'}
                    </h1>
                  </div>
                )}
              </div>

              {/* CORPO DO DOCUMENTO CONFORME O TIPO */}

              {/* 1. TERMO DE RESPONSABILIDADE E GUARDA */}
              {tipoDocumento === 'termo_cautela' && (
                <div className="space-y-4 my-4 flex-1">
                  <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-1 text-[11px] font-sans">
                    <div className={`grid ${exibirColunaLocal ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                      <div><strong>Secretaria / Lotação:</strong> {secretariaSelecionada}</div>
                      {exibirColunaLocal && (
                        <div><strong>Local / Unidade:</strong> {locaisSelecionados.length === 0 ? 'Todos / Sede' : locaisSelecionados.length === 1 ? locaisSelecionados[0] : `${locaisSelecionados.length} Locais (${locaisSelecionados.join(', ')})`}</div>
                      )}
                      <div><strong>Departamento / Setor:</strong> {localizacaoSetor}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200">
                      <div><strong>Responsável:</strong> {nomeResponsavel}</div>
                      <div><strong>Documento:</strong> {matriculaOuCpf}</div>
                      <div><strong>Cargo / Função:</strong> {cargoResponsavel}</div>
                    </div>
                  </div>

                  <p className="text-justify text-[11px] leading-relaxed">
                    Pelo presente instrumento, o servidor acima qualificado declara ter recebido da <strong>Prefeitura Municipal de Capanema</strong>, 
                    por intermédio da Diretoria de Patrimônio Público, em perfeitas condições de uso e conservação, os bens patrimoniais móveis abaixo discriminados, 
                    assumindo a condição de <strong>Fiel Depositário</strong> e a responsabilidade direta pela guarda, zelo e correta utilização dos mesmos para os fins 
                    exclusivos do serviço público municipal, em cumprimento aos preceitos da Lei Federal nº 4.320/1964 e das normas de controle patrimonial do TCM/PA.
                  </p>

                  {/* Tabela dos Bens */}
                  <div className="border border-slate-800 rounded overflow-hidden">
                    <table className="w-full text-left border-collapse text-[10px] font-sans">
                      <thead className="bg-slate-100 border-b border-slate-800 font-bold uppercase text-[9px]">
                        <tr>
                          <th className="py-1 px-2 border-r border-slate-300 w-10 text-center">Item</th>
                          <th className="py-1 px-2 border-r border-slate-300 w-20">Nº Tombo</th>
                          <th className="py-1 px-2 border-r border-slate-300">Descrição do Bem Patrimonial</th>
                          {exibirColunaLocal && (
                            <th className="py-1 px-2 border-r border-slate-300 w-36">Local / Unidade</th>
                          )}
                          <th className="py-1 px-2 border-r border-slate-300 w-20 text-center">Estado</th>
                          <th className="py-1 px-2 w-24 text-right">Valor (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {bensNoTermo.slice(0, 30).map((bem, index) => (
                          <tr key={bem.id} className="hover:bg-slate-50">
                            <td className="py-1 px-2 border-r border-slate-200 text-center">{index + 1}</td>
                            <td className="py-1 px-2 border-r border-slate-200 font-bold text-blue-900">{bem.numeroTombamento || bem.etiquetaNumero}</td>
                            <td className="py-1 px-2 border-r border-slate-200 font-sans truncate max-w-xs">{bem.descricao}</td>
                            {exibirColunaLocal && (
                              <td className="py-1 px-2 border-r border-slate-200 font-sans text-[9px] text-slate-600 truncate max-w-[140px]">{bem.local || bem.localizacaoExata || 'Sede / Geral'}</td>
                            )}
                            <td className="py-1 px-2 border-r border-slate-200 text-center font-sans text-[9px]">{bem.estadoConservacao || 'Bom'}</td>
                            <td className="py-1 px-2 text-right">
                              {Number(bem.valorAquisicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold border-t border-slate-800 text-[10px]">
                        <tr>
                          <td colSpan={exibirColunaLocal ? 5 : 4} className="py-1.5 px-2 text-right font-sans uppercase">
                            Total Geral ({bensNoTermo.length} bens):
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-950">
                            {valorTotalTermo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {bensNoTermo.length > 30 && (
                    <div className="text-[9.5px] text-slate-500 italic text-center">
                      * Exibindo os primeiros 30 itens na folha principal. Relação complementar em anexo rubricado.
                    </div>
                  )}

                  <div className="space-y-1 text-[10.5px] leading-snug">
                    <div className="font-bold font-sans uppercase text-[10px] text-slate-800">
                      Obrigações e Sanções Legais:
                    </div>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-700">
                      <li>Não ceder, transferir ou movimentar qualquer bem para outro setor sem a prévia expedição de Guia de Remessa pela DPP.</li>
                      <li>Comunicar imediatamente à Diretoria de Patrimônio qualquer dano, sinistro, avaria, extravio ou necessidade de manutenção.</li>
                      <li>Ressarcir o erário municipal caso seja constatado dano por imperícia, negligência ou uso indevido (Art. 70 da CF/88).</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* 2. GUIA DE REMESSA E TRANSFERÊNCIA */}
              {tipoDocumento === 'termo_transferencia' && (
                <div className="space-y-4 my-4 flex-1">
                  <div className="grid grid-cols-2 gap-3 text-[11px] font-sans">
                    <div className="p-3 bg-blue-50/70 border border-blue-300 rounded-lg space-y-1">
                      <span className="font-bold text-blue-950 uppercase text-[10px] block">Órgão Cedente (Origem):</span>
                      <div><strong>Secretaria:</strong> {secretariaSelecionada}</div>
                      {exibirColunaLocal && (
                        <div><strong>Local / Unidade:</strong> {locaisSelecionados.length === 0 ? 'Todos / Sede' : locaisSelecionados.length === 1 ? locaisSelecionados[0] : `${locaisSelecionados.length} Locais`}</div>
                      )}
                      <div><strong>Responsável Cedente:</strong> {nomeResponsavel}</div>
                    </div>
                    <div className="p-3 bg-indigo-50/70 border border-indigo-300 rounded-lg space-y-1">
                      <span className="font-bold text-indigo-950 uppercase text-[10px] block">Órgão Cessionário (Destino):</span>
                      <div><strong>Secretaria:</strong> {secretariaDestino}</div>
                      {exibirColunaLocal && (
                        <div><strong>Local / Unidade:</strong> {localDestino || 'Sede Administrativa'}</div>
                      )}
                      <div><strong>Novo Responsável:</strong> {nomeResponsavelDestino}</div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-sans">
                    <strong>Motivo / Justificativa Administrativa:</strong> {motivoTransferencia}
                  </div>

                  <p className="text-justify text-[11px] leading-relaxed">
                    Autorizo a remessa e transferência dos bens patrimoniais constantes na presente guia. Fica transferida ao cessionário 
                    a responsabilidade pelo zelo, guarda e incorporação temporária ou definitiva do bem na unidade de destino, 
                    atualizando-se o registro contábil no sistema informatizado de controle do DPP.
                  </p>

                  {/* Tabela dos Bens Transferidos */}
                  <div className="border border-slate-800 rounded overflow-hidden">
                    <table className="w-full text-left border-collapse text-[10px] font-sans">
                      <thead className="bg-slate-100 border-b border-slate-800 font-bold uppercase text-[9px]">
                        <tr>
                          <th className="py-1 px-2 border-r border-slate-300 w-10 text-center">Item</th>
                          <th className="py-1 px-2 border-r border-slate-300 w-20">Nº Tombo</th>
                          <th className="py-1 px-2 border-r border-slate-300">Descrição do Bem Patrimonial</th>
                          {exibirColunaLocal && (
                            <th className="py-1 px-2 border-r border-slate-300 w-36">Local / Unidade</th>
                          )}
                          <th className="py-1 px-2 border-r border-slate-300 w-20 text-center">Estado</th>
                          <th className="py-1 px-2 w-24 text-right">Valor (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {bensNoTermo.slice(0, 25).map((bem, index) => (
                          <tr key={bem.id} className="hover:bg-slate-50">
                            <td className="py-1 px-2 border-r border-slate-200 text-center">{index + 1}</td>
                            <td className="py-1 px-2 border-r border-slate-200 font-bold text-blue-900">{bem.numeroTombamento || bem.etiquetaNumero}</td>
                            <td className="py-1 px-2 border-r border-slate-200 font-sans truncate max-w-xs">{bem.descricao}</td>
                            {exibirColunaLocal && (
                              <td className="py-1 px-2 border-r border-slate-200 font-sans text-[9px] text-slate-600 truncate max-w-[140px]">{bem.local || bem.localizacaoExata || 'Sede / Geral'}</td>
                            )}
                            <td className="py-1 px-2 border-r border-slate-200 text-center font-sans text-[9px]">{bem.estadoConservacao || 'Bom'}</td>
                            <td className="py-1 px-2 text-right">
                              {Number(bem.valorAquisicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold border-t border-slate-800 text-[10px]">
                        <tr>
                          <td colSpan={exibirColunaLocal ? 5 : 4} className="py-1.5 px-2 text-right font-sans uppercase">
                            Total dos Bens Remetidos ({bensNoTermo.length} itens):
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-950">
                            {valorTotalTermo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. RELATÓRIO CONSOLIDADO TCM-PA */}
              {tipoDocumento === 'relatorio_tcm' && (
                <div className="space-y-3.5 my-3 flex-1">
                  {/* Quadro Resumo Geral */}
                  <div className={`grid ${exibirColunaLocal ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-center font-sans text-[10px]`}>
                    <div className="p-2 bg-slate-100 border border-slate-300 rounded">
                      <span className="text-slate-500 block uppercase text-[8px]">Total de Bens</span>
                      <strong className="text-sm font-mono text-slate-900">{totalGeralBens.toLocaleString('pt-BR')}</strong>
                    </div>
                    {exibirColunaLocal && (
                      <div className="p-2 bg-slate-100 border border-slate-300 rounded">
                        <span className="text-slate-500 block uppercase text-[8px]">Locais / Unidades</span>
                        <strong className="text-sm font-mono text-blue-900">{totalLocaisUnidades.toLocaleString('pt-BR')}</strong>
                      </div>
                    )}
                    <div className="p-2 bg-slate-100 border border-slate-300 rounded">
                      <span className="text-slate-500 block uppercase text-[8px]">Bens em Pleno Uso</span>
                      <strong className="text-sm font-mono text-emerald-800">{totalBensEmUso.toLocaleString('pt-BR')}</strong>
                    </div>
                    <div className="p-2 bg-slate-100 border border-slate-300 rounded">
                      <span className="text-slate-500 block uppercase text-[8px]">Valor Contábil Consolidado</span>
                      <strong className="text-sm font-mono text-blue-950">{totalGeralValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </div>

                  {/* Tabela das Secretarias */}
                  <div className="border border-slate-800 rounded overflow-hidden">
                    <table className="w-full text-left border-collapse text-[9.5px] font-sans">
                      <thead className="bg-slate-100 border-b border-slate-800 font-bold uppercase text-[8.5px]">
                        <tr>
                          <th className="py-1 px-1.5 border-r border-slate-300 w-8 text-center">Nº</th>
                          <th className="py-1 px-2 border-r border-slate-300">Secretaria / Unidade Orçamentária</th>
                          {exibirColunaLocal && (
                            <th className="py-1 px-1.5 border-r border-slate-300 text-center w-14">Locais</th>
                          )}
                          <th className="py-1 px-1.5 border-r border-slate-300 text-center w-14">Qtd Bens</th>
                          <th className="py-1 px-1.5 border-r border-slate-300 text-center w-12">% Total</th>
                          <th className="py-1 px-1.5 border-r border-slate-300 text-center w-14">Em Uso</th>
                          <th className="py-1 px-2 text-right w-24">Valor Contábil</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {secretariasStats.map((sec, idx) => (
                          <tr key={sec.nome} className="hover:bg-slate-50">
                            <td className="py-1 px-1.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                            <td className="py-1 px-2 border-r border-slate-200 font-semibold">{sec.nome}</td>
                            {exibirColunaLocal && (
                              <td className="py-1 px-1.5 border-r border-slate-200 text-center font-mono text-slate-700">{sec.locaisCount}</td>
                            )}
                            <td className="py-1 px-1.5 border-r border-slate-200 text-center font-mono font-bold text-blue-900">{sec.count}</td>
                            <td className="py-1 px-1.5 border-r border-slate-200 text-center font-mono text-slate-600">{sec.pct.toFixed(1)}%</td>
                            <td className="py-1 px-1.5 border-r border-slate-200 text-center font-mono text-emerald-700">{sec.emUso}</td>
                            <td className="py-1 px-2 text-right font-mono font-medium">
                              {sec.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold border-t border-slate-800 text-[9.5px]">
                        <tr>
                          <td colSpan={2} className="py-1.5 px-2 text-right uppercase">Total do Exercício 2026:</td>
                          {exibirColunaLocal && (
                            <td className="py-1.5 px-1.5 text-center font-mono text-slate-800">{totalLocaisUnidades}</td>
                          )}
                          <td className="py-1.5 px-1.5 text-center font-mono text-blue-950 font-black">{totalGeralBens}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono">100%</td>
                          <td className="py-1.5 px-1.5 text-center font-mono text-emerald-900">{totalBensEmUso}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-950 font-black">
                            {totalGeralValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p className="text-justify text-[10px] leading-relaxed text-slate-700">
                    <strong>Termo de Encerramento do Inventário:</strong> A Comissão Especial de Inventário, designada pela Portaria Municipal, 
                    declara encerrados os trabalhos de levantamento físico e financeiro dos bens pertencentes ao acervo patrimonial 
                    do Município de Capanema, atestando a exatidão dos saldos acima demonstrados para fins de incorporação e 
                    prestação de contas anual perante o Tribunal de Contas dos Municípios do Estado do Pará (TCM/PA).
                  </p>
                </div>
              )}

              {/* 4. RELATÓRIO SIMPLIFICADO: APENAS TOMBAMENTO E DESCRIÇÃO POR SECRETARIA E DEPARTAMENTO */}
              {tipoDocumento === 'relatorio_simplificado' && (
                <div className="space-y-4 my-4 flex-1">
                  {/* Seletor de visualização de folha para múltiplos departamentos quando no modo separado */}
                  {departamentosSelecionados.length > 1 && modoOrganizacao === 'separado' && (
                    <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-300 space-y-1.5 print:hidden">
                      <div className="flex items-center justify-between text-[11px] font-sans font-bold text-slate-800">
                        <span>Páginas Individuais do Documento ({departamentosSelecionados.length} departamentos):</span>
                        <span className="text-blue-900 font-mono text-[10px] bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                          Folha {previewDeptoIndex + 1} de {departamentosSelecionados.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {departamentosOrdenados.map((dep, idx) => (
                          <button
                            key={dep}
                            type="button"
                            onClick={() => setPreviewDeptoIndex(idx)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                              previewDeptoIndex === idx
                                ? 'bg-blue-900 text-white shadow-xs'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{idx + 1}. {dep}</span>
                            <span className="text-[10px] opacity-80 font-mono">
                              ({(bensCountPorDepto[dep] || 0)})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Banner informativo quando modo contínuo estiver ativo com múltiplos departamentos */}
                  {departamentosSelecionados.length > 1 && modoOrganizacao === 'continuo' && (
                    <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 p-2.5 rounded-xl text-xs font-sans flex items-center justify-between print:hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🌿</span>
                        <div>
                          <span className="font-bold text-emerald-900">Modo Contínuo Ativo (Economia de Papel):</span>
                          <span className="text-emerald-800 ml-1">
                            Todos os {departamentosSelecionados.length} setores são exibidos em tabela única corrida, sem divisões de bloco, reduzindo o consumo de folhas.
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-200/90 font-bold px-2 py-0.5 rounded text-emerald-900 whitespace-nowrap">
                        Economia de papel
                      </span>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-1.5 text-[11px] font-sans">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <strong>SECRETARIA / ÓRGÃO:</strong> {secretariaSelecionada === 'Todas' ? 'TODAS AS SECRETARIAS REUNIDAS' : secretariaSelecionada}
                      </div>
                      <div className="text-right whitespace-nowrap shrink-0">
                        <strong>Total de Bens:</strong>{' '}
                        <span className="font-mono font-bold text-blue-900">
                          {departamentosSelecionados.length > 1 && modoOrganizacao === 'continuo'
                            ? `${totalBensTodosDeptosSelecionados.toLocaleString('pt-BR')} ${totalBensTodosDeptosSelecionados === 1 ? 'item' : 'itens'}`
                            : `${bensSimplificados.length.toLocaleString('pt-BR')} ${bensSimplificados.length === 1 ? 'item' : 'itens'}`}
                        </span>
                      </div>
                    </div>
                    {exibirColunaLocal && (
                      <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-200">
                        <div className="min-w-0">
                          <strong>LOCAL / UNIDADE:</strong>{' '}
                          <span className="font-bold text-blue-950">
                            {labelLocalResumo}
                          </span>
                        </div>
                        <div className="text-right text-slate-600 whitespace-nowrap shrink-0">
                          <strong>Data:</strong> {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-200">
                      <div className="min-w-0">
                        <strong>DEPARTAMENTO / SETOR:</strong>{' '}
                        <span className="font-bold text-blue-900">
                          {departamentosSelecionados.length > 1 && modoOrganizacao === 'continuo'
                            ? `${departamentosSelecionados.length} DEPARTAMENTOS (MODO CONTÍNUO)`
                            : deptoPreviewAtivo 
                              ? (departamentosSelecionados.length > 1 
                                  ? `${deptoPreviewAtivo.toUpperCase()} (${previewDeptoIndex + 1} de ${departamentosSelecionados.length})` 
                                  : deptoPreviewAtivo.toUpperCase())
                              : 'TODOS OS DEPARTAMENTOS'}
                        </span>
                      </div>
                      {!exibirColunaLocal && (
                        <div className="text-right text-slate-600 whitespace-nowrap shrink-0">
                          <strong>Data:</strong> {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tabela dos Bens: TOMBAMENTO, DESCRIÇÃO e colunas opcionais */}
                  {(() => {
                    const isModoContinuoMulti = departamentosSelecionados.length > 1 && modoOrganizacao === 'continuo';
                    const listaBase = isModoContinuoMulti ? bensContinuosOrdenados : bensSimplificados;
                    const limitePreview = isModoContinuoMulti ? 150 : 80;
                    const itensExibidos = isPrintingAll ? listaBase : listaBase.slice(0, limitePreview);
                    const totalCols =
                      3 +
                      (exibirColunaDepartamento ? 1 : 0) +
                      (exibirColunaConservacao ? 1 : 0) +
                      (exibirColunaConferencia ? 1 : 0);

                    const resumirEstado = (est?: string) => {
                      const s = (est || '').trim();
                      if (!s) return '—';
                      if (s.toLowerCase().startsWith('inserv')) return 'Inservível';
                      if (s.toLowerCase().startsWith('ruim')) return 'Ruim';
                      return s;
                    };

                    return (
                      <>
                        <div className="border border-slate-800 rounded overflow-hidden print:border-0 print:rounded-none print:overflow-visible">
                          <table className="w-full text-left border-collapse text-[10px] font-sans">
                            <thead className="bg-slate-900 text-white font-bold uppercase text-[9px]">
                              <tr>
                                <th className="py-1.5 px-2 border-r border-slate-700 w-10 text-center">Item</th>
                                <th className="py-1.5 px-2.5 border-r border-slate-700 w-24 text-center">Nº Tombo</th>
                                <th className="py-1.5 px-3 border-r border-slate-700">Descrição do Bem Patrimonial</th>
                                {exibirColunaDepartamento && (
                                  <th className="py-1.5 px-2.5 border-r border-slate-700 w-36">Departamento / Setor</th>
                                )}
                                {exibirColunaConservacao && (
                                  <th className="py-1.5 px-2 border-r border-slate-700 w-20 text-center">Estado</th>
                                )}
                                {exibirColunaConferencia && (
                                  <th className="py-1.5 px-2 w-12 text-center">Conf.</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {itensExibidos.length === 0 ? (
                                <tr>
                                  <td colSpan={totalCols} className="py-4 text-center text-slate-500 italic">
                                    Nenhum bem tombado registrado para os filtros selecionados.
                                  </td>
                                </tr>
                              ) : (
                                itensExibidos.map((bem, index) => (
                                  <tr key={bem.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="py-1 px-2 border-r border-slate-200 text-center font-mono text-slate-500 text-[9px]">
                                      {index + 1}
                                    </td>
                                    <td className="py-1 px-2.5 border-r border-slate-200 font-mono font-bold text-blue-900 text-center whitespace-nowrap">
                                      {bem.numeroTombamento || bem.etiquetaNumero}
                                    </td>
                                    <td className="py-1 px-3 border-r border-slate-200 font-sans text-slate-800">
                                      {bem.descricao}
                                    </td>
                                    {exibirColunaDepartamento && (
                                      <td className="py-1 px-2.5 border-r border-slate-200 font-sans text-slate-600 text-[9.5px]">
                                        {bem.departamento || bem.localizacaoExata || 'Setor Geral'}
                                      </td>
                                    )}
                                    {exibirColunaConservacao && (
                                      <td className="py-1 px-2 border-r border-slate-200 text-center font-sans text-[9px] text-slate-700 whitespace-nowrap">
                                        {resumirEstado(bem.estadoConservacao)}
                                      </td>
                                    )}
                                    {exibirColunaConferencia && (
                                      <td className="py-1 px-2 text-center font-mono text-slate-400 text-[10px]">
                                        [ &nbsp; ]
                                      </td>
                                    )}
                                  </tr>
                                ))
                              )}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold border-t border-slate-800 text-[10px]">
                              <tr>
                                <td colSpan={totalCols - 1} className="py-1.5 px-3 text-right uppercase">
                                  {isModoContinuoMulti
                                    ? `Total Geral (${departamentosSelecionados.length} Departamentos):`
                                    : `Total de Bens (${deptoPreviewAtivo || 'Geral'}):`}
                                </td>
                                <td className="py-1.5 px-3 font-mono text-slate-950 font-bold whitespace-nowrap text-right">
                                  {listaBase.length.toLocaleString('pt-BR')} {listaBase.length === 1 ? 'item' : 'itens'}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {!isPrintingAll && listaBase.length > limitePreview && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center text-[10.5px] text-blue-900 font-medium space-y-1 print:hidden">
                            <div>
                              * A pré-visualização em tela exibe os primeiros {limitePreview} itens para navegação fluida.
                            </div>
                            <div className="font-bold text-emerald-800">
                              Tanto "Imprimir (A4)" quanto "Baixar PDF (.pdf)" incluem todos os {listaBase.length.toLocaleString('pt-BR')} bens selecionados.
                            </div>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-4 text-[9px] font-sans text-slate-500 page-break-avoid">
                          <span>
                            Prefeitura Municipal de Capanema • DPP • Emissão:{' '}
                            {new Date().toLocaleDateString('pt-BR')} às{' '}
                            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {profile?.nome && (
                            <span className="whitespace-nowrap shrink-0">
                              Emitido por: <strong className="text-slate-700">{profile.nome}</strong>
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* LOCAL E DATA */}
              {tipoDocumento !== 'relatorio_simplificado' && (
                <div className="pt-2 text-right font-sans text-[11px]">
                  Capanema - PA, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
                </div>
              )}

              {/* BLOCO FORMAL DE ASSINATURAS (Apenas para termos formais; simplificado não usa assinaturas) */}
              {tipoDocumento === 'termo_cautela' && (
                <div className="pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center font-sans text-[10px]">
                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1">
                      <div className="font-bold text-slate-900">{nomeResponsavel}</div>
                      <div className="text-slate-600">Servidor Responsável (Fiel Depositário)</div>
                      <div className="text-slate-500 text-[9px]">{matriculaOuCpf}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1">
                      <div className="font-bold text-slate-900">Secretário(a) Titular</div>
                      <div className="text-slate-600">{secretariaSelecionada}</div>
                      <div className="text-slate-500 text-[9px]">Ordenador de Despesas</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1">
                      <div className="font-bold text-slate-900">{nomeDiretorDpp}</div>
                      <div className="text-slate-600">{cargoDiretorDpp}</div>
                      <div className="text-slate-500 text-[9px]">Prefeitura Municipal de Capanema</div>
                    </div>
                  </div>
                </div>
              )}

              {tipoDocumento === 'termo_transferencia' && (
                <div className="pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center font-sans text-[10px]">
                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1">
                      <div className="font-bold text-slate-900">{nomeResponsavel}</div>
                      <div className="text-slate-600">Cedente (Origem)</div>
                      <div className="text-slate-500 text-[9px]">{secretariaSelecionada}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1">
                      <div className="font-bold text-slate-900">{nomeResponsavelDestino}</div>
                      <div className="text-slate-600">Cessionário (Destino)</div>
                      <div className="text-slate-500 text-[9px]">{secretariaDestino}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1">
                      <div className="font-bold text-slate-900">{nomeDiretorDpp}</div>
                      <div className="text-slate-600">{cargoDiretorDpp}</div>
                      <div className="text-slate-500 text-[9px]">Autorização DPP</div>
                    </div>
                  </div>
                </div>
              )}

              {tipoDocumento === 'relatorio_tcm' && (
                <div className="pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center font-sans text-[10px]">
                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1">
                      <div className="font-bold text-slate-900">{nomeDiretorDpp}</div>
                      <div className="text-slate-600">{cargoDiretorDpp}</div>
                      <div className="text-slate-500 text-[9px]">Prefeitura Municipal de Capanema</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1">
                      <div className="font-bold text-slate-900">Presidente da Comissão</div>
                      <div className="text-slate-600 truncate">{presidenteComissao}</div>
                      <div className="text-slate-500 text-[9px]">Comissão de Inventário</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1">
                      <div className="font-bold text-slate-900">Secretaria de Finanças</div>
                      <div className="text-slate-600">Contabilidade Geral</div>
                      <div className="text-slate-500 text-[9px]">Controle Interno Municipal</div>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
