import React, { useState, useEffect, useRef } from 'react';
import { lazyImport, prefetchImport } from '../utils/lazyImport';
import { 
  Camera, QrCode, Search, CheckCircle2, AlertCircle, X, 
  MapPin, User, Building2, Tag, Calendar, DollarSign, Upload,
  RefreshCw, Check, Sparkles, FileText, Shield, Image as ImageIcon,
  Volume2, Lightbulb, LightbulbOff, Smartphone, HelpCircle
} from 'lucide-react';
import { PatrimonioRecord, VistoriaRecord } from '../types/appsheet';
import { buildEtiquetaQrFicha, extractCodigoFromQrData, findPatrimonioByCodigo } from '../utils/etiquetaQr';
import { compressImageFile } from '../utils/photoStorage';
import { fetchAndCacheCloudPhoto } from '../utils/cloudPhotoSync';
import { GERENTES_LIST } from './AppSheetPatrimonioForm';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patrimonios: PatrimonioRecord[];
  onAddVistoria: (v: VistoriaRecord) => void;
  onUpdatePatrimonio: (p: PatrimonioRecord) => void;
  photosMap?: Record<string, string>;
  onOpenPhotoSync?: () => void;
  onPhotoResolved?: (fotoKey: string, dataUrl: string) => void;
}

// Bip de confirmação óptica e háptica (simula leitor profissional Zebra/Honeywell)
const emitSuccessFeedback = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // Nota Si5 (988 Hz)
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    }
  } catch {
    // Ignora restrição de áudio sem interação
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate?.([60, 40, 60]);
    } catch {
      // Ignora erro de vibração
    }
  }
};

