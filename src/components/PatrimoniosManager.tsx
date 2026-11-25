import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PatrimonioRecord, TransferenciaRecord, VistoriaRecord, LocalizacaoRecord } from '../types/appsheet';
import { INITIAL_LOCALIZACOES } from '../data/sampleAppsheetSchema';
import { AppSheetPatrimonioForm } from './AppSheetPatrimonioForm';
import { EtiquetasPrintModal } from './EtiquetasPrintModal';
import { FirebaseSyncCenter } from './FirebaseSyncCenter';
import { VistoriaScannerModal } from './VistoriaScannerModal';
import { TermosERelatoriosModal, TipoDocumentoOficial } from './TermosERelatoriosModal';
import { AppSheetPhotoSyncModal } from './AppSheetPhotoSyncModal';
import { PWAInstallButton } from './PWAInstallButton';
import { getAllPhotosMap } from '../utils/photoStorage';
import { fetchAndCacheCloudPhoto, isPhotoKnownMissingInCloud } from '../utils/cloudPhotoSync';
import { useAuth } from '../context/AuthContext';
import { MultiDepartamentoSelector } from './MultiDepartamentoSelector';
import { MultiLocalSelector } from './MultiLocalSelector';
import { formatCadastroDate, formatResponsavelNome, parseCadastroTimestamp } from '../utils/patrimonioFormatters';
import { 
  Building2, Search, Plus, Filter, ArrowRightLeft, ClipboardCheck, 
  FileText, CheckCircle2, AlertCircle, Eye, Edit, Trash2, Printer, 
  MapPin, User, Calendar, DollarSign, Tag, ShieldAlert, Sparkles,
  Layers, ChevronDown, Check, X, CloudOff, Wifi, QrCode, Lock, Unlock,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown,
  Cloud, Camera, FileCheck, Image as ImageIcon, ZoomIn
} from 'lucide-react';

interface Props {
  patrimonios: PatrimonioRecord[];
  transferencias: TransferenciaRecord[];
  vistorias: VistoriaRecord[];
  onAddPatrimonio: (p: PatrimonioRecord) => void;
  onUpdatePatrimonio: (p: PatrimonioRecord) => void;
  onDeletePatrimonio?: (p: PatrimonioRecord) => void;
  onAddTransferencia: (t: TransferenciaRecord) => void;
  onAddVistoria: (v: VistoriaRecord) => void;
  onUpdateDatasetFromFirestore?: (bens: PatrimonioRecord[]) => void;
  initialBemToOpen?: PatrimonioRecord | null;
  onConsumeInitialBem?: () => void;
}

