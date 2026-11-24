import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { lazyImport } from '../utils/lazyImport';
import { 
  Smartphone, Download, CheckCircle2, Share, PlusSquare, 
  X, QrCode, Copy, Check, WifiOff, Camera, ShieldCheck, 
  Sparkles, AlertTriangle, RotateCcw
} from 'lucide-react';
import {
  getAppBaseUrl,
  getDefaultAppBaseUrl,
  setCustomQrBaseUrl
} from '../utils/etiquetaQr';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showModal, setShowModal] = useState<boolean>(false);
  const [activeDeviceTab, setActiveDeviceTab] = useState<'android' | 'ios' | 'pc'>('android');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [appUrl, setAppUrl] = useState<string>(() => getAppBaseUrl());

  useEffect(() => {
    if (showModal) {
      setAppUrl(getAppBaseUrl());
    }
  }, [showModal]);

  useEffect(() => {
    const cleanUrl = appUrl.trim();
    if (!cleanUrl) {
      setQrCodeDataUrl('');
      return;
    }
    let cancelado = false;
    lazyImport('qrcode', () => import('qrcode'))
      .then(({ default: QRCode }) => QRCode.toDataURL(cleanUrl, {
        width: 320,
        margin: 1.5,
        color: {
          dark: '#080c44',
          light: '#ffffff'
        }
      }))
      .then(url => { if (!cancelado) setQrCodeDataUrl(url); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [appUrl]);

  const handleCopyLink = () => {
    if (navigator?.clipboard && appUrl) {
      navigator.clipboard.writeText(appUrl.trim());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleUrlChange = (value: string) => {
    setAppUrl(value);
    setCustomQrBaseUrl(value);
  };

  const handleResetDefaultUrl = () => {
    setCustomQrBaseUrl('');
    setAppUrl(getDefaultAppBaseUrl());
  };

  const isPreviewHost = /ais-(dev|pre)-/i.test(appUrl);

  const handleInstallClick = async () => {
    if (isInstallable) {
      try {
        const success = await install();
        if (success) return;
      } catch (err) {
        console.warn('Erro ao chamar install:', err);
      }
    }
    setShowModal(true);
  };

  return (
    <>
      {/* Botão de Destaque no Header / Barra Superior */}
      {isInstalled ? (
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
          title="Aplicativo PWA Instalado e Ativo"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>APP Ativo no Celular</span>
        </button>
      ) : isInstallable ? (
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-900/30 transition-all active:scale-95 animate-pulse hover:animate-none"
          title="Instalar diretamente este aplicativo no celular ou computador"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Instalar APP</span>
        </button>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
          title="Abrir instruções de instalação e QR Code para celular dos fiscais"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
          <span>Instalar APP</span>
        </button>
      )}

      {/* Modal Completo de Instalação no Celular dos Fiscais com QR Code */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 text-slate-900 overflow-hidden my-auto animate-fadeIn">
            
            {/* Header do Modal */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-[#080c44] to-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/apple-touch-icon.png"
                  alt="Brasão Oficial da Prefeitura de Capanema"
                  className="w-10 h-10 rounded-xl object-contain shadow-md border border-blue-400/40 bg-[#241F59]"
                />
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    Aplicativo dos Fiscais de Campo (PWA)
                  </h3>
                  <p className="text-xs text-slate-300">
                    Prefeitura Municipal de Capanema • Leitura de QR Code e Modo Offline
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo Principal em 2 Colunas */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Lado Esquerdo: QR Code para Escanear com a Câmera */}
              <div className="md:col-span-5 flex flex-col items-center text-center p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-blue-600" />
                  Aponte a Câmera
                </span>

                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200">
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="QR Code de Instalação PWA" 
                      className="w-44 h-44 object-contain"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                      Gerando QR Code...
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 mt-2.5 max-w-xs leading-snug">
                  Abra a câmera do celular (Android ou iPhone) e aponte para a tela para abrir o sistema na hora.
                </p>

                <div className="mt-3 w-full space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Link do QR Code
                    </label>
                    {appUrl !== getDefaultAppBaseUrl() && (
                      <button
                        type="button"
                        onClick={handleResetDefaultUrl}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        title="Restaurar endereço padrão"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Padrão
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={appUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <button
                    onClick={handleCopyLink}
                    className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Link Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copiar Link do App</span>
                      </>
                    )}
                  </button>

                  {isPreviewHost && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10.5px] text-amber-900 flex items-start gap-1.5 leading-snug">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Se o celular da equipe exibir <strong>Erro 403</strong>, publique ou compartilhe o app antes (<strong>Compartilhar / Implantar</strong>) e cole o link público acima.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lado Direito: Passo a Passo por Plataforma */}
              <div className="md:col-span-7 space-y-4">
                
                {/* Abas de Plataforma */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  <button
                    onClick={() => setActiveDeviceTab('android')}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${
                      activeDeviceTab === 'android'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🤖 Android (Chrome)
                  </button>
                  <button
                    onClick={() => setActiveDeviceTab('ios')}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${
                      activeDeviceTab === 'ios'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🍎 iPhone (Safari)
                  </button>
                  <button
                    onClick={() => setActiveDeviceTab('pc')}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${
                      activeDeviceTab === 'pc'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    💻 Computador
                  </button>
                </div>

                {/* Guia Android */}
                {activeDeviceTab === 'android' && (
                  <div className="space-y-3 text-xs text-slate-700 animate-fadeIn">
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                        1
                      </span>
                      <div>
                        <strong>Abra no Google Chrome:</strong> Ao abrir pelo QR Code, surgirá um aviso no rodapé <em>&quot;Adicionar à tela inicial&quot;</em>.
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                        2
                      </span>
                      <div>
                        <strong>Ou toque nos 3 pontinhos (⋮):</strong> No canto superior direito do Chrome, clique em <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                        3
                      </span>
                      <div>
                        <strong>Pronto!</strong> O ícone oficial <strong>Patrimônios Capanema</strong> fica salvo na tela inicial do celular. Abre em tela cheia sem a barra do navegador.
                      </div>
                    </div>
                  </div>
                )}

                {/* Guia iPhone */}
                {activeDeviceTab === 'ios' && (
                  <div className="space-y-3 text-xs text-slate-700 animate-fadeIn">
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                        1
                      </span>
                      <div>
                        <strong>Abra no Safari:</strong> No navegador padrão da Apple, toque no ícone de <strong>Compartilhar</strong> (o quadrado com a seta para cima <Share className="w-3.5 h-3.5 inline text-blue-600" />).
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                        2
                      </span>
                      <div>
                        <strong>Selecione &quot;Adicionar à Tela de Início&quot;:</strong> Role a lista para baixo e toque em <PlusSquare className="w-3.5 h-3.5 inline text-slate-700" /> <strong>Adicionar à Tela de Início</strong>.
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                        3
                      </span>
                      <div>
                        <strong>Confirme &quot;Adicionar&quot;:</strong> O sistema funciona nativamente no iOS, usando a câmera do iPhone para escanear etiquetas nos setores.
                      </div>
                    </div>
                  </div>
                )}

                {/* Guia Computador */}
                {activeDeviceTab === 'pc' && (
                  <div className="space-y-3 text-xs text-slate-700 animate-fadeIn">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <strong>Instalar como Programa no Windows / Mac:</strong>
                      <p className="text-[11px] text-slate-600">
                        No Google Chrome ou Edge, clique no ícone de computador com uma setinha na barra de endereços (ao lado da estrela de favoritos) e confirme <strong>&quot;Instalar Patrimônios Capanema&quot;</strong>.
                      </p>
                    </div>

                    {isInstallable && (
                      <button
                        onClick={install}
                        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Instalar Agora neste Computador</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Vantagens Técnicas para a Equipe de Campo */}
                <div className="p-3 rounded-xl bg-slate-900 text-white text-[11px] space-y-1.5">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Recursos Nativos para os Agentes de Inventário:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1 text-[10.5px]">
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Câmera com Lanterna e Bip</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Modo Offline para escolas rurais</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Acervo completo de bens e fotos sincronizado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Sincronização Nuvem Firebase</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Footer do Modal */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                PWA Homologado • Compatível com Android 8+ e iOS 13+
              </span>

              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Concluir
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
