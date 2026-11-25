import React, { useState, useEffect, useRef } from 'react';
import { lazyImport } from '../utils/lazyImport';
import { 
  Camera, Calendar, ChevronDown, Minus, Plus, X, Check, 
  RefreshCw, Trash2, Tag, Upload, Info, ShieldCheck
} from 'lucide-react';
import { PatrimonioRecord, LocalizacaoRecord } from '../types/appsheet';
import { INITIAL_LOCALIZACOES } from '../data/sampleAppsheetSchema';
import { resolveSecretariaId, resolveSecretariaNome } from '../data/secretarias';
import { compressImageFile } from '../utils/photoStorage';
import { fetchAndCacheCloudPhoto } from '../utils/cloudPhotoSync';
import { buildEtiquetaQrFicha } from '../utils/etiquetaQr';
import { formatCadastroDate } from '../utils/patrimonioFormatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: PatrimonioRecord) => void;
  initialData?: PatrimonioRecord | null;
  totalExistingRecords?: number;
}

export const GERENTES_LIST = [
  { id: 1, nome: 'CLAUDIONOR MOUREIRA', secretaria: 'GABINETE DO PREFEITO' },
  { id: 2, nome: 'JOSÉ OLÍMPIO NETO', secretaria: 'SECRETARIA DE ADMINISTRAÇÃO' },
  { id: 3, nome: 'CELIA JANETE DA COSTA MOREIRA', secretaria: 'SECRETARIA DE ASSISTÊNCIA SOCIAL' },
  { id: 4, nome: 'ANDREZA DE NAZARÉ OLIVEIRA DA COSTA', secretaria: 'SECRETARIA DE COMUNICAÇÃO' },
  { id: 5, nome: 'WALCYLENE CARDOSO COSTA', secretaria: 'SECRETARIA DE EDUCAÇÃO' },
  { id: 6, nome: 'PAULO ROBERTO SOTILLO DE LIMA FILHO', secretaria: 'SECRETARIA DE SAÚDE' },
  { id: 7, nome: 'ARMANDO MUNECHIKA', secretaria: 'SECRETARIA DE AGRICULTURA' },
  { id: 8, nome: 'CELINA MARIA BARBOSA FARIAS', secretaria: 'SECRETARIA DE CULTURA' },
  { id: 9, nome: 'JOSÉ JUSTO DOS SANTOS RAMOS JUNIOR', secretaria: 'SECRETARIA DE DESPORTO E LAZER' },
  { id: 10, nome: 'HELENA CLAUDIA PINHEIRO SILVA', secretaria: 'SECRETARIA DE FINANÇAS' },
  { id: 11, nome: 'ANTONIO MARIA DE NAZARE MOREIRA', secretaria: 'SECRETARIA DE INDÚSTRIA, COMÉRCIO, MINERAÇÃO E TURISMO' },
  { id: 12, nome: 'ALEX ALLAN MOREIRA SOUZA', secretaria: 'SECRETARIA DE MEIO AMBIENTE' },
  { id: 13, nome: 'ELVIRA NASCIMENTO MAGALHÃES BARROS', secretaria: 'SECRETARIA DE PLANEJAMENTO' },
  { id: 14, nome: 'ALEXANDRE KLAUTAU LEITE', secretaria: 'SECRETARIA DE TRÂNSITO' },
  { id: 15, nome: 'ELCIO PEREIRA RIBEIRO', secretaria: 'SECRETARIA DE URBANISMO, OBRAS E VIAÇÃO' },
];

export const CATEGORIAS_APPSHEET = [
  'Equipamentos para escritório',
  'Equipamentos de Informática',
  'Eletrodomésticos',
  'Equipamentos Hospitalares',
  'Equipamentos Escolares',
  'Eletrônicos',
  'Copa Cozinha',
  'VEÍCULOS',
  'Audio e Video'
];

export const STATUS_APPSHEET = [
  'Disponível',
  'Inservivel'
];

