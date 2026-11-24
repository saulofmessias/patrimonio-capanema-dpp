import React, { useState, useEffect, useRef } from 'react';
import { lazyImport } from '../utils/lazyImport';
import { 
  Printer, X, Settings2, Eye, Download, Check, Sparkles, 
  Layers, ChevronDown, RefreshCw, Copy, Shield, FileText,
  Sliders, Grid, Tag, AlertCircle, Info, ExternalLink, Palette
} from 'lucide-react';
import { PatrimonioRecord } from '../types/appsheet';
import {
  buildEtiquetaQrFicha,
  buildEtiquetaQrLink,
  buildEtiquetaQrPayload,
  getAppBaseUrl,
  getDefaultAppBaseUrl,
  getEtiquetaCodigo,
  QrPayloadMode,
  setCustomQrBaseUrl
} from '../utils/etiquetaQr';
import { gerarPdfEtiquetas } from '../utils/pdfEtiquetas';

export type FormatoEtiqueta = 
  | 'capanema-50x35'     // Padrão Oficial Capanema (50x35mm / 5x3.5cm)
  | 'a4-capanema-50x35'  // Grade A4 com 28 etiquetas 50x35mm (4x7)
  | 'termica-50x30'      // 50x30mm
  | 'termica-70x40'      // 70x40mm
  | 'termica-100x50'     // 100x50mm
  | 'a4-pimaco-6180'     // Pimaco 6180/6280 (3x10 = 30)
  | 'a4-pimaco-6182';    // Pimaco 6182 (2x7 = 14)

export type EstiloVisual = 
  | 'capanema-azul-oficial' // Fundo Azul Marinho Oficial + Brasão + PATRIMÔNIO + QR Code + Nº (Idêntico ao PDF)
  | 'capanema-mono-termica'  // Fundo Branco + Brasão + QR Code + Nº (Econômico P&B para Ribbon)
  | 'detalhado-completo';    // Com Secretaria, Responsável e Código de Barras adicional

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bensParaImprimir: PatrimonioRecord[];
  allBens: PatrimonioRecord[];
}

export const FORMATOS_INFO: Record<FormatoEtiqueta, {
  nome: string;
  tipo: 'termica' | 'a4';
  descricao: string;
  dimensoes: string;
  colunas: number;
  linhas: number;
  etiquetasPorFolha: number;
  larguraMm: number;
  alturaMm: number;
  isPadraoOficial?: boolean;
}> = {
  'capanema-50x35': {
    nome: 'Padrão Oficial Capanema (5,0 × 3,5 cm)',
    tipo: 'termica',
    descricao: 'Dimensões oficiais da Prefeitura de Capanema: 5,0 cm de largura × 3,5 cm de altura para impressoras térmicas.',
    dimensoes: '50mm × 35mm (5 × 3,5 cm)',
    colunas: 1,
    linhas: 1,
    etiquetasPorFolha: 1,
    larguraMm: 50,
    alturaMm: 35,
    isPadraoOficial: true
  },
  'a4-capanema-50x35': {
    nome: 'Folha A4 - Grade Padrão Capanema 5 × 3,5 cm (28 por folha)',
    tipo: 'a4',
    descricao: '4 colunas × 7 linhas na folha A4 com o tamanho padrão exato da Prefeitura de Capanema.',
    dimensoes: '50mm × 35mm cada',
    colunas: 4,
    linhas: 7,
    etiquetasPorFolha: 28,
    larguraMm: 50,
    alturaMm: 35,
    isPadraoOficial: true
  },
  'termica-50x30': {
    nome: 'Térmica 50 × 30 mm',
    tipo: 'termica',
    descricao: 'Formato compacto alternativo para rolos contínuos estreitos.',
    dimensoes: '50mm × 30mm',
    colunas: 1,
    linhas: 1,
    etiquetasPorFolha: 1,
    larguraMm: 50,
    alturaMm: 30
  },
  'termica-70x40': {
    nome: 'Térmica 70 × 40 mm',
    tipo: 'termica',
    descricao: 'Rolo contínuo expandido para bens grandes com espaço adicional para setor.',
    dimensoes: '70mm × 40mm',
    colunas: 1,
    linhas: 1,
    etiquetasPorFolha: 1,
    larguraMm: 70,
    alturaMm: 40
  },
  'termica-100x50': {
    nome: 'Térmica 100 × 50 mm (Frota & Máquinas)',
    tipo: 'termica',
    descricao: 'Rolo grande para identificação de veículos e maquinários pesados da frota municipal.',
    dimensoes: '100mm × 50mm',
    colunas: 1,
    linhas: 1,
    etiquetasPorFolha: 1,
    larguraMm: 100,
    alturaMm: 50
  },
  'a4-pimaco-6180': {
    nome: 'Folha A4 Pimaco 6180 / 6280 (30 por folha)',
    tipo: 'a4',
    descricao: '3 colunas × 10 linhas. Papel adesivo A4 tradicional de escritório.',
    dimensoes: '66.7mm × 25.4mm cada',
    colunas: 3,
    linhas: 10,
    etiquetasPorFolha: 30,
    larguraMm: 66.7,
    alturaMm: 25.4
  },
  'a4-pimaco-6182': {
    nome: 'Folha A4 Pimaco 6182 (14 por folha)',
    tipo: 'a4',
    descricao: '2 colunas × 7 linhas. Etiquetas adesivas A4 de grande formato.',
    dimensoes: '101.6mm × 38.1mm cada',
    colunas: 2,
    linhas: 7,
    etiquetasPorFolha: 14,
    larguraMm: 101.6,
    alturaMm: 38.1
  }
};