export const PatrimoniosManager: React.FC<Props> = ({
  patrimonios,
  transferencias,
  vistorias,
  onAddPatrimonio,
  onUpdatePatrimonio,
  onDeletePatrimonio,
  onAddTransferencia,
  onAddVistoria,
  onUpdateDatasetFromFirestore,
  initialBemToOpen,
  onConsumeInitialBem,
}) => {
  const { profile, canEditSecretaria, canCreatePatrimonio, canRegisterVistoria, isAdmin } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'bens' | 'transferencias' | 'vistorias' | 'localizacoes'>('bens');
  const [localizacoes] = useState<LocalizacaoRecord[]>(INITIAL_LOCALIZACOES);
  const [sliceFilter, setSliceFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSecretaria, setSelectedSecretaria] = useState(
    profile && profile.role !== 'admin' && profile.secretaria && profile.secretaria !== 'Todas' 
      ? profile.secretaria 
      : 'Todas'
  );
  const [selectedLocais, setSelectedLocais] = useState<string[]>([]);
  const [selectedDepartamentos, setSelectedDepartamentos] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'tabela' | 'cards'>('tabela');

  // Ajustar filtro automaticamente ao trocar de perfil ou secretaria lotada
  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.secretaria && profile.secretaria !== 'Todas') {
      setSelectedSecretaria(profile.secretaria);
      setSelectedLocais([]);
      setSelectedDepartamentos([]);
    } else if (profile && (profile.role === 'admin' || profile.secretaria === 'Todas')) {
      setSelectedSecretaria('Todas');
      setSelectedLocais([]);
      setSelectedDepartamentos([]);
    }
  }, [profile]);

  // Locais / Unidades disponíveis para a secretaria selecionada
  const locaisDisponiveis = useMemo(() => {
    const setLocs = new Set<string>();
    const base = selectedSecretaria === 'Todas'
      ? patrimonios
      : patrimonios.filter(p => p.secretariaSetor === selectedSecretaria);
    base.forEach(p => {
      const loc = (p.local || p.localizacaoExata || '').trim();
      if (loc) setLocs.add(loc);
    });
    return Array.from(setLocs).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [patrimonios, selectedSecretaria]);

  // Contagem de bens por Local / Unidade
  const bensCountPorLocal = useMemo(() => {
    const map: Record<string, number> = {};
    const base = selectedSecretaria === 'Todas'
      ? patrimonios
      : patrimonios.filter(p => p.secretariaSetor === selectedSecretaria);
    base.forEach(p => {
      const loc = (p.local || p.localizacaoExata || '').trim();
      if (loc) {
        map[loc] = (map[loc] || 0) + 1;
      }
    });
    return map;
  }, [patrimonios, selectedSecretaria]);

  // Departamentos disponíveis para a secretaria e locais selecionados
  const departamentosDisponiveis = useMemo(() => {
    const setDeps = new Set<string>();
    let base = selectedSecretaria === 'Todas'
      ? patrimonios
      : patrimonios.filter(p => p.secretariaSetor === selectedSecretaria);
    if (selectedLocais.length > 0) {
      const locSet = new Set(selectedLocais.map(l => l.trim().toLowerCase()));
      base = base.filter(p => locSet.has((p.local || p.localizacaoExata || '').trim().toLowerCase()));
    }
    base.forEach(p => {
      const dep = (p.departamento || '').trim();
      if (dep) setDeps.add(dep);
    });
    return Array.from(setDeps).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [patrimonios, selectedSecretaria, selectedLocais]);

  // Contagem de bens por departamento para exibir nos seletores
  const bensCountPorDepto = useMemo(() => {
    const map: Record<string, number> = {};
    let base = selectedSecretaria === 'Todas'
      ? patrimonios
      : patrimonios.filter(p => p.secretariaSetor === selectedSecretaria);
    if (selectedLocais.length > 0) {
      const locSet = new Set(selectedLocais.map(l => l.trim().toLowerCase()));
      base = base.filter(p => locSet.has((p.local || p.localizacaoExata || '').trim().toLowerCase()));
    }
    base.forEach(p => {
      const dep = (p.departamento || '').trim();
      if (dep) {
        map[dep] = (map[dep] || 0) + 1;
      }
    });
    return map;
  }, [patrimonios, selectedSecretaria, selectedLocais]);

  // Paginação e Ordenação da Base de Bens
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [sortField, setSortField] = useState<'etiqueta' | 'descricao' | 'secretaria' | 'data' | 'valor'>('etiqueta');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // mais recentes primeiro

  // Reset de página sempre que mudar a busca ou filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSecretaria, selectedLocais, selectedDepartamentos, sliceFilter]);

  // Modais
  const [showNewPatrimonioModal, setShowNewPatrimonioModal] = useState(false);
  const [editingPatrimonio, setEditingPatrimonio] = useState<PatrimonioRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<PatrimonioRecord | null>(null);
  const [showTransferModal, setShowTransferModal] = useState<PatrimonioRecord | null>(null);
  const [showVistoriaModal, setShowVistoriaModal] = useState<PatrimonioRecord | null>(null);
  const [showTermoModal, setShowTermoModal] = useState<PatrimonioRecord | null>(null);
  const [showEtiquetasModal, setShowEtiquetasModal] = useState(false);
  const [bensParaEtiquetas, setBensParaEtiquetas] = useState<PatrimonioRecord[]>([]);
  const [selectedBensIds, setSelectedBensIds] = useState<string[]>([]);
  const [showSyncCenterModal, setShowSyncCenterModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showTermosERelatoriosModal, setShowTermosERelatoriosModal] = useState(false);
  const [termoModalInitialTipo, setTermoModalInitialTipo] = useState<TipoDocumentoOficial>('termo_cautela');
  const [showPhotoSyncModal, setShowPhotoSyncModal] = useState(false);
  const [photosMap, setPhotosMap] = useState<Record<string, string>>({});
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; titulo: string; tombo: string } | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Carregar fotos cacheadas do IndexedDB no início
  useEffect(() => {
    getAllPhotosMap().then(setPhotosMap);
  }, []);

  const handlePhotoResolved = useCallback((fotoKey: string, dataUrl: string) => {
    const clean = fotoKey.trim().toLowerCase();
    const filename = clean.split('/').pop() || clean;
    setPhotosMap((prev) => {
      if (prev[clean] === dataUrl && prev[filename] === dataUrl) return prev;
      return {
        ...prev,
        [clean]: dataUrl,
        [filename]: dataUrl,
        [`patrimonios_images/${filename}`]: dataUrl,
      };
    });
  }, []);

  // Ao abrir a Ficha do Bem, buscar a foto na nuvem sob demanda se ainda não estiver no cache
  useEffect(() => {
    if (!showDetailModal?.fotoBem) return;
    const raw = showDetailModal.fotoBem.trim();
    if (!raw || raw.startsWith('http') || raw.startsWith('data:image')) return;
    const clean = raw.toLowerCase();
    const filename = clean.split('/').pop() || '';
    if (photosMap[clean] || (filename && photosMap[filename])) return;
    if (isPhotoKnownMissingInCloud(raw)) return;

    fetchAndCacheCloudPhoto(raw).then((url) => {
      if (url) handlePhotoResolved(raw, url);
    });
  }, [showDetailModal, photosMap, handlePhotoResolved]);

  // Abrir automaticamente a ficha do bem quando acessado via link direto do QR Code
  useEffect(() => {
    if (initialBemToOpen) {
      setShowDetailModal(initialBemToOpen);
      setSuccessToast(`Bem #${initialBemToOpen.etiquetaNumero || initialBemToOpen.numeroTombamento} aberto via QR Code!`);
      onConsumeInitialBem?.();
    }
  }, [initialBemToOpen, onConsumeInitialBem]);

  const getBemPhotoUrl = (fotoBem?: string): string | null => {
    if (!fotoBem) return null;
    const clean = fotoBem.trim().toLowerCase();
    if (photosMap[clean]) return photosMap[clean];
    const filename = clean.split('/').pop() || '';
    if (filename && photosMap[filename]) return photosMap[filename];
    if (fotoBem.startsWith('http') || fotoBem.startsWith('data:image')) return fotoBem;
    return null;
  };

  // Form states - Novo Patrimônio
  const [novoTombo, setNovoTombo] = useState(`DPP-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('Mobiliário em Geral');
  const [novaSecretaria, setNovaSecretaria] = useState<string>(INITIAL_LOCALIZACOES[0]?.nome || 'GABINETE DO PREFEITO');
  const [novaLocalizacao, setNovaLocalizacao] = useState('');
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [novoEstado, setNovoEstado] = useState<PatrimonioRecord['estadoConservacao']>('Excelente');
  const [novoStatus, setNovoStatus] = useState<PatrimonioRecord['status']>('Ativo / Em Uso');
  const [novoValor, setNovoValor] = useState<number>(0);
  const [novaData, setNovaData] = useState(new Date().toISOString().split('T')[0]);
  const [novaNota, setNovaNota] = useState('');
  const [novasObs, setNovasObs] = useState('');

  // Form states - Transferência
  const [transfDestino, setTransfDestino] = useState<string>(INITIAL_LOCALIZACOES[1]?.nome || 'SECRETARIA DE ADMINISTRAÇÃO');
  const [transfNovoResp, setTransfNovoResp] = useState('');
  const [transfMotivo, setTransfMotivo] = useState('');

  // Form states - Vistoria
  const [vistStatus, setVistStatus] = useState<VistoriaRecord['statusEncontrado']>('Localizado no Setor');
  const [vistParecer, setVistParecer] = useState('');

  // Lista oficial das 15 Secretarias e Órgãos mapeadas da planilha Patrimonios_AppSheet.XLSX (Aba Localizacoes)
  const secretarias = [
    'Todas',
    ...localizacoes.map(loc => loc.nome)
  ];

  // Filtering
  // Memorizado: a base tem ~6.700 bens e esta busca roda a cada render.
  const filteredBens = useMemo(() => patrimonios.filter(p => {
    // Slices filter
    if (sliceFilter === 'ativos' && p.status !== 'Ativo / Em Uso') return false;
    if (sliceFilter === 'transferencia' && p.status !== 'Em Transferência') return false;
    if (sliceFilter === 'inserviveis' && p.estadoConservacao !== 'Inservível / Ocioso') return false;
    if (sliceFilter === 'baixados' && p.status !== 'Baixado / Alienado') return false;

    // Secretaria filter
    if (selectedSecretaria !== 'Todas' && p.secretariaSetor !== selectedSecretaria) return false;

    // Local / Unidade filter (Escola, Prédio, Posto - Múltipla seleção)
    if (selectedLocais.length > 0) {
      const locBem = (p.local || p.localizacaoExata || '').trim().toLowerCase();
      const matchLoc = selectedLocais.some(l => l.trim().toLowerCase() === locBem);
      if (!matchLoc) return false;
    }

    // Departamento filter
    if (selectedDepartamentos.length > 0) {
      const depBem = (p.departamento || '').trim().toLowerCase();
      const match = selectedDepartamentos.some(d => d.trim().toLowerCase() === depBem);
      if (!match) return false;
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const isPureDigits = /^\d+$/.test(q);

      if (isPureDigits) {
        // Quando o usuário digita apenas números (ex: 1518), busca exata na Etiqueta ou ID numérico.
        // Isso evita trazer dezenas de itens alfanuméricos cujos códigos hexadecimais aleatórios
        // continham esses dígitos como substring (ex: PMC - 1518926c).
        const match =
          (p.etiquetaNumero && p.etiquetaNumero.replace(/\D/g, '') === q) ||
          p.id.trim() === q ||
          (p.numeroTombamento && p.numeroTombamento.replace(/\D/g, '') === q && !p.numeroTombamento.includes('-'));
        if (!match) return false;
      } else {
        const match = 
          (p.etiquetaNumero && p.etiquetaNumero.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q) ||
          p.numeroTombamento.toLowerCase().includes(q) ||
          p.descricao.toLowerCase().includes(q) ||
          p.responsavel.toLowerCase().includes(q) ||
          p.secretariaSetor.toLowerCase().includes(q) ||
          (p.departamento && p.departamento.toLowerCase().includes(q)) ||
          (p.localizacaoExata && p.localizacaoExata.toLowerCase().includes(q)) ||
          ((p.dataCadastro || p.atualizadoEm) && formatCadastroDate(p.dataCadastro || p.atualizadoEm, false).toLowerCase().includes(q));
        if (!match) return false;
      }
    }

    return true;
  }), [patrimonios, sliceFilter, selectedSecretaria, selectedLocais, selectedDepartamentos, searchQuery]);

  // Sorting
  const sortedBens = useMemo(() => [...filteredBens].sort((a, b) => {
    // Se a busca for numérica, coloca primeiro a etiqueta exata
    const qTrim = searchQuery.trim();
    if (/^\d+$/.test(qTrim)) {
      const aExact = (a.etiquetaNumero && a.etiquetaNumero.replace(/\D/g, '') === qTrim);
      const bExact = (b.etiquetaNumero && b.etiquetaNumero.replace(/\D/g, '') === qTrim);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
    }

    if (sortField === 'etiqueta') {
      const numA = parseInt((a.etiquetaNumero || a.numeroTombamento || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.etiquetaNumero || b.numeroTombamento || '').replace(/\D/g, ''), 10) || 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    }
    if (sortField === 'descricao') {
      return sortOrder === 'asc'
        ? a.descricao.localeCompare(b.descricao)
        : b.descricao.localeCompare(a.descricao);
    }
    if (sortField === 'secretaria') {
      return sortOrder === 'asc'
        ? a.secretariaSetor.localeCompare(b.secretariaSetor)
        : b.secretariaSetor.localeCompare(a.secretariaSetor);
    }
    if (sortField === 'data') {
      const tsA = parseCadastroTimestamp(a.dataCadastro || a.atualizadoEm);
      const tsB = parseCadastroTimestamp(b.dataCadastro || b.atualizadoEm);
      return sortOrder === 'asc' ? tsA - tsB : tsB - tsA;
    }
    if (sortField === 'valor') {
      return sortOrder === 'asc'
        ? (a.valorAquisicao || 0) - (b.valorAquisicao || 0)
        : (b.valorAquisicao || 0) - (a.valorAquisicao || 0);
    }
    return 0;
  }), [filteredBens, sortField, sortOrder, searchQuery]);

  const totalPages = Math.ceil(sortedBens.length / itemsPerPage) || 1;
  const paginatedBens = useMemo(
    () => sortedBens.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [sortedBens, currentPage, itemsPerPage]
  );

  // Buscar fotos da página atual na nuvem sob demanda (apenas itens ainda não cacheados; 1 leitura única por foto)
  const paginatedPhotoKeys = useMemo(
    () =>
      paginatedBens
        .map((b) => (b.fotoBem || '').trim())
        .filter((f) => Boolean(f) && !f.startsWith('http') && !f.startsWith('data:image'))
        .join('|'),
    [paginatedBens]
  );

  useEffect(() => {
    if (!paginatedPhotoKeys) return;
    let active = true;
    const keys = paginatedPhotoKeys.split('|').filter(Boolean);
    const missing = keys.filter((raw) => {
      const clean = raw.toLowerCase();
      const filename = clean.split('/').pop() || '';
      if (photosMap[clean] || (filename && photosMap[filename])) return false;
      return !isPhotoKnownMissingInCloud(raw);
    });

    if (missing.length === 0) return;

    (async () => {
      const BATCH = 5;
      for (let i = 0; i < missing.length; i += BATCH) {
        if (!active) break;
        const slice = missing.slice(i, i + BATCH);
        const results = await Promise.all(
          slice.map(async (raw) => ({ raw, url: await fetchAndCacheCloudPhoto(raw) }))
        );
        if (!active) break;
        results.forEach(({ raw, url }) => {
          if (url) handlePhotoResolved(raw, url);
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [paginatedPhotoKeys, handlePhotoResolved]);

  const handleToggleSort = (field: 'etiqueta' | 'descricao' | 'secretaria' | 'data' | 'valor') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'data' || field === 'etiqueta' ? 'desc' : 'asc');
    }
  };

  // KPI calculations - uma unica passagem sobre a base (antes eram 5 percursos)
  const { totalBens, bensAtivos, bensTransferencia, bensInserviveis, valorTotal } = useMemo(() => {
    let ativos = 0;
    let emTransferencia = 0;
    let inserviveis = 0;
    let valor = 0;
    for (const p of patrimonios) {
      if (p.status === 'Ativo / Em Uso') ativos++;
      else if (p.status === 'Em Transferência') emTransferencia++;
      if (p.estadoConservacao === 'Inservível / Ocioso') inserviveis++;
      valor += p.valorAquisicao || 0;
    }
    return {
      totalBens: patrimonios.length,
      bensAtivos: ativos,
      bensTransferencia: emTransferencia,
      bensInserviveis: inserviveis,
      valorTotal: valor,
    };
  }, [patrimonios]);

  // Contagens usadas em varios pontos da tela (evita refiltrar a base inteira no JSX)
  const bensComFotoCount = useMemo(() => patrimonios.reduce((acc, p) => acc + (p.fotoBem ? 1 : 0), 0), [patrimonios]);
  const bensPorSecretaria = useMemo(() => {
    const mapa = new Map<string, { total: number; valor: number }>();
    for (const p of patrimonios) {
      const atual = mapa.get(p.secretariaSetor) || { total: 0, valor: 0 };
      atual.total += 1;
      atual.valor += p.valorAquisicao || 0;
      mapa.set(p.secretariaSetor, atual);
    }
    return mapa;
  }, [patrimonios]);
  const bensSelecionados = useMemo(
    () => (selectedBensIds.length === 0 ? [] : patrimonios.filter(p => selectedBensIds.includes(p.id))),
    [patrimonios, selectedBensIds]
  );

  const handleSaveNovoPatrimonio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTombo || !novaDescricao || !novoResponsavel) {
      alert('Preencha os campos obrigatórios (Tombo, Descrição e Responsável).');
      return;
    }

    const novo: PatrimonioRecord = {
      id: `pat_${Date.now()}`,
      numeroTombamento: novoTombo.trim(),
      descricao: novaDescricao.trim(),
      categoria: novaCategoria,
      secretariaSetor: novaSecretaria,
      localizacaoExata: novaLocalizacao.trim() || undefined,
      responsavel: novoResponsavel.trim(),
      estadoConservacao: novoEstado,
      status: novoStatus,
      valorAquisicao: Number(novoValor) || 0,
      dataAquisicao: novaData,
      numeroNotaFiscal: novaNota.trim() || undefined,
      observacoes: novasObs.trim() || undefined,
      cadastradoPor: profile?.email || 'dpp@capanema.pa.gov.br',
      atualizadoEm: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    onAddPatrimonio(novo);
    setShowNewPatrimonioModal(false);

    // Reset
    setNovoTombo(`DPP-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setNovaDescricao('');
    setNovoResponsavel('');
    setNovaLocalizacao('');
    setNovoValor(0);
    setNovasObs('');
  };

  const handleConfirmDeleteBem = (bem: PatrimonioRecord) => {
    if (!isAdmin || !onDeletePatrimonio) return;
    const etiqueta = bem.etiquetaNumero || bem.numeroTombamento || bem.id;
    const confirmado = window.confirm(
      `Deseja realmente excluir o bem #${etiqueta} ("${bem.descricao}")?\n\nA exclusão será sincronizada automaticamente em todos os aparelhos da equipe.`
    );
    if (!confirmado) return;
    onDeletePatrimonio(bem);
    setSelectedBensIds(prev => prev.filter(id => id !== bem.id));
    if (showDetailModal?.id === bem.id) {
      setShowDetailModal(null);
    }
    setSuccessToast(`Bem #${etiqueta} excluído e sincronizado na nuvem.`);
  };

  const handleSaveAppSheetRecord = (record: PatrimonioRecord) => {
    if (editingPatrimonio) {
      onUpdatePatrimonio(record);
      setEditingPatrimonio(null);
      setSuccessToast(`Bem atualizado com sucesso! (Etiqueta #${record.etiquetaNumero || record.numeroTombamento})`);
    } else {
      onAddPatrimonio(record);
      setShowNewPatrimonioModal(false);
      setSuccessToast(`Novo bem cadastrado com sucesso! (Etiqueta #${record.etiquetaNumero || record.numeroTombamento})`);
    }
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTransferModal || !transfDestino || !transfNovoResp) return;

    const novaTransferencia: TransferenciaRecord = {
      id: `transf_${Date.now()}`,
      patrimonioId: showTransferModal.id,
      patrimonioNumero: showTransferModal.numeroTombamento,
      patrimonioDescricao: showTransferModal.descricao,
      dataTransferencia: new Date().toISOString().replace('T', ' ').substring(0, 19),
      secretariaOrigem: showTransferModal.secretariaSetor,
      secretariaDestino: transfDestino,
      responsavelOrigem: showTransferModal.responsavel,
      novoResponsavel: transfNovoResp.trim(),
      motivo: transfMotivo.trim() || 'Remanejamento patrimonial entre setores',
      autorizadoPor: profile ? `${profile.nome} (${profile.email})` : 'Diretoria de Patrimônio Público (DPP)',
      termoGerado: true,
    };

    onAddTransferencia(novaTransferencia);

    // Update the asset
    onUpdatePatrimonio({
      ...showTransferModal,
      secretariaSetor: transfDestino,
      responsavel: transfNovoResp.trim(),
      status: 'Ativo / Em Uso',
      atualizadoEm: new Date().toISOString().replace('T', ' ').substring(0, 19),
    });

    const tomboLabel = showTransferModal.etiquetaNumero || showTransferModal.numeroTombamento;
    setShowTransferModal(null);
    setTransfNovoResp('');
    setTransfMotivo('');
    setSuccessToast(`Transferência do bem #${tomboLabel} registrada com sucesso!`);
  };

  const handleConfirmVistoria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showVistoriaModal) return;

    const novaVistoria: VistoriaRecord = {
      id: `vist_${Date.now()}`,
      patrimonioId: showVistoriaModal.id,
      patrimonioNumero: showVistoriaModal.numeroTombamento,
      patrimonioDescricao: showVistoriaModal.descricao,
      dataVistoria: new Date().toISOString().split('T')[0],
      statusEncontrado: vistStatus,
      vistoriador: profile ? `${profile.nome}${profile.secretaria && profile.secretaria !== 'Todas' ? ` (${profile.secretaria})` : ''}` : 'Comissão de Inventário / DPP',
      parecer: vistParecer.trim() || 'Vistoria física realizada com sucesso.',
    };

    const tomboLabel = showVistoriaModal.etiquetaNumero || showVistoriaModal.numeroTombamento;
    onAddVistoria(novaVistoria);
    setShowVistoriaModal(null);
    setVistParecer('');
    setSuccessToast(`Vistoria registrada com sucesso para o bem #${tomboLabel}!`);
  };

  return (
    <div className="space-y-6">
      {/* Banner Institucional Oficial - Prefeitura de Capanema PA */}
      <div className="bg-gradient-to-r from-[#17153b] via-[#1e1b4b] to-[#12102e] rounded-2xl p-3.5 sm:p-5 border border-blue-500/30 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-white/10 p-1.5 border border-white/20 shrink-0 flex items-center justify-center shadow-inner">
            <img 
              src="/assets/aistudio/brasao_capanema_limpo.png" 
              alt="Brasão Prefeitura Municipal de Capanema - PA" 
              className="h-full w-auto object-contain drop-shadow" 
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-amber-400">
                PREFEITURA MUNICIPAL DE CAPANEMA • PARÁ
              </span>
              <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/40 px-2 py-0.2 rounded-full font-bold">
                Gestão 2025–2028
              </span>
            </div>
            <h1 className="text-base sm:text-xl font-black tracking-tight text-white mt-0.5">
              Diretoria de Patrimônio Público (DPP)
            </h1>
            <p className="text-xs text-slate-300/90 mt-0.5 line-clamp-1">
              Controle Setorial Integrado • Tombamento & Rastreabilidade de Bens Públicos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={() => setShowScannerModal(true)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Vistoria / Scanner</span>
          </button>
          <button
            onClick={() => setShowEtiquetasModal(true)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Etiquetas</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3.5 w-full max-w-full">
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold gap-1">
            <span className="truncate">Total de Bens</span>
            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5 sm:mt-2 font-mono">{totalBens}</div>
          <span className="text-[10px] text-slate-400 mt-1 truncate">Tombados no DPP</span>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold gap-1">
            <span className="truncate">Bens em Uso</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1.5 sm:mt-2 font-mono">{bensAtivos}</div>
          <span className="text-[10px] text-emerald-600/80 mt-1 truncate">Nas Secretarias</span>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold gap-1">
            <span className="truncate">Transferência</span>
            <ArrowRightLeft className="w-4 h-4 text-indigo-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1.5 sm:mt-2 font-mono">{bensTransferencia}</div>
          <span className="text-[10px] text-indigo-600/80 mt-1 truncate">Guias Pendentes</span>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold gap-1">
            <span className="truncate">Inservíveis</span>
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1.5 sm:mt-2 font-mono">{bensInserviveis}</div>
          <span className="text-[10px] text-amber-600/80 mt-1 truncate">Para Baixa / Leilão</span>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-xl p-3 sm:p-4 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1 min-w-0">
          <div className="flex items-center justify-between text-blue-300 text-xs font-semibold gap-1">
            <span className="truncate">Valor Patrimonial Total</span>
            <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1.5 sm:mt-2 font-mono truncate">
            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-[10px] text-slate-300 mt-1 truncate">Ativo Imobilizado Municipal</span>
        </div>
      </div>

      {/* Main Container with Sub-navigation and Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3 sm:p-5 space-y-4 w-full max-w-full overflow-hidden">
        {/* Top bar with module tabs & single-row action toolbar */}
        <div className="flex flex-col gap-3 pb-3 border-b border-slate-100 w-full max-w-full">
          {/* Linha 1: Abas do módulo (todas visíveis sem corte) */}
          <div className="w-full overflow-x-auto scrollbar-none">
            <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-max">
              <button
                onClick={() => setActiveSubTab('bens')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  activeSubTab === 'bens'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inventário ({patrimonios.length})
              </button>
              <button
                onClick={() => setActiveSubTab('transferencias')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  activeSubTab === 'transferencias'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Transferências ({transferencias.length})
              </button>
              <button
                onClick={() => setActiveSubTab('vistorias')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  activeSubTab === 'vistorias'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vistorias ({vistorias.length})
              </button>
              <button
                onClick={() => setActiveSubTab('localizacoes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  activeSubTab === 'localizacoes'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Secretarias ({localizacoes.length})
              </button>
            </div>
          </div>

          {/* Linha 2: Menu de ações em linha única com "Novo Bem" em primeiro */}
          <div className="w-full overflow-x-auto scrollbar-none">
            <div className="flex flex-nowrap items-center gap-2 w-max">
              {/* 1. Cadastrar Novo Bem (em primeiro — Admin e Gerentes) */}
              {canCreatePatrimonio && (
                <button
                  onClick={() => setShowNewPatrimonioModal(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Novo Bem</span>
                </button>
              )}

              {/* 2. Vistoria em Campo com Câmera e QR Code */}
              <button
                onClick={() => setShowScannerModal(true)}
                className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
                title="Auditoria em campo com câmera do celular para leitura de QR Code"
              >
                <Camera className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>Vistoria / Scanner</span>
              </button>

              {/* 3. Impressão de Etiquetas 5 × 3,5 cm */}
              <button
                onClick={() => {
                  if (selectedBensIds.length > 0) {
                    const selecionados = bensSelecionados;
                    setBensParaEtiquetas(selecionados);
                  } else {
                    setBensParaEtiquetas(paginatedBens);
                  }
                  setShowEtiquetasModal(true);
                }}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all border border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                title="Gerador de Etiquetas Oficiais Capanema 5 × 3,5 cm (Térmica e A4)"
              >
                <Printer className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Etiquetas 5×3,5</span>
                {selectedBensIds.length > 0 && (
                  <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                    {selectedBensIds.length}
                  </span>
                )}
              </button>

              {/* 4. Termos Oficiais e Relatórios TCM */}
              <button
                onClick={() => setShowTermosERelatoriosModal(true)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                title="Emissão de Termos de Responsabilidade, Cautela e Relatórios TCM/TCE"
              >
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Termos & Relatórios</span>
              </button>

              {/* 5. Fotos do AppSheet (Apenas Admin DPP) */}
              {isAdmin && (
                <button
                  onClick={() => setShowPhotoSyncModal(true)}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
                  title="Vincular e importar fotos do acervo AppSheet (Patrimonios_Images)"
                >
                  <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Fotos AppSheet ({bensComFotoCount})</span>
                </button>
              )}

              {/* 6. Sincronização e Carga em Nuvem no Firebase (Apenas Admin DPP) */}
              {isAdmin && (
                <button
                  onClick={() => setShowSyncCenterModal(true)}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  title="Carga em lote e sincronização com o banco de dados na nuvem"
                >
                  <Cloud className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Nuvem Firebase</span>
                </button>
              )}

              {/* 7. Acesso no Celular / PWA dos Fiscais de Campo */}
              <div className="shrink-0">
                <PWAInstallButton />
              </div>
            </div>
          </div>
        </div>

        {/* View when in 'bens' tab */}
        {activeSubTab === 'bens' && (
          <div className="space-y-4">
            {/* Slices Pills and Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Slices equivalents */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'todos', label: 'Todos os Bens' },
                  { id: 'ativos', label: 'Ativos em Uso' },
                  { id: 'transferencia', label: 'Em Transferência' },
                  { id: 'inserviveis', label: 'Inservíveis / Ociosos' },
                  { id: 'baixados', label: 'Baixados' },
                ].map((sl) => (
                  <button
                    key={sl.id}
                    onClick={() => setSliceFilter(sl.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      sliceFilter === sl.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sl.label}
                  </button>
                ))}
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('tabela')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    viewMode === 'tabela' ? 'bg-blue-100 text-blue-800' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Tabela
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    viewMode === 'cards' ? 'bg-blue-100 text-blue-800' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Cards (Deck)
                </button>
              </div>
            </div>

            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
              <div className="relative sm:col-span-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Pesquisar por Etiqueta Nº, Descrição, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-sm font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Limpar pesquisa"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="sm:col-span-3">
                <select
                  value={selectedSecretaria}
                  onChange={(e) => {
                    setSelectedSecretaria(e.target.value);
                    setSelectedLocais([]);
                    setSelectedDepartamentos([]);
                  }}
                  className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
                  title="Filtrar por Secretaria"
                >
                  {secretarias.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Filtro: Local / Unidade (Escola, Posto, Prédio - Múltipla Seleção) */}
              <div className="sm:col-span-3">
                <MultiLocalSelector
                  locais={locaisDisponiveis}
                  selectedLocais={selectedLocais}
                  onChange={(novos) => {
                    setSelectedLocais(novos);
                    setSelectedDepartamentos([]);
                  }}
                  bensCountMap={bensCountPorLocal}
                />
              </div>

              <div className="sm:col-span-3 flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <MultiDepartamentoSelector
                    departamentos={departamentosDisponiveis}
                    selectedDepartamentos={selectedDepartamentos}
                    onChange={setSelectedDepartamentos}
                    bensCountMap={bensCountPorDepto}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTermoModalInitialTipo('relatorio_simplificado');
                    setShowTermosERelatoriosModal(true);
                  }}
                  className="px-3 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0 active:scale-95 cursor-pointer"
                  title={`Emitir Relatório em PDF com somente Tombamento e Descrição (${selectedSecretaria}${selectedLocais.length > 0 ? ` - ${selectedLocais.length} Locais` : ''}${selectedDepartamentos.length > 0 ? ` - ${selectedDepartamentos.length} Departamentos` : ''})`}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-200" />
                  <span className="hidden sm:inline">Relatório PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>
              </div>
            </div>

            {/* Chips dos Locais / Unidades Selecionados no Filtro */}
            {selectedLocais.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
                <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                  <span>Locais incluídos:</span>
                  <strong className="font-mono font-bold bg-indigo-100 text-indigo-900 px-1.5 py-0.2 rounded text-[10px]">
                    {selectedLocais.length}
                  </strong>
                </span>
                {selectedLocais.map((loc) => (
                  <span
                    key={loc}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-950 border border-indigo-200 shadow-2xs"
                  >
                    <span className="truncate max-w-[200px]">{loc}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLocais(selectedLocais.filter(l => l !== loc));
                        setSelectedDepartamentos([]);
                      }}
                      className="text-indigo-600 hover:text-indigo-950 font-bold ml-1 cursor-pointer"
                      title="Remover local"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocais([]);
                    setSelectedDepartamentos([]);
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1 cursor-pointer"
                >
                  Limpar Locais
                </button>
              </div>
            )}

            {/* Chips dos Departamentos Selecionados no Filtro */}
            {selectedDepartamentos.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
                <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                  <span>Filtrando Deptos:</span>
                  <strong className="font-mono font-bold bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded text-[10px]">
                    {selectedDepartamentos.length}
                  </strong>
                </span>
                {selectedDepartamentos.map((dep) => (
                  <span
                    key={dep}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs"
                  >
                    <span className="truncate max-w-[200px]">{dep}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDepartamentos(selectedDepartamentos.filter(d => d !== dep))}
                      className="text-blue-600 hover:text-blue-950 font-bold ml-1 cursor-pointer"
                      title="Remover departamento"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedDepartamentos([])}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1 cursor-pointer"
                >
                  Limpar Todos
                </button>
              </div>
            )}

            {/* Barra de Ações em Lote para Bens Selecionados */}
            {selectedBensIds.length > 0 && (
              <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-semibold">
                    <strong>{selectedBensIds.length}</strong> {selectedBensIds.length === 1 ? 'bem selecionado' : 'bens selecionados'} para impressão
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const selecionados = bensSelecionados;
                      setBensParaEtiquetas(selecionados);
                      setShowEtiquetasModal(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Gerar Etiquetas ({selectedBensIds.length})
                  </button>
                  <button
                    onClick={() => {
                      const allPageIds = paginatedBens.map(b => b.id);
                      setSelectedBensIds(prev => Array.from(new Set([...prev, ...allPageIds])));
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors text-[11px]"
                  >
                    + Página Atual
                  </button>
                  <button
                    onClick={() => setSelectedBensIds([])}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-[11px]"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}

            {/* List / Table */}
            {viewMode === 'tabela' ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold select-none">
                      <th className="py-3 px-3 text-center w-8">
                        <input
                          type="checkbox"
                          checked={paginatedBens.length > 0 && paginatedBens.every(b => selectedBensIds.includes(b.id))}
                          onChange={() => {
                            const pageIds = paginatedBens.map(b => b.id);
                            const allSelected = pageIds.every(id => selectedBensIds.includes(id));
                            if (allSelected) {
                              setSelectedBensIds(prev => prev.filter(id => !pageIds.includes(id)));
                            } else {
                              setSelectedBensIds(prev => Array.from(new Set([...prev, ...pageIds])));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Selecionar todos os bens desta página"
                        />
                      </th>
                      <th className="py-3 px-2 text-center w-12">Foto</th>
                      <th 
                        onClick={() => handleToggleSort('etiqueta')}
                        className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1">
                          <span>Etiqueta / ID</span>
                          {sortField === 'etiqueta' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleToggleSort('data')}
                        className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                        title="Ordenar pela data de cadastro do tombo"
                      >
                        <div className="flex items-center gap-1">
                          <span>Data do Tombo</span>
                          {sortField === 'data' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleToggleSort('descricao')}
                        className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Descrição do Bem</span>
                          {sortField === 'descricao' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleToggleSort('secretaria')}
                        className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Secretaria</span>
                          {sortField === 'secretaria' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-3">Local / Unidade</th>
                      <th className="py-3 px-3">Departamento</th>
                      <th className="py-3 px-3">Responsável</th>
                      <th className="py-3 px-2 text-center">Estado</th>
                      <th className="py-3 px-2 text-center">Status</th>
                      <th 
                        onClick={() => handleToggleSort('valor')}
                        className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Valor</span>
                          {sortField === 'valor' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedBens.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-8 text-center text-slate-400">
                          Nenhum bem patrimonial encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      paginatedBens.map((bem) => (
                        <tr 
                          key={bem.id} 
                          className={`transition-colors ${
                            selectedBensIds.includes(bem.id) ? 'bg-blue-50/70' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedBensIds.includes(bem.id)}
                              onChange={() => {
                                setSelectedBensIds(prev => 
                                  prev.includes(bem.id) ? prev.filter(x => x !== bem.id) : [...prev, bem.id]
                                );
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {(() => {
                              const photoUrl = getBemPhotoUrl(bem.fotoBem);
                              if (photoUrl) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setLightboxPhoto({ url: photoUrl, titulo: bem.descricao, tombo: bem.numeroTombamento })}
                                    className="relative group w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 shadow-2xs mx-auto block cursor-pointer transition-all"
                                    title="Clique para ampliar a foto do bem"
                                  >
                                    <img src={photoUrl} alt={bem.descricao} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                      <ZoomIn className="w-3.5 h-3.5" />
                                    </div>
                                  </button>
                                );
                              }
                              if (bem.fotoBem) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setShowPhotoSyncModal(true)}
                                    className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto hover:bg-amber-100 transition-colors group"
                                    title={`Foto original do AppSheet: ${bem.fotoBem.split('/').pop()}. Clique para carregar a pasta de fotos.`}
                                  >
                                    <ImageIcon className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                                  </button>
                                );
                              }
                              return (
                                <span className="text-[10px] text-slate-300 font-mono">—</span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-3 font-mono text-blue-900 whitespace-nowrap">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm text-blue-950">
                                  #{bem.etiquetaNumero || bem.numeroTombamento}
                                </span>
                                {bem.isOfflinePending && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Cadastrado no dispositivo (Offline). Sincronizará automaticamente ao reconectar.">
                                    <CloudOff className="w-2.5 h-2.5" />
                                    Offline
                                  </span>
                                )}
                              </div>
                              {bem.id && bem.id !== (bem.etiquetaNumero || bem.numeroTombamento) && (
                                <span className="text-[10px] text-slate-400 font-normal truncate max-w-[130px]" title={`ID AppSheet: ${bem.id}`}>
                                  ID: {bem.id}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="py-3 px-3 whitespace-nowrap text-slate-700"
                            title={(bem.dataCadastro || bem.atualizadoEm) ? `Tombo cadastrado em ${formatCadastroDate(bem.dataCadastro || bem.atualizadoEm, false)}` : 'Data não informada'}
                          >
                            {(() => {
                              const dataFmt = formatCadastroDate(bem.dataCadastro || bem.atualizadoEm, false);
                              return (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-800">
                                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                  {dataFmt === 'Não informada' ? '—' : dataFmt}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-900 max-w-xs">
                            <div className="line-clamp-2">{bem.descricao}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{bem.categoria}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            <span className="font-semibold text-slate-800 text-[11px] block">{bem.secretariaSetor}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            <div className="flex items-center gap-1 font-semibold text-blue-950 text-xs">
                              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate max-w-[160px]">{bem.local || bem.localizacaoExata || 'Sede / Geral'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            <div className="flex items-center gap-1 text-[11px] text-slate-600">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-800">{bem.departamento || 'Setor Geral'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-800 font-medium">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[150px]">{formatResponsavelNome(bem.responsavel)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              bem.estadoConservacao === 'Excelente' ? 'bg-emerald-100 text-emerald-800' :
                              bem.estadoConservacao === 'Bom' ? 'bg-blue-100 text-blue-800' :
                              bem.estadoConservacao === 'Regular' ? 'bg-slate-200 text-slate-700' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {bem.estadoConservacao}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              bem.status === 'Ativo / Em Uso' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              bem.status === 'Em Transferência' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {bem.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {bem.valorAquisicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setBensParaEtiquetas([bem]);
                                  setShowEtiquetasModal(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Imprimir Etiqueta Oficial (QR Code & Código de Barras)"
                              >
                                <Tag className="w-4 h-4 text-emerald-600" />
                              </button>
                              <button
                                onClick={() => setShowDetailModal(bem)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Visualizar Ficha do Bem"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canEditSecretaria(bem.secretariaSetor) ? (
                                <>
                                  <button
                                    onClick={() => setEditingPatrimonio(bem)}
                                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                    title="Editar Patrimônio (Formulário AppSheet)"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setShowTransferModal(bem)}
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Transferir Secretaria / Responsável"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <span
                                  className="p-1.5 text-slate-300 inline-flex items-center justify-center cursor-not-allowed"
                                  title={`Edição restrita: Bem sob guarda da ${bem.secretariaSetor}. Apenas o Gerente titular ou Admin pode alterar.`}
                                >
                                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                                </span>
                              )}
                              {canRegisterVistoria && (
                                <button
                                  onClick={() => setShowVistoriaModal(bem)}
                                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Registrar Vistoria"
                                >
                                  <ClipboardCheck className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setShowTermoModal(bem)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Emitir Termo de Responsabilidade"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {isAdmin && onDeletePatrimonio && (
                                <button
                                  onClick={() => handleConfirmDeleteBem(bem)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Excluir bem (sincroniza em todos os aparelhos)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Deck / Cards View */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedBens.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
                    Nenhum bem patrimonial encontrado com os filtros selecionados.
                  </div>
                ) : (
                  paginatedBens.map((bem) => (
                    <div
                      key={bem.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              #{bem.etiquetaNumero || bem.numeroTombamento}
                            </span>
                            {bem.id && bem.id !== (bem.etiquetaNumero || bem.numeroTombamento) && (
                              <span className="text-[10px] text-slate-400 font-mono" title={`ID AppSheet: ${bem.id}`}>
                                ID: {bem.id}
                              </span>
                            )}
                            {bem.isOfflinePending && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <CloudOff className="w-2.5 h-2.5" />
                                Offline
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {bem.status}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 mt-2 line-clamp-2">
                          {bem.descricao}
                        </h4>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{bem.secretariaSetor}</span>
                          </div>
                          {(bem.local || bem.localizacaoExata) && (
                            <div className="flex items-center gap-1.5 font-semibold text-blue-950">
                              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate">{bem.local || bem.localizacaoExata}</span>
                            </div>
                          )}
                          {bem.departamento && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{bem.departamento}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{formatResponsavelNome(bem.responsavel)}</span>
                          </div>
                          {(bem.dataCadastro || bem.atualizadoEm) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">Cadastrado em {formatCadastroDate(bem.dataCadastro || bem.atualizadoEm, false)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {bem.valorAquisicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setBensParaEtiquetas([bem]);
                              setShowEtiquetasModal(true);
                            }}
                            className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                            title="Imprimir Etiqueta Oficial"
                          >
                            <Tag className="w-3 h-3" />
                            Etiqueta
                          </button>
                          <button
                            onClick={() => setShowDetailModal(bem)}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            Ficha
                          </button>
                          {canEditSecretaria(bem.secretariaSetor) && (
                            <>
                              <button
                                onClick={() => setEditingPatrimonio(bem)}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => setShowTransferModal(bem)}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                              >
                                Transferir
                              </button>
                              {isAdmin && onDeletePatrimonio && (
                                <button
                                  onClick={() => handleConfirmDeleteBem(bem)}
                                  className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                                >
                                  Excluir
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Barra de Paginação para a Base Completa de 6.663 Bens */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-slate-600">
                <span>
                  Mostrando <strong className="text-slate-900 font-bold">{sortedBens.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> a <strong className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, sortedBens.length)}</strong> de <strong className="text-indigo-700 font-bold font-mono">{sortedBens.length.toLocaleString('pt-BR')}</strong> bens
                </span>
                {searchQuery.trim() && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium text-[10px]">
                    Filtro Ativo: &ldquo;{searchQuery}&rdquo;
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span>Itens por pág:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-slate-300 rounded px-2 py-1 text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Primeira página"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="px-3 py-1 font-mono font-bold text-slate-800 text-xs">
                    Página {currentPage} de {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Próxima página"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Última página"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View when in 'transferencias' tab */}
        {activeSubTab === 'transferencias' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-800">
                Histórico de Guias e Transferências de Patrimônio
              </h4>
              <span className="text-xs text-slate-500">Total: {transferencias.length} movimentações</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Tombamento</th>
                    <th className="py-2.5 px-3">Descrição do Bem</th>
                    <th className="py-2.5 px-3">Secretaria Origem</th>
                    <th className="py-2.5 px-3">Secretaria Destino</th>
                    <th className="py-2.5 px-3">Novo Responsável</th>
                    <th className="py-2.5 px-3">Motivo</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transferencias.map(tr => (
                    <tr key={tr.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{tr.dataTransferencia}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{tr.patrimonioNumero}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{tr.patrimonioDescricao}</td>
                      <td className="py-2.5 px-3 text-slate-700">{tr.secretariaOrigem}</td>
                      <td className="py-2.5 px-3 font-semibold text-indigo-800">{tr.secretariaDestino}</td>
                      <td className="py-2.5 px-3 text-slate-800">{tr.novoResponsavel}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs">{tr.motivo || '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setTermoModalInitialTipo('termo_transferencia');
                            setShowTermosERelatoriosModal(true);
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                          title="Imprimir Guia Oficial de Remessa e Transferência"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Guia Oficial</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View when in 'vistorias' tab */}
        {activeSubTab === 'vistorias' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-800">
                Histórico de Vistorias e Conferências de Inventário
              </h4>
              <span className="text-xs text-slate-500">Total: {vistorias.length} vistorias</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Tombamento</th>
                    <th className="py-2.5 px-3">Descrição do Bem</th>
                    <th className="py-2.5 px-3">Status Encontrado</th>
                    <th className="py-2.5 px-3">Parecer da Comissão</th>
                    <th className="py-2.5 px-3">Vistoriador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vistorias.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{v.dataVistoria}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{v.patrimonioNumero}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{v.patrimonioDescricao}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          v.statusEncontrado === 'Localizado no Setor' ? 'bg-emerald-100 text-emerald-800' :
                          v.statusEncontrado === 'Aguardando Descarte' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {v.statusEncontrado}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-sm">{v.parecer || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-700">{v.vistoriador}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View when in 'localizacoes' tab (15 Secretarias Oficiais) */}
        {activeSubTab === 'localizacoes' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Secretarias, Departamentos e Locais Oficiais de Capanema (15)
                </h4>
                <p className="text-xs text-slate-500">
                  Estrutura oficial extraída da aba <strong className="font-semibold text-slate-700">Localizacoes</strong> da planilha <strong className="font-semibold text-slate-700">Patrimonios_AppSheet.XLSX</strong>.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {localizacoes.length} Órgãos Cadastrados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {localizacoes.map((loc) => {
                const dadosDaSec = bensPorSecretaria.get(loc.nome);
                const totalDaSec = dadosDaSec?.total || 0;
                const valorDestaSec = dadosDaSec?.valor || 0;
                return (
                  <div
                    key={loc.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          ID #{loc.id}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {loc.cidade}
                        </span>
                      </div>

                      <h5 className="text-xs font-bold text-slate-900 mt-2.5 line-clamp-2 leading-tight">
                        {loc.nome}
                      </h5>

                      <div className="mt-2 text-xs text-slate-600 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] text-slate-600 leading-snug">{loc.endereco}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] text-slate-400 font-medium">Bens Vinculados</span>
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {totalDaSec} bens ({valorDestaSec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTermoModalInitialTipo('relatorio_simplificado');
                            setSelectedSecretaria(loc.nome);
                            setSelectedLocais([]);
                            setSelectedDepartamentos([]);
                            setShowTermosERelatoriosModal(true);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          title={`Gerar Relatório em PDF com Tombamento e Descrição (${loc.nome})`}
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSecretaria(loc.nome);
                            setSelectedLocais([]);
                            setSelectedDepartamentos([]);
                            setActiveSubTab('bens');
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          Filtrar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Formulário Oficial AppSheet (Idêntico ao App) */}
      <AppSheetPatrimonioForm
        isOpen={showNewPatrimonioModal || !!editingPatrimonio}
        onClose={() => {
          setShowNewPatrimonioModal(false);
          setEditingPatrimonio(null);
        }}
        onSave={handleSaveAppSheetRecord}
        initialData={editingPatrimonio}
        totalExistingRecords={6664 + patrimonios.length}
      />

      {/* Modal: Ficha Detalhada do Bem */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Etiqueta #{showDetailModal.etiquetaNumero || showDetailModal.numeroTombamento}
                  </span>
                  {showDetailModal.id && showDetailModal.id !== (showDetailModal.etiquetaNumero || showDetailModal.numeroTombamento) && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      (ID: {showDetailModal.id})
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">Ficha Cadastral do Bem</h3>
              </div>
              <button onClick={() => setShowDetailModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Foto do Bem no Modal de Detalhes */}
            {(() => {
              const photoUrl = getBemPhotoUrl(showDetailModal.fotoBem);
              if (photoUrl) {
                return (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 mt-3 group bg-slate-900 max-h-56 flex items-center justify-center">
                    <img src={photoUrl} alt={showDetailModal.descricao} className="max-h-56 w-auto object-contain mx-auto" />
                    <button
                      type="button"
                      onClick={() => setLightboxPhoto({ url: photoUrl, titulo: showDetailModal.descricao, tombo: showDetailModal.numeroTombamento })}
                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[11px] font-bold flex items-center gap-1 hover:bg-black/80 transition-colors"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      Ampliar Foto
                    </button>
                  </div>
                );
              }
              if (showDetailModal.fotoBem) {
                return (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold block">Foto Registrada no AppSheet</span>
                        <span className="text-[10px] text-amber-800 font-mono">{showDetailModal.fotoBem}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPhotoSyncModal(true)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shrink-0"
                    >
                      Carregar Pasta
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold">Descrição do Bem</span>
                <span className="text-slate-900 font-bold text-sm">{showDetailModal.descricao}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-slate-500 block text-[11px]">Categoria</span>
                  <span className="font-medium text-slate-800">{showDetailModal.categoria}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Estado de Conservação</span>
                  <span className="font-semibold text-emerald-700">{showDetailModal.estadoConservacao}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-slate-500 block text-[11px]">Secretaria / Lotação</span>
                  <span className="font-medium text-slate-800">{showDetailModal.secretariaSetor}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Local / Unidade</span>
                  <span className="font-semibold text-blue-950">{showDetailModal.local || showDetailModal.localizacaoExata || 'Sede / Geral'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-slate-500 block text-[11px]">Departamento / Sala</span>
                  <span className="font-medium text-slate-800">{showDetailModal.departamento || 'Setor Geral'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Servidor Responsável</span>
                  <span className="font-semibold text-slate-900">{formatResponsavelNome(showDetailModal.responsavel)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-slate-500 block text-[11px]">Valor Contábil / Aquisição</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {showDetailModal.valorAquisicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Situação Cadastral</span>
                  <span className="font-semibold text-slate-800">{showDetailModal.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-500 block text-[11px] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-600" />
                    Data de Cadastro / Registro
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatCadastroDate(showDetailModal.dataCadastro || showDetailModal.atualizadoEm, false)}
                  </span>
                </div>
                {showDetailModal.cadastradoPor && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">Cadastrado por</span>
                    <span className="font-medium text-slate-700 truncate block" title={showDetailModal.cadastradoPor}>
                      {showDetailModal.cadastradoPor}
                    </span>
                  </div>
                )}
              </div>

              {(showDetailModal.marcaModelo || showDetailModal.numeroSerie) && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {showDetailModal.marcaModelo && (
                    <div>
                      <span className="text-slate-500 block text-[11px]">Marca / Modelo</span>
                      <span className="font-medium text-slate-800">{showDetailModal.marcaModelo}</span>
                    </div>
                  )}
                  {showDetailModal.numeroSerie && (
                    <div>
                      <span className="text-slate-500 block text-[11px]">Nº de Série / Chassi</span>
                      <span className="font-mono font-medium text-indigo-700">{showDetailModal.numeroSerie}</span>
                    </div>
                  )}
                </div>
              )}

              {showDetailModal.servidorDetentor && (
                <div className="pt-2">
                  <span className="text-slate-500 block text-[11px]">Servidor Detentor (Guarda Direta)</span>
                  <span className="font-medium text-slate-800">{showDetailModal.servidorDetentor}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                {showDetailModal.numeroNotaFiscal && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">Nota Fiscal / Empenho</span>
                    <span className="font-mono text-slate-800">{showDetailModal.numeroNotaFiscal}</span>
                  </div>
                )}
                {showDetailModal.garantiaAte && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">Garantia do Fabricante Até</span>
                    <span className="font-mono text-slate-800">{showDetailModal.garantiaAte}</span>
                  </div>
                )}
              </div>

              {showDetailModal.observacoes && (
                <div className="pt-2">
                  <span className="text-slate-500 block text-[11px]">Observações / Histórico</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 text-[11px] leading-relaxed">
                    {showDetailModal.observacoes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
              {canRegisterVistoria && (
                <button
                  onClick={() => {
                    const b = showDetailModal;
                    setShowDetailModal(null);
                    setShowVistoriaModal(b);
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Vistoriar Bem
                </button>
              )}
              <button
                onClick={() => {
                  const b = showDetailModal;
                  setBensParaEtiquetas([b]);
                  setShowEtiquetasModal(true);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Tag className="w-3.5 h-3.5" />
                Imprimir Etiqueta (QR Code)
              </button>
              {canEditSecretaria(showDetailModal.secretariaSetor) && (
                <button
                  onClick={() => {
                    const b = showDetailModal;
                    setShowDetailModal(null);
                    setEditingPatrimonio(b);
                  }}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Editar no Formulário
                </button>
              )}
              <button
                onClick={() => {
                  const b = showDetailModal;
                  setShowDetailModal(null);
                  setShowTermoModal(b);
                }}
                className="px-3.5 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Termo
              </button>
              {isAdmin && onDeletePatrimonio && (
                <button
                  onClick={() => handleConfirmDeleteBem(showDetailModal)}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Bem
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(null)}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transferência */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Transferência de Lotação Patrimonial</h3>
            <p className="text-xs text-slate-500 mt-1">
              Transferindo o bem <strong>{showTransferModal.numeroTombamento}</strong> ({showTransferModal.descricao}).
            </p>

            <form onSubmit={handleConfirmTransfer} className="space-y-4 mt-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div><span className="text-slate-500">Secretaria Origem:</span> <strong>{showTransferModal.secretariaSetor}</strong></div>
                <div><span className="text-slate-500">Responsável Atual:</span> <strong>{formatResponsavelNome(showTransferModal.responsavel)}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Secretaria de Destino *
                </label>
                <select
                  value={transfDestino}
                  onChange={(e) => setTransfDestino(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  {secretarias.filter(s => s !== 'Todas').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {localizacoes.find(l => l.nome === transfDestino) && (
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{localizacoes.find(l => l.nome === transfDestino)?.endereco}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Novo Servidor Responsável (Carga) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome do servidor que assume o bem"
                  value={transfNovoResp}
                  onChange={(e) => setTransfNovoResp(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo da Transferência</label>
                <textarea
                  rows={2}
                  placeholder="Justificativa administrativa..."
                  value={transfMotivo}
                  onChange={(e) => setTransfMotivo(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
                >
                  Confirmar Transferência & Gerar Guia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Vistoria */}
      {showVistoriaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Registrar Vistoria / Inventário</h3>
            <p className="text-xs text-slate-500 mt-1">
              Conferência física do bem <strong>{showVistoriaModal.numeroTombamento}</strong>.
            </p>

            <form onSubmit={handleConfirmVistoria} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Encontrado *
                </label>
                <select
                  value={vistStatus}
                  onChange={(e) => setVistStatus(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Localizado no Setor">Localizado no Setor e em uso</option>
                  <option value="Não Localizado / Desaparecido">Não Localizado / Desaparecido</option>
                  <option value="Em Outro Setor Sem Guia">Em Outro Setor Sem Guia</option>
                  <option value="Aguardando Descarte">Aguardando Descarte / Danificado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parecer Técnico / Observações da Comissão
                </label>
                <textarea
                  rows={3}
                  placeholder="Descreva a condição da plaqueta, estado do bem e conferência..."
                  value={vistParecer}
                  onChange={(e) => setVistParecer(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVistoriaModal(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                >
                  Salvar Vistoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Termo de Responsabilidade (Visualização para Impressão) */}
      {showTermoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl border border-slate-300 max-h-[90vh] overflow-y-auto print:p-0">
            {/* Header timbrado oficial */}
            <div className="text-center pb-4 border-b-2 border-slate-900">
              <h2 className="text-sm font-extrabold tracking-wider uppercase text-slate-900">
                MUNICÍPIO DE CAPANEMA
              </h2>
              <h3 className="text-xs font-bold text-slate-700 uppercase">
                DEPARTAMENTO DE PATRIMÔNIO PÚBLICO (DPP)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                TERMO DE RESPONSABILIDADE E GUARDA DE BENS PÚBLICOS
              </p>
            </div>

            <div className="py-4 space-y-4 text-xs text-slate-800 leading-relaxed">
              <p>
                Pelo presente termo, declaro que recebi sob minha guarda e responsabilidade o bem permanente abaixo discriminado, pertencente ao acervo patrimonial do Município de Capanema, comprometendo-me a zelar pela sua conservação e uso exclusivo no serviço público municipal.
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="font-semibold text-slate-600">Nº de Tombamento:</span> <strong className="font-mono text-blue-900">{showTermoModal.numeroTombamento}</strong></div>
                  <div><span className="font-semibold text-slate-600">Categoria:</span> {showTermoModal.categoria}</div>
                </div>
                <div><span className="font-semibold text-slate-600">Descrição do Bem:</span> <strong>{showTermoModal.descricao}</strong></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><span className="font-semibold text-slate-600">Secretaria / Lotação:</span> {showTermoModal.secretariaSetor}</div>
                  <div><span className="font-semibold text-slate-600">Local / Unidade:</span> {showTermoModal.local || showTermoModal.localizacaoExata || 'Sede / Geral'}</div>
                  <div><span className="font-semibold text-slate-600">Departamento / Sala:</span> {showTermoModal.departamento || 'Setor Geral'}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="font-semibold text-slate-600">Estado de Conservação:</span> {showTermoModal.estadoConservacao}</div>
                  <div><span className="font-semibold text-slate-600">Valor de Incorporação:</span> {showTermoModal.valorAquisicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
              </div>

              <div className="pt-8 grid grid-cols-2 gap-8 text-center">
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-bold text-slate-900">{formatResponsavelNome(showTermoModal.responsavel)}</div>
                  <div className="text-[10px] text-slate-500">Servidor Detentor da Carga</div>
                </div>

                <div className="border-t border-slate-400 pt-2">
                  <div className="font-bold text-slate-900">Eliel da Silva Marques</div>
                  <div className="text-[10px] text-slate-500">Diretor de Patrimônio Público (DPP)</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Imprimir Documento
              </button>
              <button
                onClick={() => setShowTermoModal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passo 1: Central de Impressão de Etiquetas Patrimoniais */}
      <EtiquetasPrintModal
        isOpen={showEtiquetasModal}
        onClose={() => setShowEtiquetasModal(false)}
        bensParaImprimir={bensParaEtiquetas}
        allBens={patrimonios}
      />

      {/* Passo 2: Central de Sincronização e Carga em Nuvem (Firebase Firestore) */}
      <FirebaseSyncCenter
        isOpen={showSyncCenterModal}
        onClose={() => setShowSyncCenterModal(false)}
        patrimonios={patrimonios}
        onUpdateDatasetFromFirestore={onUpdateDatasetFromFirestore}
      />

      {/* Passo 3: Módulo de Inventário e Vistoria em Campo (Câmera e QR Code) */}
      <VistoriaScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        patrimonios={patrimonios}
        onAddVistoria={onAddVistoria}
        onUpdatePatrimonio={onUpdatePatrimonio}
        photosMap={photosMap}
        onOpenPhotoSync={() => setShowPhotoSyncModal(true)}
        onPhotoResolved={handlePhotoResolved}
      />

      {/* Passo 4: Emissão de Termos de Responsabilidade e Relatórios TCM/TCE */}
      <TermosERelatoriosModal
        isOpen={showTermosERelatoriosModal}
        onClose={() => setShowTermosERelatoriosModal(false)}
        patrimonios={patrimonios}
        transferencias={transferencias}
        initialTipo={termoModalInitialTipo}
        initialSecretaria={selectedSecretaria}
        initialLocais={selectedLocais}
        initialDepartamentos={selectedDepartamentos}
      />

      {/* Modal: Importador de Fotos do AppSheet */}
      <AppSheetPhotoSyncModal
        isOpen={showPhotoSyncModal}
        onClose={() => setShowPhotoSyncModal(false)}
        patrimonios={patrimonios}
        onPhotosUpdated={(newMap) => setPhotosMap(prev => ({ ...prev, ...newMap }))}
      />

      {/* Lightbox: Ampliação de Foto */}
      {lightboxPhoto && (
        <div 
          onClick={() => setLightboxPhoto(null)} 
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 p-2" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 py-2 text-white">
              <div>
                <span className="text-xs font-mono font-bold text-amber-400">Tombo #{lightboxPhoto.tombo}</span>
                <h4 className="text-sm font-bold truncate max-w-md">{lightboxPhoto.titulo}</h4>
              </div>
              <button 
                onClick={() => setLightboxPhoto(null)} 
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[75vh] overflow-hidden rounded-xl bg-black">
              <img src={lightboxPhoto.url} alt={lightboxPhoto.titulo} className="max-h-[75vh] w-auto object-contain mx-auto" />
            </div>
          </div>
        </div>
      )}

      {/* Notificação Flutuante de Sucesso (Toast) */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-60 bg-emerald-700 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="text-xs font-bold">{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="ml-2 text-emerald-200 hover:text-white p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