function generateAppSheetId(): string {
  const hex = Math.random().toString(16).substring(2, 10);
  return `PMC - ${hex}`;
}

function formatBrDateOnly(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function resolveInitialCriadoEm(record?: PatrimonioRecord | null): string {
  const raw = record?.dataCadastro || record?.atualizadoEm;
  if (raw) {
    const formatted = formatCadastroDate(raw, false);
    if (formatted && formatted !== 'Não informada') {
      return formatted;
    }
  }
  return formatBrDateOnly(new Date());
}

function formatBrDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export const AppSheetPatrimonioForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  totalExistingRecords = 6664
}) => {
  if (!isOpen) return null;

  // 1. ID_Patrimonio
  const [idPatrimonio, setIdPatrimonio] = useState(
    initialData?.id || generateAppSheetId()
  );

  // 2. Foto (valor salvo vs preview resolvido do cache IndexedDB)
  const [fotoUrl, setFotoUrl] = useState<string>(initialData?.fotoBem || '');
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string>(initialData?.fotoBem || '');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [photoSizeKb, setPhotoSizeKb] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolver preview do cache IndexedDB quando fotoUrl for caminho relativo do AppSheet
  useEffect(() => {
    let active = true;
    if (!fotoUrl) {
      setFotoPreviewUrl('');
      return;
    }
    if (fotoUrl.startsWith('data:') || fotoUrl.startsWith('http') || fotoUrl.startsWith('/')) {
      setFotoPreviewUrl(fotoUrl);
      return;
    }
    fetchAndCacheCloudPhoto(fotoUrl).then((cached) => {
      if (!active) return;
      setFotoPreviewUrl(cached || fotoUrl);
    });
    return () => {
      active = false;
    };
  }, [fotoUrl]);

  // Sincronizar todos os campos quando o modal abre ou initialData muda
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setIdPatrimonio(initialData.id);
      setNomePatrimonio(initialData.descricao || '');
      setCategoria(initialData.categoria || 'Equipamentos para escritório');
      setStatus(
        initialData.estadoConservacao === 'Inservível / Ocioso' || (initialData as any)?.status === 'Inservivel' 
          ? 'Inservivel' 
          : 'Disponível'
      );
      // resolveSecretariaId tolera acentuacao e grafias legadas, evitando o fallback
      // que antes gravava a secretaria errada (GABINETE) em bens de outras secretarias.
      const locId = initialData.secretariaSetor
        ? resolveSecretariaId(initialData.secretariaSetor) || defaultLoc
        : defaultLoc;
      setLocalizacaoId(locId);
      const foundG = GERENTES_LIST.find(g => g.id === locId);
      setGerente(initialData.responsavel || (foundG ? foundG.nome : 'Responsável Setorial'));
      setLocal(initialData.local || initialData.localizacaoExata || '');
      setDepartamento(initialData.departamento || '');
      setCustoCompra(initialData.valorAquisicao || 0);
      setDataCompra(initialData.dataAquisicao || '');
      setCriadoEm(resolveInitialCriadoEm(initialData));
      setCriadoPor(initialData.cadastradoPor || 'dpp@capanema.pa.gov.br');
      setEtiquetaNumero(initialData.etiquetaNumero || initialData.numeroTombamento || '');
      setNumeroSerie(initialData.numeroSerie || '');
      setMarcaModelo(initialData.marcaModelo || '');
      setNumeroNotaFiscal(initialData.numeroNotaFiscal || '');
      setEstadoConservacao(initialData.estadoConservacao || 'Bom');
      setServidorDetentor(initialData.servidorDetentor || '');
      setGarantiaAte(initialData.garantiaAte || '');
      setObservacoes(initialData.observacoes || '');
      setFotoUrl(initialData.fotoBem || '');
      setPhotoSizeKb(null);
    } else {
      setIdPatrimonio(generateAppSheetId());
      setNomePatrimonio('');
      setCategoria('Equipamentos para escritório');
      setStatus('Disponível');
      setLocalizacaoId(defaultLoc);
      setLocal('');
      setDepartamento('');
      setCustoCompra(0);
      setDataCompra('');
      setCriadoEm(formatBrDateOnly(new Date()));
      setCriadoPor('dpp@capanema.pa.gov.br');
      setEtiquetaNumero((totalExistingRecords + 1).toString());
      setNumeroSerie('');
      setMarcaModelo('');
      setNumeroNotaFiscal('');
      setEstadoConservacao('Excelente');
      setServidorDetentor('');
      setGarantiaAte('');
      setObservacoes('');
      setFotoUrl('');
      setFotoPreviewUrl('');
      setPhotoSizeKb(null);
    }
  }, [initialData, isOpen]);

  // 3. Nome_Patrimonio
  const [nomePatrimonio, setNomePatrimonio] = useState(initialData?.descricao || '');

  // 4. Categoria
  const [categoria, setCategoria] = useState(
    initialData?.categoria || 'Equipamentos para escritório'
  );

  // 5. Status
  const [status, setStatus] = useState(
    initialData?.estadoConservacao === 'Inservível / Ocioso' || (initialData as any)?.status === 'Inservivel' 
      ? 'Inservivel' 
      : 'Disponível'
  );

  // 6. Localizacao (1 to 15)
  const defaultLoc = INITIAL_LOCALIZACOES[0]?.id || 1;
  const initialLocId = initialData?.secretariaSetor
    ? resolveSecretariaId(initialData.secretariaSetor) || defaultLoc
    : defaultLoc;
  const [localizacaoId, setLocalizacaoId] = useState<number>(initialLocId);

  // 7. Gerente_do_Patrimonio (Lookup / Dereference)
  const [gerente, setGerente] = useState<string>(() => {
    const found = GERENTES_LIST.find(g => g.id === initialLocId);
    return found ? found.nome : GERENTES_LIST[0]?.nome || '';
  });

  // 8. Local / Unidade (antes de Departamento)
  const [local, setLocal] = useState(
    initialData?.local || initialData?.localizacaoExata || ''
  );

  // 9. Departamento
  const [departamento, setDepartamento] = useState(
    initialData?.departamento || ''
  );

  // 9. Custo_Compra
  const [custoCompra, setCustoCompra] = useState<number>(
    initialData?.valorAquisicao || 0
  );

  // 10. Data_Compra
  const [dataCompra, setDataCompra] = useState<string>(
    initialData?.dataAquisicao || ''
  );

  // 11. Criado_em (padrão brasileiro dd/mm/aaaa)
  const [criadoEm, setCriadoEm] = useState<string>(() => resolveInitialCriadoEm(initialData));

  // 12. QR Code Data URL
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // 13. Criado_Por
  const [criadoPor, setCriadoPor] = useState<string>(
    initialData?.cadastradoPor || 'dpp@capanema.pa.gov.br'
  );

  // Campos Adicionais de Auditoria & TCM-PA (Opcionais)
  const [showExtraFields, setShowExtraFields] = useState<boolean>(() => {
    return !!(
      initialData?.numeroSerie || 
      initialData?.marcaModelo || 
      initialData?.numeroNotaFiscal || 
      initialData?.servidorDetentor ||
      initialData?.garantiaAte ||
      initialData?.observacoes
    );
  });
  const [numeroSerie, setNumeroSerie] = useState(initialData?.numeroSerie || '');
  const [marcaModelo, setMarcaModelo] = useState(initialData?.marcaModelo || '');
  const [numeroNotaFiscal, setNumeroNotaFiscal] = useState(initialData?.numeroNotaFiscal || '');
  const [estadoConservacao, setEstadoConservacao] = useState<PatrimonioRecord['estadoConservacao']>(
    initialData?.estadoConservacao || 'Excelente'
  );
  const [servidorDetentor, setServidorDetentor] = useState(initialData?.servidorDetentor || '');
  const [garantiaAte, setGarantiaAte] = useState(initialData?.garantiaAte || '');
  const [observacoes, setObservacoes] = useState(initialData?.observacoes || '');

  // Sequential Tag Number (Etiqueta_Numero)
  const [etiquetaNumero, setEtiquetaNumero] = useState<string>(() => {
    if (initialData?.etiquetaNumero) {
      return initialData.etiquetaNumero;
    }
    if (initialData?.numeroTombamento) {
      return initialData.numeroTombamento;
    }
    return (totalExistingRecords + 1).toString();
  });

  // Update Gerente automatically when Localizacao changes (AppSheet dereference formula behavior)
  useEffect(() => {
    const found = GERENTES_LIST.find(g => g.id === localizacaoId);
    if (found) {
      setGerente(found.nome);
    }
  }, [localizacaoId]);

  // Generate QR code when fields change (Ficha completa legível diretamente na câmera de qualquer celular)
  useEffect(() => {
    const valorQr = (etiquetaNumero || idPatrimonio || '').trim();
    if (!valorQr) return;
    const secNome =
      resolveSecretariaNome(INITIAL_LOCALIZACOES.find(l => l.id === localizacaoId)?.nome) ||
      'GABINETE DO PREFEITO';
    const payload = buildEtiquetaQrFicha({
      id: idPatrimonio,
      etiquetaNumero: valorQr,
      numeroTombamento: valorQr,
      descricao: nomePatrimonio,
      status,
      secretariaSetor: secNome,
      local,
      localizacaoExata: local,
      departamento
    });
    let cancelado = false;
    lazyImport('qrcode', () => import('qrcode'))
      .then(({ default: QRCode }) => QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        width: 240,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }))
      .then(url => { if (!cancelado) setQrCodeDataUrl(url); })
      .catch(err => console.error('Erro gerando QR Code:', err));
    return () => { cancelado = true; };
  }, [etiquetaNumero, idPatrimonio, nomePatrimonio, status, localizacaoId, local, departamento]);

  // Handle Photo selection com compressão automática para nuvem/offline
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 960,
        quality: 0.74,
      });
      setFotoUrl(compressed);
      setFotoPreviewUrl(compressed);
      setPhotoSizeKb(Math.max(1, Math.round((compressed.length * 0.75) / 1024)));
    } catch (err) {
      console.warn('Erro ao comprimir imagem:', err);
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const handleStepCusto = (delta: number) => {
    setCustoCompra(prev => Math.max(0, parseFloat((prev + delta).toFixed(2))));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomePatrimonio.trim()) {
      alert('Por favor, preencha o Nome_Patrimonio.');
      return;
    }

    const localFinal = local.trim() || initialData?.local || initialData?.localizacaoExata || 'Sede / Geral';
    const deptoFinal = departamento.trim() || initialData?.departamento || 'Setor Geral';
    const locRecord = INITIAL_LOCALIZACOES.find(l => l.id === localizacaoId);
    const secretariaNome = locRecord ? locRecord.nome : (initialData?.secretariaSetor || 'SECRETARIA DE ADMINISTRAÇÃO');

    const realTombamento = etiquetaNumero.trim() || initialData?.numeroTombamento || initialData?.etiquetaNumero || idPatrimonio;

    const savedRecord: PatrimonioRecord = {
      id: idPatrimonio || initialData?.id || generateAppSheetId(),
      numeroTombamento: realTombamento,
      etiquetaNumero: etiquetaNumero.trim() || initialData?.etiquetaNumero || realTombamento,
      descricao: nomePatrimonio.trim(),
      categoria: categoria,
      secretariaSetor: secretariaNome,
      local: localFinal,
      localizacaoExata: localFinal,
      departamento: deptoFinal,
      responsavel: gerente || 'Responsável Setorial',
      servidorDetentor: servidorDetentor.trim() || undefined,
      marcaModelo: marcaModelo.trim() || undefined,
      numeroSerie: numeroSerie.trim() || undefined,
      estadoConservacao: status === 'Inservivel' ? 'Inservível / Ocioso' : estadoConservacao,
      status: status === 'Inservivel' ? 'Baixado / Alienado' : 'Ativo / Em Uso',
      valorAquisicao: custoCompra,
      dataAquisicao: dataCompra || new Date().toISOString().split('T')[0],
      numeroNotaFiscal: numeroNotaFiscal.trim() || undefined,
      garantiaAte: garantiaAte || undefined,
      fotoBem: fotoUrl || undefined,
      observacoes: observacoes.trim() || undefined,
      cadastradoPor: criadoPor,
      dataCadastro: criadoEm.trim() || formatBrDateOnly(new Date()),
      atualizadoEm: criadoEm.trim() || formatBrDateOnly(new Date()),
      isOfflinePending: typeof navigator !== 'undefined' && !navigator.onLine
    };

    onSave(savedRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-300 flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* AppSheet Form Top Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between rounded-t-xl shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-slate-800 tracking-tight">
              {initialData ? 'Editar Patrimônio' : 'Patrimonios'}
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold">
              Etiqueta #{etiquetaNumero}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body - Exact AppSheet Order and Style */}
        <form id="appsheet-patrimonio-form" onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs font-sans">

          {/* 1. ID_Patrimonio * */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              ID_Patrimonio <span className="text-sky-500 font-bold ml-0.5">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                required
                value={idPatrimonio}
                onChange={(e) => setIdPatrimonio(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 font-mono text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setIdPatrimonio(generateAppSheetId())}
                className="absolute right-2 text-slate-400 hover:text-sky-600 p-1"
                title="Gerar novo ID AppSheet"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2. Foto * */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-slate-700 font-medium text-[13px]">
                Foto <span className="text-sky-500 font-bold ml-0.5">*</span>
              </label>
              <span className="text-[10px] font-semibold text-emerald-700">
                {photoSizeKb ? `Otimizada (${photoSizeKb} KB)` : 'Compressão automática ativa'}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {isCompressingPhoto ? (
              <div className="border border-sky-200 rounded h-24 bg-sky-50 flex items-center justify-center gap-2 text-xs text-sky-800 font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                <span>Otimizando foto para envio rápido...</span>
              </div>
            ) : fotoUrl ? (
              <div className="relative border border-slate-300 rounded p-2 bg-slate-50 flex items-center justify-center">
                {fotoPreviewUrl.startsWith('data:') || fotoPreviewUrl.startsWith('http') || fotoPreviewUrl.startsWith('/') ? (
                  <img 
                    src={fotoPreviewUrl} 
                    alt="Foto do Patrimônio" 
                    className="max-h-48 rounded object-contain shadow-2xs"
                  />
                ) : (
                  <div className="py-6 px-4 text-center">
                    <p className="text-xs font-semibold text-slate-700">Foto registrada no AppSheet:</p>
                    <code className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded block mt-1 font-mono">{fotoUrl}</code>
                    <p className="text-[11px] text-slate-400 mt-2">Clique no botão da câmera para carregar uma nova foto ou use a importação de fotos em lote.</p>
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-md shadow-md border border-slate-200"
                    title="Trocar foto"
                  >
                    <Camera className="w-4 h-4 text-sky-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFotoUrl(''); setFotoPreviewUrl(''); setPhotoSizeKb(null); }}
                    className="p-1.5 bg-white/90 hover:bg-white text-rose-600 rounded-md shadow-md border border-slate-200"
                    title="Remover foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border border-slate-300 rounded h-24 bg-white hover:bg-slate-50/80 cursor-pointer flex items-center justify-center transition-all group shadow-2xs"
              >
                <div className="p-3 rounded-full bg-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 text-slate-600 transition-colors">
                  <Camera className="w-6 h-6 stroke-[1.75]" />
                </div>
              </div>
            )}
          </div>

          {/* 3. Nome_Patrimonio * */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Nome_Patrimonio <span className="text-sky-500 font-bold ml-0.5">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Digite o nome / descrição do bem"
              value={nomePatrimonio}
              onChange={(e) => setNomePatrimonio(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
            />
          </div>

          {/* 4. Categoria * */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Categoria <span className="text-sky-500 font-bold ml-0.5">*</span>
            </label>
            <div className="relative">
              <select
                required
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-300 rounded px-3 py-2 pr-8 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
              >
                {CATEGORIAS_APPSHEET.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 5. Status * */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Status <span className="text-sky-500 font-bold ml-0.5">*</span>
            </label>
            <div className="relative">
              <select
                required
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-300 rounded px-3 py-2 pr-8 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
              >
                {STATUS_APPSHEET.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 6. Localizacao * */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Localizacao <span className="text-sky-500 font-bold ml-0.5">*</span>
            </label>
            <div className="relative">
              <select
                required
                value={localizacaoId}
                onChange={(e) => setLocalizacaoId(Number(e.target.value))}
                className="w-full appearance-none bg-white border border-slate-300 rounded px-3 py-2 pr-8 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs font-medium"
              >
                {INITIAL_LOCALIZACOES.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.id} - {loc.nome}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 7. Gerente_do_Patrimonio */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Gerente_do_Patrimonio
            </label>
            <div className="relative">
              <select
                value={gerente}
                onChange={(e) => setGerente(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-300 rounded px-3 py-2 pr-8 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
              >
                {GERENTES_LIST.map((g) => (
                  <option key={g.id} value={g.nome}>
                    {g.nome} ({g.secretaria})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 8. Local / Unidade (antes de Departamento) */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Local / Unidade <span className="text-slate-400 font-normal text-xs">(Escola, Prédio, Posto de Saúde)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: EMEIF Maximiana Menezes, Sede da Prefeitura, USF Inussum"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
            />
          </div>

          {/* 9. Departamento * */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Departamento <span className="text-sky-500 font-bold ml-0.5">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Secretaria, Diretoria, Sala 01, Copa Cozinha, Recepção"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
            />
          </div>

          {/* 9. Custo_Compra with stepper (- and +) */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Custo_Compra
            </label>
            <div className="flex items-center border border-slate-300 rounded bg-white shadow-2xs overflow-hidden focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
              <span className="px-3 text-slate-500 text-xs font-mono font-medium select-none">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={custoCompra}
                onChange={(e) => setCustoCompra(parseFloat(e.target.value) || 0)}
                className="w-full py-2 text-xs text-slate-800 font-mono focus:outline-none bg-transparent"
              />
              <div className="flex items-center border-l border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => handleStepCusto(-10)}
                  className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  title="Diminuir R$ 10"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <div className="w-px h-5 bg-slate-200" />
                <button
                  type="button"
                  onClick={() => handleStepCusto(10)}
                  className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  title="Aumentar R$ 10"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

          {/* 10. Data_Compra */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Data_Compra
            </label>
            <input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
            />
          </div>

          {/* 11. Criado_em * no padrão brasileiro dd/mm/aaaa */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Criado_em <span className="text-sky-500 font-bold ml-0.5">*</span>
              <span className="ml-1.5 text-[11px] font-normal text-slate-400">(dia/mês/ano)</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="dd/mm/aaaa"
                maxLength={10}
                value={criadoEm}
                onChange={(e) => setCriadoEm(formatBrDateInput(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 pr-9 text-slate-800 font-mono text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
            </div>
          </div>

          {/* 12. QR_Code */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              QR_Code
            </label>
            <div className="border border-slate-300 rounded p-4 bg-white flex flex-col items-center justify-center shadow-2xs min-h-[140px]">
              {qrCodeDataUrl ? (
                <div className="flex flex-col items-center gap-1.5">
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code do Patrimônio"
                    className="w-32 h-32 object-contain"
                  />
                  <div className="text-center font-mono">
                    <span className="text-xs font-bold text-blue-900 block">
                      Etiqueta #{etiquetaNumero}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-sans">
                      Câmera lê Nº, Nome, Status, Secretaria e Depto
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-xs flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                  <span>Gerando QR Code...</span>
                </div>
              )}
            </div>
          </div>

          {/* Seção Adicional Opcional: Auditoria, TCM-PA & Controle Interno */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowExtraFields(prev => !prev)}
              className="w-full flex items-center justify-between p-2.5 rounded-md border border-sky-200 bg-sky-50/70 hover:bg-sky-100/70 text-sky-950 transition-all font-medium text-xs shadow-2xs group"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="font-semibold text-slate-800">
                  + Informações Complementares (Nº Série, Nota Fiscal, Conservação)
                </span>
                {(numeroSerie || numeroNotaFiscal || marcaModelo || servidorDetentor) && (
                  <span className="px-1.5 py-0.2 rounded bg-sky-600 text-white font-mono text-[10px] font-bold">
                    Preenchido
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-sky-600 transition-transform ${showExtraFields ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showExtraFields && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="text-[11px] text-slate-500 font-medium pb-1.5 border-b border-slate-200 flex items-center justify-between">
                <span>Campos Opcionais para Auditoria e Inventário</span>
                <span className="text-[10px] text-sky-700 font-semibold bg-sky-100/70 px-1.5 py-0.5 rounded">TCM-PA / Controle</span>
              </div>

              {/* Marca e Modelo */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-medium text-xs">
                  Marca_Modelo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dell OptiPlex 7090, Agrale A10000, Springer 18.000..."
                  value={marcaModelo}
                  onChange={(e) => setMarcaModelo(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              {/* Número de Série / Chassi / Placa */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-medium text-xs">
                  Numero_Serie / Chassi / Placa
                </label>
                <input
                  type="text"
                  placeholder="Ex: S/N: BRG49201992, Chassi ou Placa do veículo"
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nota Fiscal ou Empenho */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-medium text-xs">
                    Numero_Nota_Fiscal / Empenho
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: NF-e 04821 / Empenho 112"
                    value={numeroNotaFiscal}
                    onChange={(e) => setNumeroNotaFiscal(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                  />
                </div>

                {/* Estado de Conservação Físico */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-medium text-xs">
                    Estado_Conservacao
                  </label>
                  <div className="relative">
                    <select
                      value={estadoConservacao}
                      onChange={(e) => setEstadoConservacao(e.target.value as any)}
                      className="w-full appearance-none bg-white border border-slate-300 rounded px-3 py-2 pr-8 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                    >
                      <option value="Excelente">Excelente (Novo / Perfeito)</option>
                      <option value="Bom">Bom (Em pleno uso)</option>
                      <option value="Regular">Regular (Pequeno desgaste)</option>
                      <option value="Ruim / Danificado">Ruim / Danificado (Reparo necessário)</option>
                      <option value="Inservível / Ocioso">Inservível / Ocioso (Descarte/Leilão)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Servidor Detentor Direto */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-medium text-xs">
                    Servidor_Detentor (Guarda Direta)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Mendes (Diretor da Escola)"
                    value={servidorDetentor}
                    onChange={(e) => setServidorDetentor(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                  />
                </div>

                {/* Término da Garantia */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-medium text-xs">
                    Termino_Garantia (Fabricante)
                  </label>
                  <input
                    type="date"
                    value={garantiaAte}
                    onChange={(e) => setGarantiaAte(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Observações Gerais */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-medium text-xs">
                  Observacoes_Historico
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Adquirido via convênio FNDE, doação da FUNASA, empenho específico..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
                />
              </div>
            </div>
          )}

          {/* 13. Criado_Por */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium text-[13px]">
              Criado_Por
            </label>
            <input
              type="email"
              value={criadoPor}
              onChange={(e) => setCriadoPor(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-700 text-xs font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-2xs"
            />
          </div>
        </form>

        {/* AppSheet Form Action Bar (Cancel / Save) */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded hover:bg-slate-100 transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="appsheet-patrimonio-form"
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded shadow-sm transition-all flex items-center gap-1.5 text-xs font-semibold"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