export const EtiquetasPrintModal: React.FC<Props> = ({
  isOpen,
  onClose,
  bensParaImprimir,
  allBens
}) => {
  // Itens atualmente carregados para impressão
  const [listaBens, setListaBens] = useState<PatrimonioRecord[]>(bensParaImprimir);
  const [copiasPorItem, setCopiasPorItem] = useState<number>(1);
  
  // Formato padrão oficial: 50x35mm (5x3,5 cm) conforme solicitado
  const [formato, setFormato] = useState<FormatoEtiqueta>('capanema-50x35');
  const [estiloVisual, setEstiloVisual] = useState<EstiloVisual>('capanema-azul-oficial');
  
  // Customizações opcionais
  const [posicaoInicialA4, setPosicaoInicialA4] = useState<number>(1);
  const [zoomPreview, setZoomPreview] = useState<number>(100);

  // Filtros rápidos para carregar bens
  const [filtroSecretariaRapido, setFiltroSecretariaRapido] = useState<string>('todos');
  const [faixaInicialTombo, setFaixaInicialTombo] = useState<string>('');
  const [faixaFinalTombo, setFaixaFinalTombo] = useState<string>('');

  // Modo do conteúdo gravado no QR Code (Ficha Completa permite leitura imediata pela câmera de qualquer celular)
  const [qrMode, setQrMode] = useState<QrPayloadMode>('ficha');
  const [qrBaseUrl, setQrBaseUrl] = useState<string>(() => getAppBaseUrl());

  // Cache de imagens de QR Code gerados
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<number>(0);

  // Sincronizar quando abrir com nova lista
  useEffect(() => {
    if (isOpen && bensParaImprimir.length > 0) {
      setListaBens(bensParaImprimir);
    }
  }, [isOpen, bensParaImprimir]);

  // Gerar QR Codes de alta densidade e legibilidade para todo o lote selecionado (sem limite de 300)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const generateQrs = async () => {
      setQrCodeUrls({});
      const urls: Record<string, string> = {};
      const payloadCache = new Map<string, string>();
      const CHUNK_SIZE = 80;

      for (let i = 0; i < listaBens.length; i += CHUNK_SIZE) {
        if (!isMounted) return;
        const chunk = listaBens.slice(i, i + CHUNK_SIZE);

        await Promise.all(
          chunk.map(async (bem) => {
            // qrcode sob demanda: carregado na primeira vez que as etiquetas sao geradas
            const { default: QRCode } = await lazyImport('qrcode', () => import('qrcode'));
            try {
              const payload = buildEtiquetaQrPayload(bem, qrMode, qrBaseUrl);
              const cached = payloadCache.get(payload);
              if (cached) {
                urls[bem.id] = cached;
                return;
              }
              const url = await QRCode.toDataURL(payload, {
                errorCorrectionLevel: 'M',
                margin: 1,
                width: 320,
                color: {
                  dark: '#000000',
                  light: '#ffffff'
                }
              });
              payloadCache.set(payload, url);
              urls[bem.id] = url;
            } catch (e) {
              console.warn('Erro ao gerar QR code:', e);
            }
          })
        );

        if (isMounted) {
          setQrCodeUrls({ ...urls });
        }
        // Pequena pausa para manter a interface responsiva em lotes grandes
        if (i + CHUNK_SIZE < listaBens.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    };

    generateQrs();
    return () => { isMounted = false; };
  }, [isOpen, listaBens, qrMode, qrBaseUrl]);

  if (!isOpen) return null;

  // Lista expandida com as cópias por item
  const listaComCopias: PatrimonioRecord[] = [];
  listaBens.forEach(bem => {
    for (let i = 0; i < Math.max(1, copiasPorItem); i++) {
      listaComCopias.push(bem);
    }
  });

  // Cálculo de posições em branco para economia de folha A4
  const etiquetasTotaisComOffset: (PatrimonioRecord | null)[] = [];
  if (FORMATOS_INFO[formato].tipo === 'a4' && posicaoInicialA4 > 1) {
    for (let i = 1; i < posicaoInicialA4; i++) {
      etiquetasTotaisComOffset.push(null);
    }
  }
  listaComCopias.forEach(bem => etiquetasTotaisComOffset.push(bem));

  const totalFolhasA4 = FORMATOS_INFO[formato].tipo === 'a4' 
    ? Math.ceil(etiquetasTotaisComOffset.length / FORMATOS_INFO[formato].etiquetasPorFolha) || 1
    : 1;

  // Filtragem rápida por Secretaria
  const handleCarregarPorSecretaria = (secretaria: string) => {
    setFiltroSecretariaRapido(secretaria);
    if (secretaria === 'todos') {
      setListaBens(allBens.slice(0, 50));
    } else {
      const filtrados = allBens.filter(b => b.secretariaSetor === secretaria);
      setListaBens(filtrados);
    }
  };

  // Filtragem por intervalo numérico de Etiqueta / Tombamento
  const handleFiltrarPorFaixa = () => {
    const inicio = parseInt(faixaInicialTombo.replace(/\D/g, ''), 10);
    const fim = parseInt(faixaFinalTombo.replace(/\D/g, ''), 10);
    if (!isNaN(inicio) && !isNaN(fim) && inicio <= fim) {
      const filtrados = allBens.filter(b => {
        const raw = (b.etiquetaNumero || b.numeroTombamento || '').replace(/\D/g, '');
        const num = parseInt(raw, 10);
        return !isNaN(num) && num >= inicio && num <= fim;
      });
      setListaBens(filtrados);
    }
  };

  // Exportar para software industrial (Zebra Designer / Bartender)
  const handleExportarParaBartender = () => {
    const headers = [
      'ID_PATRIMONIO',
      'ETIQUETA_NUMERO',
      'NUMERO_TOMBAMENTO',
      'DESCRICAO',
      'SECRETARIA',
      'DEPARTAMENTO',
      'LARGURA_CM',
      'ALTURA_CM',
      'QR_CODE_DATA'
    ];

    const rows = listaBens.map(b => {
      const cod = getEtiquetaCodigo(b);
      const qrData = buildEtiquetaQrPayload(b, qrMode, qrBaseUrl).replace(/\r?\n/g, ' | ');
      return [
        `"${b.id}"`,
        `"${cod}"`,
        `"${b.numeroTombamento}"`,
        `"${b.descricao.replace(/"/g, '""')}"`,
        `"${b.secretariaSetor}"`,
        `"${b.departamento || ''}"`,
        `"5.0"`,
        `"3.5"`,
        `"${qrData}"`
      ];
    });

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `etiquetas-capanema-5x3.5cm-${listaBens.length}-itens.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportarPdf = async () => {
    if (listaComCopias.length === 0 || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      setPdfProgress(0);
      await gerarPdfEtiquetas({
        etiquetas: FORMATOS_INFO[formato].tipo === 'a4' ? etiquetasTotaisComOffset : listaComCopias,
        formato,
        formatoInfo: FORMATOS_INFO[formato],
        estiloVisual,
        qrMode,
        qrBaseUrl,
        qrCodeUrls,
        onProgress: setPdfProgress
      });
    } catch (err) {
      console.error('Erro ao exportar PDF de etiquetas:', err);
    } finally {
      setIsExportingPdf(false);
      setPdfProgress(0);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      {/* Folha de estilos inline para impressão nítida com preservação de cores e dimensões exatas */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-area, #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            margin: ${FORMATOS_INFO[formato].tipo === 'termica' ? '0mm' : '6mm'};
            size: ${FORMATOS_INFO[formato].tipo === 'termica' ? `${FORMATOS_INFO[formato].larguraMm}mm ${FORMATOS_INFO[formato].alturaMm}mm` : 'A4 portrait'};
          }
          .page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .etiqueta-capanema-print {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-[#080c44] to-slate-950 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shadow-inner">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">
                  Impressão de Etiquetas de Tombamento
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-400/30 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Padrão 5 × 3,5 cm Ativo
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Prefeitura Municipal de Capanema • Modelo Oficial idêntico ao documento padrão da administração
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setListaBens(allBens.slice(0, 10));
              }}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-xs font-semibold border border-emerald-500/40 transition-colors"
              title="Carregar lote reduzido de 10 itens para teste de impressão física"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Lote de Teste (10 Itens)
            </button>

            <button
              onClick={handleExportarParaBartender}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              title="Exportar dados para Zebra Designer ou Bartender"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>

            <button
              onClick={handleExportarPdf}
              disabled={isExportingPdf || listaComCopias.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              title="Baixar arquivo PDF pronto para impressão ou envio"
            >
              {isExportingPdf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gerando PDF ({pdfProgress}%)</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Baixar PDF (.pdf)</span>
                </>
              )}
            </button>

            <button
              onClick={handleImprimir}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Imprimir ({listaComCopias.length} {listaComCopias.length === 1 ? 'etiqueta' : 'etiquetas'})
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content: Split Grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          
          {/* PAINEL LATERAL ESQUERDO: CONTROLES E CONFIGURAÇÕES (4 Colunas) */}
          <div className="lg:col-span-4 p-5 overflow-y-auto space-y-6 bg-slate-50/80">
            
            {/* 1. Escolha do Modelo Visual */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-blue-600" />
                Estilo Visual da Etiqueta
              </label>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setEstiloVisual('capanema-azul-oficial')}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
                    estiloVisual === 'capanema-azul-oficial'
                      ? 'bg-blue-950 text-white border-blue-500 ring-2 ring-blue-500/30 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                    estiloVisual === 'capanema-azul-oficial' ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-300'
                  }`}>
                    {estiloVisual === 'capanema-azul-oficial' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span>Padrão Oficial Capanema (Azul Marinho)</span>
                      <span className="text-[9px] bg-emerald-500 text-white font-bold px-1.5 py-0.2 rounded">
                        Oficial
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-snug ${
                      estiloVisual === 'capanema-azul-oficial' ? 'text-blue-200' : 'text-slate-500'
                    }`}>
                      Idêntico ao PDF oficial: Fundo azul escuro, brasão municipal com "AGORA É AVANÇAR", texto PATRIMÔNIO, QR Code e Nº em destaque.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEstiloVisual('capanema-mono-termica')}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
                    estiloVisual === 'capanema-mono-termica'
                      ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 text-blue-950 font-medium shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                    estiloVisual === 'capanema-mono-termica' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                  }`}>
                    {estiloVisual === 'capanema-mono-termica' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      Térmica Monocromática (Fundo Branco P&B)
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Mesmo layout de 5×3,5 cm, otimizado para fitas térmicas (ribbon preto) com economia de toner/tinta.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEstiloVisual('detalhado-completo')}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
                    estiloVisual === 'detalhado-completo'
                      ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 text-blue-950 font-medium shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                    estiloVisual === 'detalhado-completo' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                  }`}>
                    {estiloVisual === 'detalhado-completo' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      Detalhado com Secretaria e Código de Barras
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Inclui nome da Secretaria, setor e código de barras 128 adicional abaixo do QR Code.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 1.5 Conteúdo do QR Code */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-blue-600" />
                Leitura do QR Code
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setQrMode('ficha')}
                  className={`p-2 rounded-xl border text-left text-xs transition-all ${
                    qrMode === 'ficha'
                      ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 text-blue-950 font-semibold shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-[11px]">Ficha na Câmera</div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">
                    Lê Nº, Nome, Status, Sec. e Depto
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('link')}
                  className={`p-2 rounded-xl border text-left text-xs transition-all ${
                    qrMode === 'link'
                      ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 text-blue-950 font-semibold shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-[11px]">Link Direto</div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">
                    Abre o sistema no navegador
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('numero')}
                  className={`p-2 rounded-xl border text-left text-xs transition-all ${
                    qrMode === 'numero'
                      ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 text-blue-950 font-semibold shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-[11px]">Somente Nº</div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">
                    Código curto só p/ Scanner
                  </div>
                </button>
              </div>

              {qrMode === 'ficha' && listaBens[0] && (
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-700">
                    O que aparece ao apontar qualquer câmera do celular:
                  </div>
                  <pre className="text-[10px] font-mono text-slate-700 whitespace-pre-wrap leading-snug bg-slate-50 p-2 rounded border border-slate-100">
                    {buildEtiquetaQrFicha(listaBens[0])}
                  </pre>
                </div>
              )}

              {qrMode === 'link' && (
                <div className="p-2 rounded-lg bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-700">Endereço usado no QR Code:</span>
                    {qrBaseUrl !== getDefaultAppBaseUrl() && (
                      <button
                        type="button"
                        onClick={() => {
                          const def = getDefaultAppBaseUrl();
                          setQrBaseUrl(def);
                          setCustomQrBaseUrl('');
                        }}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Restaurar padrão
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={qrBaseUrl}
                    onChange={(e) => {
                      setQrBaseUrl(e.target.value);
                      setCustomQrBaseUrl(e.target.value);
                    }}
                    placeholder={getDefaultAppBaseUrl()}
                    className="w-full text-[10px] font-mono px-2 py-1 rounded border border-slate-300 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="text-[9.5px] text-slate-400 truncate font-mono">
                    Exemplo: {buildEtiquetaQrLink(listaBens[0] ? getEtiquetaCodigo(listaBens[0]) : '466', qrBaseUrl)}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Escolha da Mídia / Impressora */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Grid className="w-4 h-4 text-blue-600" />
                  Formato de Impressão
                </span>
                <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Largura 5 cm × Altura 3,5 cm
                </span>
              </label>

              <div className="space-y-1.5">
                {(Object.keys(FORMATOS_INFO) as FormatoEtiqueta[]).map((fKey) => {
                  const info = FORMATOS_INFO[fKey];
                  const isSelected = formato === fKey;
                  return (
                    <button
                      key={fKey}
                      type="button"
                      onClick={() => setFormato(fKey)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
                        isSelected 
                          ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 text-blue-950 font-medium shadow-sm' 
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            {info.nome}
                            {info.isPadraoOficial && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                                Padrão Capanema
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {info.dimensoes}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{info.descricao}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Seletor de Cópias e Posição A4 */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Cópias por Item:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={copiasPorItem}
                    onChange={(e) => setCopiasPorItem(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-xs font-bold text-center py-1.5 px-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">vias</span>
                </div>
              </div>

              {FORMATOS_INFO[formato].tipo === 'a4' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Posição Inicial na Folha:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={FORMATOS_INFO[formato].etiquetasPorFolha}
                      value={posicaoInicialA4}
                      onChange={(e) => setPosicaoInicialA4(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full text-xs font-bold text-center py-1.5 px-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      title="Permite aproveitar folhas adesivas já iniciadas!"
                    />
                    <span className="text-[11px] text-slate-500">1ª livre</span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Seleção Rápida em Lote */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Filtrar Lote de Bens
                </span>
                <span className="text-blue-600 font-semibold lowercase">
                  {listaBens.length} itens
                </span>
              </label>

              {/* Filtro por Secretaria */}
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Carregar todos da Secretaria:
                </span>
                <select
                  value={filtroSecretariaRapido}
                  onChange={(e) => handleCarregarPorSecretaria(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Selecione para carregar em bloco...</option>
                  <option value="GABINETE DO PREFEITO">GABINETE DO PREFEITO (47 bens)</option>
                  <option value="SECRETARIA DE ADMINISTRAÇÃO">SECRETARIA DE ADMINISTRAÇÃO (214 bens)</option>
                  <option value="SECRETARIA DE ASSITENCIA SOCIAL">SECRETARIA DE ASSISTÊNCIA SOCIAL (368 bens)</option>
                  <option value="SECRETARIA DE COMUNICAÇÃO">SECRETARIA DE COMUNICAÇÃO (34 bens)</option>
                  <option value="SECRETARIA DE EDUCAÇÃO">SECRETARIA DE EDUCAÇÃO (2.684 bens)</option>
                  <option value="SECRETARIA DE SAÚDE">SECRETARIA DE SAÚDE (2.116 bens)</option>
                  <option value="SECRETARIA DE AGRICULTURA">SECRETARIA DE AGRICULTURA (88 bens)</option>
                  <option value="SECRETARIA DE CULTURA">SECRETARIA DE CULTURA (52 bens)</option>
                  <option value="SECRETARIA DE DESPORTO E LAZER">SECRETARIA DE DESPORTO E LAZER (29 bens)</option>
                  <option value="SECRETARIA DE FINANÇAS">SECRETARIA DE FINANÇAS (135 bens)</option>
                  <option value="SECRETARIA DE INDÚSTRIA, COMÉRCIO, MINERAÇÃO E TURISMO">SEC. DE INDÚSTRIA E COMÉRCIO (41 bens)</option>
                  <option value="SECRETARIA DE MEIO AMBIENTE">SECRETARIA DE MEIO AMBIENTE (63 bens)</option>
                  <option value="SECRETARIA DE PLANEJAMENTO">SECRETARIA DE PLANEJAMENTO (39 bens)</option>
                  <option value="SECRETARIA DE TRÂNSITO">SECRETARIA DE TRÂNSITO (94 bens)</option>
                  <option value="SECRETARIA DE URBANISMO, OBRAS E VIAÇÃO">SEC. DE URBANISMO E OBRAS (677 bens)</option>
                </select>
              </div>

              {/* Filtro por Intervalo */}
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Ou por Intervalo de Tombamento:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="De Nº (ex: 1)"
                    value={faixaInicialTombo}
                    onChange={(e) => setFaixaInicialTombo(e.target.value)}
                    className="w-1/2 text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Até Nº (ex: 50)"
                    value={faixaFinalTombo}
                    onChange={(e) => setFaixaFinalTombo(e.target.value)}
                    className="w-1/2 text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleFiltrarPorFaixa}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0"
                  >
                    Filtrar
                  </button>
                </div>
              </div>
            </div>

            {/* Aviso informativo de medidas */}
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-blue-800">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                Calibrado: 5,0 cm de Largura × 3,5 cm de Altura
              </div>
              <p className="text-blue-700 leading-relaxed">
                As dimensões foram ajustadas com precisão milimétrica para encaixe perfeito nas etiquetas adesivas da Prefeitura de Capanema.
              </p>
            </div>

            {/* Dicas de Calibração da Impressora */}
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-[11px] space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                Guia Rápido de Calibração (Ctrl + P):
              </div>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                <li><strong className="text-slate-800">Destino:</strong> Selecione sua impressora térmica ou "Salvar como PDF".</li>
                <li><strong className="text-slate-800">Tamanho do Papel:</strong> 50 × 35 mm (ou customizado no driver).</li>
                <li><strong className="text-slate-800">Margens:</strong> Definir como <em>Nenhuma</em> ou <em>Zero</em>.</li>
                <li><strong className="text-slate-800">Escala:</strong> Manter em <em>100% (Padrão)</em> sem ajustar à página.</li>
                <li><strong className="text-slate-800">Cabeçalho e Rodapé:</strong> Desmarcar para evitar texto de URL.</li>
              </ul>
            </div>

          </div>

          {/* PAINEL DIREITO: PRÉ-VISUALIZAÇÃO EM TEMPO REAL WYSIWYG (8 Colunas) */}
          <div className="lg:col-span-8 flex flex-col bg-slate-200/60 overflow-hidden">
            
            {/* Barra Superior da Preview */}
            <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Pré-visualização WYSIWYG
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({FORMATOS_INFO[formato].nome} • {listaComCopias.length} etiquetas)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <span>Zoom:</span>
                  <button 
                    onClick={() => setZoomPreview(Math.max(60, zoomPreview - 15))}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                  >
                    -
                  </button>
                  <span className="font-mono text-[11px] w-10 text-center">{zoomPreview}%</span>
                  <button 
                    onClick={() => setZoomPreview(Math.min(180, zoomPreview + 15))}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Canvas de Exibição / Área Imprimível */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
              
              {/* O contêiner de impressão real com id="print-area" */}
              <div 
                id="print-area"
                style={{ transform: `scale(${zoomPreview / 100})`, transformOrigin: 'top center' }}
                className={`transition-transform duration-150 ${
                  FORMATOS_INFO[formato].tipo === 'a4' 
                    ? 'w-[210mm] min-h-[297mm] bg-white shadow-xl p-[6mm] text-slate-900 border border-slate-300' 
                    : 'w-full max-w-xl space-y-4'
                }`}
              >
                {FORMATOS_INFO[formato].tipo === 'a4' ? (
                  /* Layout Grade Folha A4 */
                  <div 
                    className="grid gap-[2.5mm] h-full"
                    style={{ 
                      gridTemplateColumns: `repeat(${FORMATOS_INFO[formato].colunas}, 1fr)`,
                      gridAutoRows: `${FORMATOS_INFO[formato].alturaMm}mm`
                    }}
                  >
                    {etiquetasTotaisComOffset.map((bem, idx) => {
                      if (!bem) {
                        return (
                          <div 
                            key={`empty-${idx}`} 
                            className="border border-dashed border-slate-300 rounded flex items-center justify-center text-[10px] text-slate-400 bg-slate-50/50"
                            style={{ height: `${FORMATOS_INFO[formato].alturaMm}mm` }}
                          >
                            Espaço livre (#{idx + 1})
                          </div>
                        );
                      }

                      return (
                        <div key={`etiqueta-a4-${bem.id}-${idx}`} className="page-break-avoid flex justify-center">
                          <EtiquetaCapanemaCard
                            bem={bem}
                            qrCodeUrl={qrCodeUrls[bem.id]}
                            estiloVisual={estiloVisual}
                            larguraMm={FORMATOS_INFO[formato].larguraMm}
                            alturaMm={FORMATOS_INFO[formato].alturaMm}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Layout Rolo Térmico Contínuo */
                  <div className="space-y-4 flex flex-col items-center">
                    {listaComCopias.map((bem, idx) => (
                      <div 
                        key={`etiqueta-termica-${bem.id}-${idx}`}
                        className="page-break-avoid flex justify-center"
                      >
                        <EtiquetaCapanemaCard
                          bem={bem}
                          qrCodeUrl={qrCodeUrls[bem.id]}
                          estiloVisual={estiloVisual}
                          larguraMm={FORMATOS_INFO[formato].larguraMm}
                          alturaMm={FORMATOS_INFO[formato].alturaMm}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Rodapé do Modal */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 shrink-0">
              <div className="flex items-center gap-4">
                <span>
                  <strong>Total a Imprimir:</strong> {listaComCopias.length} etiqueta(s)
                </span>
                <span>
                  <strong>Dimensões:</strong> 5,0 cm × 3,5 cm (Largura × Altura)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleImprimir}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir no Navegador (Ctrl + P)
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

// ==========================================
// COMPONENTE VISUAL DA ETIQUETA OFICIAL DE CAPANEMA (5 × 3,5 CM)
// ==========================================
interface EtiquetaCapanemaCardProps {
  bem: PatrimonioRecord;
  qrCodeUrl?: string;
  estiloVisual: EstiloVisual;
  larguraMm: number;
  alturaMm: number;
}

const EtiquetaCapanemaCard: React.FC<EtiquetaCapanemaCardProps> = ({
  bem,
  qrCodeUrl,
  estiloVisual,
  larguraMm,
  alturaMm
}) => {
  const numeroApenas = (() => {
    // Prioriza Etiqueta_Numero (conforme padrão oficial e solicitação de Capanema)
    const raw = (bem.etiquetaNumero || bem.numeroTombamento || bem.id || '').trim();
    if (!raw) return '0';
    if (raw.includes('-')) {
      const parts = raw.split('-');
      const lastDigits = parts[parts.length - 1].replace(/\D/g, '');
      if (lastDigits) return parseInt(lastDigits, 10).toString();
    }
    const digits = raw.replace(/\D/g, '');
    if (digits) {
      if (digits.length <= 6) return parseInt(digits, 10).toString();
      return digits;
    }
    return raw;
  })();

  // 1. MODELO OFICIAL CAPANEMA (IDÊNTICO AO PDF: AZUL ESCURO, BRASÃO OFICIAL, PATRIMÔNIO, QR CODE E Nº)
  if (estiloVisual === 'capanema-azul-oficial') {
    return (
      <div 
        style={{ 
          width: `${larguraMm}mm`, 
          height: `${alturaMm}mm`,
          backgroundColor: '#080c44'
        }}
        className="etiqueta-capanema-print rounded-[2px] p-[1.6mm] flex items-center justify-between overflow-hidden select-none shadow-sm shrink-0 border border-[#080c44]"
      >
        {/* Coluna Esquerda: Cartão Branco Oficial com Brasão de Capanema (Borda Fina Limpa sem linhas parasitas) */}
        <div className="h-full flex items-center justify-center shrink-0">
          <img 
            src="/assets/aistudio/brasao_capanema_limpo.png" 
            alt="Prefeitura de Capanema" 
            className="h-full w-auto object-contain rounded-[1px] pointer-events-none select-none"
          />
        </div>

        {/* Coluna Direita: PATRIMÔNIO (subido) + QR Code + Nº Tombamento (descido e alinhado) */}
        <div className="flex-1 h-full flex flex-col items-center justify-between pt-0 pb-0 pl-[1.5mm] shrink-0 text-white leading-none">
          {/* Topo: Texto PATRIMÔNIO - subido em direção ao topo com -mt-[0.7mm] */}
          <div 
            style={{ fontFamily: '"Times New Roman", Times, "Liberation Serif", serif' }}
            className="-mt-[0.7mm] h-[3.8mm] flex items-center justify-center text-[10.5px] font-bold tracking-widest uppercase text-center text-white drop-shadow-xs"
          >
            PATRIMÔNIO
          </div>

          {/* Centro: Quadrado Branco com QR Code 2D aumentado em proporções iguais (20.5mm x 20.5mm) */}
          <div className="h-[21.8mm] flex items-center justify-center my-auto">
            <div className="bg-white p-[0.5mm] rounded-[1.5px] flex items-center justify-center shadow-xs">
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt={`QR ${bem.numeroTombamento}`}
                  className="w-[20.5mm] h-[20.5mm] object-contain pointer-events-none"
                />
              ) : (
                <div className="w-[20.5mm] h-[20.5mm] bg-slate-100 flex items-center justify-center text-[8px] text-slate-400">
                  QR
                </div>
              )}
            </div>
          </div>

          {/* Base: Nº do Tombamento - Descido em direção à borda inferior (-mb-[0.12mm]), mantendo alinhamento com Times New Roman e Lining Figures */}
          <div 
            style={{ 
              fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
              fontVariantNumeric: 'lining-nums tabular-nums',
              fontFeatureSettings: '"lnum" 1, "tnum" 1'
            }}
            className="-mb-[0.12mm] h-[5mm] w-full flex items-baseline justify-center text-center leading-none select-none text-white drop-shadow-xs"
          >
            <span className="text-[14px] font-bold">N</span>
            <span className="text-[9.5px] font-bold -translate-y-[3.5px] ml-[0.3px] mr-[2.5px]">º</span>
            <span className="text-[14px] font-bold tracking-tight">
              {numeroApenas}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. MODELO MONOCROMÁTICO P&B PARA RIBBON TÉRMICO (ECONÔMICO)
  if (estiloVisual === 'capanema-mono-termica') {
    return (
      <div 
        style={{ 
          width: `${larguraMm}mm`, 
          height: `${alturaMm}mm`
        }}
        className="etiqueta-capanema-print bg-white rounded-[2px] p-[1.6mm] flex items-center justify-between overflow-hidden select-none border-2 border-black text-black shrink-0"
      >
        {/* Coluna Esquerda: Brasão */}
        <div className="h-full flex items-center justify-center shrink-0">
          <img 
            src="/assets/aistudio/brasao_capanema_limpo.png" 
            alt="Prefeitura de Capanema" 
            className="h-full w-auto object-contain grayscale contrast-150 rounded-[1px] pointer-events-none"
          />
        </div>

        {/* Coluna Direita: PATRIMÔNIO + QR Code + Nº */}
        <div className="flex-1 h-full flex flex-col items-center justify-between pt-0 pb-0 pl-[1.5mm] shrink-0 text-black leading-none">
          <div 
            style={{ fontFamily: '"Times New Roman", Times, "Liberation Serif", serif' }}
            className="-mt-[0.7mm] h-[3.8mm] flex items-center justify-center text-[10.5px] font-bold tracking-widest uppercase text-center"
          >
            PATRIMÔNIO
          </div>

          <div className="h-[21.8mm] flex items-center justify-center my-auto">
            <div className="p-[0.5mm] border border-black/40 rounded flex items-center justify-center">
              {qrCodeUrl && (
                <img 
                  src={qrCodeUrl} 
                  alt={`QR ${bem.numeroTombamento}`}
                  className="w-[20.5mm] h-[20.5mm] object-contain pointer-events-none"
                />
              )}
            </div>
          </div>

          <div 
            style={{ 
              fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
              fontVariantNumeric: 'lining-nums tabular-nums',
              fontFeatureSettings: '"lnum" 1, "tnum" 1'
            }}
            className="-mb-[0.12mm] h-[5mm] w-full flex items-baseline justify-center text-center leading-none select-none"
          >
            <span className="text-[14px] font-bold">N</span>
            <span className="text-[9.5px] font-bold -translate-y-[3.5px] ml-[0.3px] mr-[2.5px]">º</span>
            <span className="text-[14px] font-bold tracking-tight">
              {numeroApenas}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 3. MODELO DETALHADO (COM SECRETARIA E CÓDIGO DE BARRAS)
  return (
    <div 
      style={{ 
        width: `${larguraMm}mm`, 
        height: `${alturaMm}mm`
      }}
      className="etiqueta-capanema-print bg-white rounded-[2px] p-[1.5mm] flex flex-col justify-between overflow-hidden select-none border-2 border-slate-900 text-slate-900 shrink-0"
    >
      {/* Topo Oficial */}
      <div className="flex items-center gap-1.5 border-b border-black/30 pb-0.5">
        <div className="w-5 h-5 shrink-0">
          <img src="/assets/aistudio/brasao_capanema_limpo.png" alt="PMC" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[7.5px] font-black uppercase truncate">PREFEITURA DE CAPANEMA</div>
          <div className="text-[6.5px] font-semibold text-slate-600 truncate">DEPARTAMENTO DE PATRIMÔNIO PÚBLICO</div>
        </div>
        <div className="text-[11px] font-serif font-black text-blue-900 whitespace-nowrap">
          Nº {numeroApenas}
        </div>
      </div>

      {/* Meio: QR Code + Descrição + Secretaria */}
      <div className="flex items-center gap-1.5 my-0.5">
        {qrCodeUrl && (
          <img src={qrCodeUrl} alt="QR" className="w-10 h-10 object-contain shrink-0 border border-slate-200" />
        )}
        <div className="flex-1 min-w-0 leading-tight space-y-0.5">
          <div className="text-[7.5px] font-bold uppercase line-clamp-2">{bem.descricao}</div>
          <div className="text-[6.5px] text-slate-700 font-medium truncate">{bem.secretariaSetor}</div>
          {bem.departamento && (
            <div className="text-[6px] text-slate-500 italic truncate">Setor: {bem.departamento}</div>
          )}
        </div>
      </div>

      {/* Base: Rodapé Legal */}
      <div className="border-t border-black/20 pt-0.5 flex items-center justify-between text-[6px] font-mono font-bold text-slate-600 uppercase">
        <span>PATRIMÔNIO PÚBLICO</span>
        <span>LEI 4.320/64</span>
      </div>
    </div>
  );
};