export const VistoriaScannerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  patrimonios,
  onAddVistoria,
  onUpdatePatrimonio,
  photosMap = {},
  onOpenPhotoSync,
  onPhotoResolved
}) => {
  const { profile } = useAuth();
  
  // Modos: Scanner com Câmera ou Digitação Manual
  const [activeMode, setActiveMode] = useState<'camera' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);

  // Bem Selecionado/Escaneado
  const [manualQuery, setManualQuery] = useState<string>('');
  const [scannedBem, setScannedBem] = useState<PatrimonioRecord | null>(null);
  const [scannedBemPhotoUrl, setScannedBemPhotoUrl] = useState<string | null>(null);
  const [isLoadingScannedPhoto, setIsLoadingScannedPhoto] = useState<boolean>(false);
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // QR Code de Teste para o usuário poder testar na tela com a câmera
  const [testQrUrl, setTestQrUrl] = useState<string | null>(null);
  const [showTestCard, setShowTestCard] = useState<boolean>(false);

  // Formulário de Vistoria
  const [estadoConservacao, setEstadoConservacao] = useState<PatrimonioRecord['estadoConservacao']>('Bom');
  const [statusEncontrado, setStatusEncontrado] = useState<VistoriaRecord['statusEncontrado']>('Localizado no Setor');
  const [novaLocalizacao, setNovaLocalizacao] = useState<string>('');
  const [parecerTecnico, setParecerTecnico] = useState<string>('');
  const [fotoVistoriaBase64, setFotoVistoriaBase64] = useState<string | null>(null);
  const [fotoVistoriaSizeKb, setFotoVistoriaSizeKb] = useState<number | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [atualizarFotoPrincipal, setAtualizarFotoPrincipal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Refs de vídeo e canvas para decodificar QR Code
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Modulo jsQR carregado sob demanda (evita entrar no pacote inicial do app)
  const jsQRRef = useRef<typeof import('jsqr').default | null>(null);

  // Gerar QR Code de Teste oficial (Nº 13) ao abrir modal para permitir mira na tela
  useEffect(() => {
    if (isOpen) {
      // Aquece o decodificador enquanto o usuario mira a camera na etiqueta.
      prefetchImport('jsqr', () => import('jsqr')).then((modulo) => {
        if (modulo) jsQRRef.current = modulo.default;
      });

      const bemTeste = findPatrimonioByCodigo(patrimonios, '13');
      const payloadTeste = bemTeste
        ? buildEtiquetaQrFicha(bemTeste)
        : buildEtiquetaQrFicha({
            id: '13',
            etiquetaNumero: '13',
            numeroTombamento: '13',
            descricao: 'Item de Teste',
            status: 'Ativo / Em Uso',
            secretariaSetor: 'GABINETE DO PREFEITO',
            departamento: 'Setor Geral'
          });
      let cancelado = false;
      lazyImport('qrcode', () => import('qrcode'))
        .then(({ default: QRCode }) => QRCode.toDataURL(payloadTeste, {
          errorCorrectionLevel: 'M',
          width: 280,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        }))
        .then(url => { if (!cancelado) setTestQrUrl(url); })
        .catch(() => {});
      return () => { cancelado = true; };
    }
  }, [isOpen]);

  // Resolver foto cadastrada do bem escaneado (memória -> IndexedDB -> Nuvem Firestore sob demanda)
  useEffect(() => {
    let active = true;
    if (!scannedBem) {
      setScannedBemPhotoUrl(null);
      setIsLoadingScannedPhoto(false);
      return;
    }

    const fotoRaw = (scannedBem.fotoBem || '').trim();
    if (!fotoRaw) {
      setScannedBemPhotoUrl(null);
      setIsLoadingScannedPhoto(false);
      setAtualizarFotoPrincipal(true);
      return;
    }

    const cleanKey = fotoRaw.toLowerCase();
    const fileName = cleanKey.split('/').pop() || '';
    const fromMap = photosMap[cleanKey] || (fileName ? photosMap[fileName] : undefined);
    if (fromMap) {
      setScannedBemPhotoUrl(fromMap);
      setIsLoadingScannedPhoto(false);
      setAtualizarFotoPrincipal(false);
      return;
    }

    setIsLoadingScannedPhoto(true);
    fetchAndCacheCloudPhoto(fotoRaw).then((url) => {
      if (!active) return;
      setScannedBemPhotoUrl(url);
      setIsLoadingScannedPhoto(false);
      setAtualizarFotoPrincipal(!url);
      if (url && onPhotoResolved) {
        onPhotoResolved(fotoRaw, url);
      }
    });
    return () => {
      active = false;
    };
  }, [scannedBem, photosMap, onPhotoResolved]);

  const getResponsavelDisplay = (bem: PatrimonioRecord): string => {
    const resp = (bem.responsavel || '').trim();
    if (/^\d+$/.test(resp)) {
      const found = GERENTES_LIST.find((g) => String(g.id) === resp);
      if (found) return found.nome;
    }
    return resp || 'A Definir';
  };

  // Iniciar câmera quando abrir modal no modo camera
  useEffect(() => {
    if (isOpen && activeMode === 'camera' && !scannedBem) {
      iniciarCamera();
    } else {
      pararCamera();
    }

    return () => {
      pararCamera();
    };
  }, [isOpen, activeMode, scannedBem]);

  const pararCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setIsTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const nextState = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as MediaTrackConstraintSet]
        });
        setIsTorchOn(nextState);
      } catch (e) {
        console.warn('Erro ao alternar lanterna:', e);
      }
    }
  };

  const iniciarCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      streamRef.current = stream;
      
      // Checar suporte a lanterna (torch)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as { torch?: boolean };
        setHasTorchSupport(Boolean(capabilities?.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        animationFrameId.current = requestAnimationFrame(scanVideoFrame);
      }
    } catch (err: unknown) {
      console.warn('Erro ao acessar câmera:', err);
      setCameraError('Câmera indisponível ou permissão negada. Você pode digitar o número do tombamento abaixo ou clicar nos botões de teste.');
      setActiveMode('manual');
    }
  };

  // Loop contínuo de decodificação de frames
  const scanVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // jsQR ja foi aquecido na abertura do modal; se ainda nao carregou,
        // o proximo frame do loop tenta de novo.
        const jsQR = jsQRRef.current;
        if (!jsQR) {
          animationFrameId.current = requestAnimationFrame(scanVideoFrame);
          return;
        }
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          processarDadoQrCode(code.data);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(scanVideoFrame);
  };

  // Processa o conteúdo lido pelo QR Code (aceita URL direta, número puro ou formatos legados)
  const processarDadoQrCode = (dado: string) => {
    pararCamera();
    setScanFeedback(null);

    const numeroBuscado = extractCodigoFromQrData(dado);
    const achado = findPatrimonioByCodigo(patrimonios, numeroBuscado);

    if (achado) {
      emitSuccessFeedback();
      setScannedBem(achado);
      setEstadoConservacao(achado.estadoConservacao || 'Bom');
      setNovaLocalizacao(achado.local || achado.localizacaoExata || achado.departamento || '');
    } else {
      setScanFeedback(
        `Patrimônio com código "${numeroBuscado}" não foi localizado na base de ${patrimonios.length.toLocaleString('pt-BR')} bens.`
      );
      if (activeMode === 'camera') {
        iniciarCamera();
      }
    }
  };

  // Busca manual
  const handleBuscaManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim()) return;

    processarDadoQrCode(manualQuery.trim());
  };

  // Leitura de imagem estática carregada do rolo da câmera
  const handleCarregarFotoParaLeitura = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const { default: jsQR } = await lazyImport('jsqr', () => import('jsqr'));
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            processarDadoQrCode(code.data);
          } else {
            setScanFeedback('Não foi possível identificar um QR Code nítido nesta imagem.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Tirar foto do bem durante a vistoria com compressão automática
  const handleFotoBemChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 960,
        quality: 0.72,
      });
      setFotoVistoriaBase64(compressed);
      setFotoVistoriaSizeKb(Math.max(1, Math.round((compressed.length * 0.75) / 1024)));
    } catch (err) {
      console.warn('Erro ao comprimir foto da vistoria:', err);
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  // Salvar Vistoria
  const handleSalvarVistoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBem) return;

    setIsSaving(true);
    setSaveSuccess(false);

    const vistoriaId = `vist_${Date.now()}`;
    const dataHoje = new Date().toISOString().split('T')[0];
    const vistoriadorNome = profile?.nome || 'Comissão Setorial de Patrimônio / DPP';

    const novaVistoria: VistoriaRecord = {
      id: vistoriaId,
      patrimonioId: scannedBem.id,
      patrimonioNumero: scannedBem.numeroTombamento,
      patrimonioDescricao: scannedBem.descricao,
      dataVistoria: dataHoje,
      statusEncontrado: statusEncontrado,
      vistoriador: vistoriadorNome,
      parecer: parecerTecnico.trim() || `Vistoria física realizada. Estado de conservação: ${estadoConservacao}.`,
      fotoVistoria: fotoVistoriaBase64 || undefined
    };

    // 1. Atualizar registro local de vistoria
    onAddVistoria(novaVistoria);

    // 2. Atualizar o patrimônio com novo estado, data e opcionalmente a nova foto
    const nowIso = new Date().toISOString();
    const shouldUpdateMainPhoto = Boolean(atualizarFotoPrincipal && fotoVistoriaBase64);
    const bemAtualizado: PatrimonioRecord = {
      ...scannedBem,
      estadoConservacao: estadoConservacao,
      local: novaLocalizacao.trim() || scannedBem.local,
      localizacaoExata: novaLocalizacao.trim() || scannedBem.localizacaoExata,
      fotoBem: shouldUpdateMainPhoto ? (fotoVistoriaBase64 || scannedBem.fotoBem) : scannedBem.fotoBem,
      atualizadoEm: nowIso
    };
    onUpdatePatrimonio(bemAtualizado);

    // 3. Persistir no Firestore
    try {
      await setDoc(doc(db, 'vistorias', vistoriaId), novaVistoria);
      const patrimonioPatch: Record<string, unknown> = {
        estadoConservacao: estadoConservacao,
        local: novaLocalizacao.trim() || scannedBem.local || '',
        localizacaoExata: novaLocalizacao.trim() || scannedBem.localizacaoExata || '',
        dataUltimaVistoria: dataHoje,
        atualizadoEm: nowIso
      };
      if (shouldUpdateMainPhoto && fotoVistoriaBase64) {
        patrimonioPatch.fotoBem = fotoVistoriaBase64;
      }
      await setDoc(doc(db, 'patrimonios', scannedBem.id), patrimonioPatch, { merge: true });
    } catch (err) {
      console.warn('Erro ao sincronizar vistoria com Firestore (salvo offline):', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `vistorias/${vistoriaId}`);
      } catch {}
    }

    setIsSaving(false);
    setSaveSuccess(true);

    setTimeout(() => {
      setScannedBem(null);
      setScannedBemPhotoUrl(null);
      setSaveSuccess(false);
      setFotoVistoriaBase64(null);
      setFotoVistoriaSizeKb(null);
      setParecerTecnico('');
      setActiveMode('camera');
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Vistoria e Inventário em Campo</h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-400/30 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Leitor de QR Ativo
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Auditoria física presencial • Leitura de etiquetas da Prefeitura de Capanema
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[82vh] space-y-6">
          
          {/* Se nenhum bem foi escaneado ainda: Viewfinder do Scanner */}
          {!scannedBem ? (
            <div className="space-y-4">
              
              {/* Abas Scanner Câmera vs Manual */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setActiveMode('camera'); setCameraError(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeMode === 'camera'
                      ? 'bg-white text-blue-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-4 h-4 text-blue-600" />
                  Câmera do Celular / Tablet
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveMode('manual'); pararCamera(); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeMode === 'manual'
                      ? 'bg-white text-blue-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Search className="w-4 h-4 text-blue-600" />
                  Digitar Tombamento
                </button>
              </div>

              {scanFeedback && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{scanFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanFeedback(null)}
                    className="text-rose-500 hover:text-rose-800 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Viewfinder da Câmera */}
              {activeMode === 'camera' && (
                <div className="space-y-3">
                  <div className="relative aspect-video max-h-72 w-full bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 flex items-center justify-center shadow-inner">
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover" 
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Guia visual de enquadramento da etiqueta 5x3,5 cm */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-56 h-40 border-2 border-dashed border-emerald-400 rounded-xl bg-emerald-500/10 flex flex-col items-center justify-between p-3">
                        <span className="text-[10px] text-emerald-300 font-bold bg-slate-900/80 px-2 py-0.5 rounded">
                          Aponte para o QR Code da Etiqueta
                        </span>
                        <div className="w-8 h-8 border-2 border-emerald-400 rounded-lg animate-pulse" />
                        <span className="text-[9px] text-slate-300 font-mono bg-slate-900/80 px-1.5 py-0.5 rounded">
                          Padrão Capanema 5 × 3,5 cm
                        </span>
                      </div>
                    </div>

                    {/* Lanterna para vistorias em depósitos com pouca luz */}
                    {hasTorchSupport && cameraActive && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`absolute top-3 right-3 p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md z-10 ${
                          isTorchOn 
                            ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-300' 
                            : 'bg-slate-900/80 text-white hover:bg-slate-800'
                        }`}
                        title="Ligar/Desligar Lanterna"
                      >
                        {isTorchOn ? <Lightbulb className="w-4 h-4 text-slate-900" /> : <LightbulbOff className="w-4 h-4 text-slate-300" />}
                        <span className="hidden sm:inline">{isTorchOn ? 'Lanterna Ligada' : 'Lanterna'}</span>
                      </button>
                    )}

                    {!cameraActive && (
                      <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white p-4 text-center">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mb-2" />
                        <p className="text-xs font-medium">Iniciando câmera traseira...</p>
                      </div>
                    )}
                  </div>

                  {cameraError && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  {/* Painel de Testes Rápidos e QR de Referência */}
                  <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Testes Rápidos de Bipagem:
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTestCard(!showTestCard)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        {showTestCard ? 'Ocultar QR de Teste' : 'Ver QR na Tela para Mirar'}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => processarDadoQrCode('13')}
                        className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                        title="Simular leitura imediata da etiqueta Nº 13"
                      >
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        Bipar Tombo Nº 13 (Gabinete)
                      </button>
                      <button
                        type="button"
                        onClick={() => processarDadoQrCode('1')}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all"
                        title="Simular leitura imediata do Tombo Nº 1"
                      >
                        Tombo Nº 1 (SEMED)
                      </button>
                      <button
                        type="button"
                        onClick={() => processarDadoQrCode('100')}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all"
                        title="Simular leitura imediata do Tombo Nº 100"
                      >
                        Tombo Nº 100
                      </button>
                    </div>

                    {/* Amostra visual da Etiqueta Oficial de Capanema gerada para teste na tela */}
                    {showTestCard && testQrUrl && (
                      <div className="mt-3 p-3 bg-white rounded-xl border border-blue-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
                        <div 
                          style={{ backgroundColor: '#080c44' }} 
                          className="p-2 rounded-lg flex items-center gap-2 border border-blue-950 shrink-0"
                        >
                          <img 
                            src="/assets/aistudio/brasao_capanema_limpo.png" 
                            alt="Brasão" 
                            className="h-14 w-auto object-contain"
                          />
                          <div className="flex flex-col items-center">
                            <span className="text-[7px] text-white font-bold tracking-widest font-serif">PATRIMÔNIO</span>
                            <div className="bg-white p-1 rounded my-0.5">
                              <img src={testQrUrl} alt="QR Teste Nº 13" className="w-14 h-14 object-contain" />
                            </div>
                            <span className="text-[9px] text-white font-bold font-serif">Nº 13</span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          <p className="font-bold text-slate-900 flex items-center gap-1">
                            <QrCode className="w-3.5 h-3.5 text-blue-600" />
                            Etiqueta Padrão 5 × 3,5 cm (Tombo 13)
                          </p>
                          <p className="text-[11px] leading-relaxed">
                            Aponte a câmera do seu celular ou a webcam para este QR Code. O leitor irá decodificar o código, emitir o bip de confirmação sonora e abrir a ficha do Ar Condicionado do Gabinete.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/60">
                      <label className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5">
                        <Upload className="w-4 h-4" />
                        <span>Carregar foto da galeria</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleCarregarFotoParaLeitura} 
                        />
                      </label>
                      <span className="text-[11px] text-slate-400">Leitor jsQR a 60 FPS</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Modo Manual de Busca */}
              {activeMode === 'manual' && (
                <form onSubmit={handleBuscaManual} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Número de Tombamento ou Código do Patrimônio:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Ex: 13, DPP-2026-0013..."
                        value={manualQuery}
                        onChange={(e) => setManualQuery(e.target.value)}
                        className="flex-1 text-sm font-semibold px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5"
                      >
                        <Search className="w-4 h-4" />
                        Localizar
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs">
                    💡 Dica: Você pode digitar apenas o número da etiqueta física que o sistema faz a conferência automática na base de {patrimonios.length.toLocaleString('pt-BR')} bens.
                  </div>
                </form>
              )}

            </div>
          ) : (
            /* Formulário de Vistoria quando o bem é escaneado com sucesso */
            <form onSubmit={handleSalvarVistoria} className="space-y-5">
              
              {/* Card do Bem Identificado (com Foto do Bem ao Bipar) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-[#080c44] text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded font-mono">
                    ✓ Bem Identificado
                  </span>
                  <button
                    type="button"
                    onClick={() => { setScannedBem(null); setScannedBemPhotoUrl(null); setActiveMode('camera'); }}
                    className="text-xs text-blue-200 hover:text-white underline"
                  >
                    Escanear Outro Bem
                  </button>
                </div>

                <div className="flex items-start gap-3.5">
                  {/* Miniatura da Foto Cadastrada do Bem (exibida apenas quando disponível ou carregando) */}
                  {(isLoadingScannedPhoto || scannedBemPhotoUrl) && (
                    <div className="shrink-0">
                      {isLoadingScannedPhoto ? (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-blue-500/50 bg-blue-950/70 flex flex-col items-center justify-center text-blue-200 p-2 text-center">
                          <RefreshCw className="w-5 h-5 animate-spin mb-1 text-emerald-300" />
                          <span className="text-[9px] leading-tight">Carregando foto...</span>
                        </div>
                      ) : scannedBemPhotoUrl ? (
                        <button
                          type="button"
                          onClick={() => setExpandedPhotoUrl(scannedBemPhotoUrl)}
                          className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-blue-400/50 bg-slate-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          title="Toque para ampliar a foto do bem"
                        >
                          <img
                            src={scannedBemPhotoUrl}
                            alt={`Foto do patrimônio ${scannedBem.etiquetaNumero || scannedBem.numeroTombamento}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-slate-950/70 text-[9px] text-white font-semibold py-0.5 text-center">
                            Ampliar
                          </span>
                        </button>
                      ) : null}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xl font-black font-serif tracking-tight text-white">
                        Nº {scannedBem.etiquetaNumero || scannedBem.numeroTombamento}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-blue-100 border border-white/20">
                        {scannedBem.status}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-blue-100 mt-0.5 line-clamp-2">
                      {scannedBem.descricao}
                    </div>
                    {(scannedBem.local || scannedBem.departamento) && (
                      <div className="text-[11px] text-blue-200/90 mt-1 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-emerald-300 shrink-0" />
                        <span className="truncate">
                          {[scannedBem.local, scannedBem.departamento].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-blue-200 pt-2 border-t border-blue-800">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                    <span className="truncate">{scannedBem.secretariaSetor}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                    <span className="truncate">{getResponsavelDisplay(scannedBem)}</span>
                  </div>
                </div>
              </div>

              {/* Campos da Auditoria de Vistoria */}
              <div className="space-y-4">
                
                {/* 1. Estado de Conservação */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Estado de Conservação Conferido no Local:
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {(['Excelente', 'Bom', 'Regular', 'Ruim / Danificado', 'Inservível / Ocioso'] as const).map((est) => (
                      <button
                        key={est}
                        type="button"
                        onClick={() => setEstadoConservacao(est)}
                        className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all ${
                          estadoConservacao === est
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {est.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Status de Localização */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Conferência de Localização:
                  </label>
                  <select
                    value={statusEncontrado}
                    onChange={(e) => setStatusEncontrado(e.target.value as VistoriaRecord['statusEncontrado'])}
                    className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Localizado no Setor">Localizado no Setor Cadastrado</option>
                    <option value="Localizado em Outro Setor">Localizado em Outro Setor / Sala Diferente</option>
                    <option value="Não Localizado">Não Localizado (Pendente de Busca / Extravio)</option>
                  </select>
                </div>

                {/* 3. Detalhamento da Sala / Prédio */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Sala / Departamento Exato Atual:
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Sala dos Professores, Bloco B, Almoxarifado Central..."
                    value={novaLocalizacao}
                    onChange={(e) => setNovaLocalizacao(e.target.value)}
                    className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 4. Captura de Foto do Bem (Câmera do celular com compressão automática) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Foto de Comprovação da Vistoria:</span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      {fotoVistoriaSizeKb ? `Comprimida (${fotoVistoriaSizeKb} KB)` : 'Compressão automática ativa'}
                    </span>
                  </label>
                  
                  {isCompressingPhoto ? (
                    <div className="w-full h-24 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-center gap-2 text-xs text-blue-800 font-semibold">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Otimizando foto para nuvem...</span>
                    </div>
                  ) : fotoVistoriaBase64 ? (
                    <div className="space-y-2">
                      <div className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-300 group">
                        <img 
                          src={fotoVistoriaBase64} 
                          alt="Foto da Vistoria" 
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => { setFotoVistoriaBase64(null); setFotoVistoriaSizeKb(null); }}
                          className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow"
                          title="Remover foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={atualizarFotoPrincipal}
                          onChange={(e) => setAtualizarFotoPrincipal(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Salvar também como foto principal deste patrimônio na nuvem</span>
                      </label>
                    </div>
                  ) : (
                    <label className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-500 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/50">
                      <Camera className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-600 font-medium">
                        Tirar foto com o celular ou anexar
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handleFotoBemChange} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* 5. Parecer Técnico */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Parecer do Vistoriador / Recomendações:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Bem em perfeito estado de funcionamento; etiqueta adesiva 5x3.5cm intacta..."
                    value={parecerTecnico}
                    onChange={(e) => setParecerTecnico(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

              </div>

              {/* Botão de Conclusão */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setScannedBem(null); setActiveMode('camera'); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 active:scale-95 transition-all"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gravando Vistoria...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      Vistoria Registrada!
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar e Salvar Vistoria
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>

      </div>

      {/* Lightbox de ampliação da foto do bem */}
      {expandedPhotoUrl && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setExpandedPhotoUrl(null)}
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setExpandedPhotoUrl(null)}
              className="self-end mb-2 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Fechar
            </button>
            <img
              src={expandedPhotoUrl}
              alt="Foto ampliada do patrimônio"
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl border border-white/20 object-contain bg-slate-900"
            />
          </div>
        </div>
      )}
    </div>
  );
};
