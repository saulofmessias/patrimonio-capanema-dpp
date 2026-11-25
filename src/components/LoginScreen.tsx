import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PatrimonioRecord } from '../types/appsheet';
import {
  Shield, Lock, AlertCircle,
  Building2, RefreshCw, Tag, MapPin, Github
} from 'lucide-react';

interface LoginScreenProps {
  scannedBem?: PatrimonioRecord | null;
  scannedCodigo?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ scannedBem, scannedCodigo }) => {
  const { loginGoogle, loginGithub, logout, firebaseUser, isUnauthorized, unauthorizedEmail } = useAuth();
  const [loggingProvider, setLoggingProvider] = useState<'google' | 'github' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLoggingIn = loggingProvider !== null;

  const traduzirErro = (err: unknown, provedor: 'google' | 'github'): string | null => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('popup-closed-by-user') || msg.includes('cancelled-popup-request')) {
      // Usuário fechou a janela de login manualmente
      return null;
    }
    if (msg.includes('popup-blocked')) {
      return `O navegador bloqueou a janela do ${provedor === 'google' ? 'Google' : 'GitHub'}. Permita pop-ups para este site e tente novamente.`;
    }
    if (msg.includes('unauthorized-domain')) {
      return provedor === 'google'
        ? 'Este endereço ainda não está autorizado para Login Google. Acesse pelo link oficial publicado ou autorize o domínio no Firebase.'
        : 'Este endereço ainda não está autorizado para Login GitHub. Acesse pelo link oficial publicado ou autorize o domínio no Firebase.';
    }
    if (msg.includes('github-no-email')) {
      return 'Sua conta do GitHub não está com o e-mail visível. Torne o e-mail público nas configurações do GitHub ou use o login com a Conta Institucional.';
    }
    if (msg.includes('popup-closed') || msg.includes('access_denied')) {
      return `O acesso via ${provedor === 'google' ? 'Google' : 'GitHub'} foi negado. Verifique as permissões da conta e tente novamente.`;
    }
    return `Não foi possível concluir o login com o ${provedor === 'google' ? 'Google' : 'GitHub'}. Verifique sua conexão e tente novamente.`;
  };

  const handleLoginGoogle = async () => {
    try {
      setLoggingProvider('google');
      setErrorMsg(null);
      await loginGoogle();
    } catch (err: unknown) {
      setErrorMsg(traduzirErro(err, 'google'));
    } finally {
      setLoggingProvider(null);
    }
  };

  const handleLoginGithub = async () => {
    try {
      setLoggingProvider('github');
      setErrorMsg(null);
      await loginGithub();
    } catch (err: unknown) {
      setErrorMsg(traduzirErro(err, 'github'));
    } finally {
      setLoggingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080c44] via-[#101962] to-[#060824] flex flex-col items-center justify-center p-4 sm:p-6 text-white relative overflow-hidden font-sans">
      {/* Elementos visuais de fundo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cartão Central Oficial de Autenticação */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 text-slate-900 relative z-10 animate-fadeIn">
        
        {/* Cabeçalho com o Brasão Oficial de Capanema */}
        <div className="flex flex-col items-center text-center space-y-3 pb-5 border-b border-slate-200">
          <div className="relative">
            <img 
              src="/apple-touch-icon.png" 
              alt="Brasão Oficial da Prefeitura de Capanema" 
              className="w-20 h-20 rounded-2xl object-contain shadow-xl border-2 border-blue-900/30 bg-[#241F59] p-0.5"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-900">
              Estado do Pará
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
              PREFEITURA MUNICIPAL DE CAPANEMA
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-950 font-bold text-[11px] mt-1 border border-blue-200">
              <Building2 className="w-3 h-3 text-blue-700" />
              <span>Diretoria de Patrimônio Público (DPP)</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-snug max-w-xs">
            Sistema Integrado de Gestão Patrimonial, Tombamento e Inventário Setorial
          </p>
        </div>

        {/* Cartão de Identificação Rápida quando acessado por QR Code */}
        {scannedBem && (
          <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-br from-blue-950 to-[#080c44] text-white border border-blue-400/30 shadow-md space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full">
                <Tag className="w-3 h-3" />
                Patrimônio Identificado
              </span>
              <span className="font-serif font-black text-base text-white">
                Nº {scannedBem.etiquetaNumero || scannedBem.numeroTombamento}
              </span>
            </div>
            <div className="text-xs font-bold text-white leading-snug">
              {scannedBem.descricao}
            </div>
            <div className="text-[11px] text-blue-200 space-y-0.5 pt-1 border-t border-blue-800/70">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-blue-300 shrink-0" />
                <span className="truncate">{scannedBem.secretariaSetor}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-blue-300 shrink-0" />
                <span className="truncate">
                  {scannedBem.local || scannedBem.localizacaoExata || 'Sede / Geral'} • {scannedBem.departamento || 'Setor Geral'}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-amber-300/90 font-medium pt-0.5">
              Entre abaixo para abrir a ficha completa, editar ou registrar vistoria.
            </div>
          </div>
        )}

        {!scannedBem && scannedCodigo && (
          <div className="mt-4 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs text-center">
            Etiqueta <strong>Nº {scannedCodigo}</strong> selecionada. Faça login abaixo para abrir a ficha completa.
          </div>
        )}

        {/* Corpo do Cartão: Estado de Não Autorizado OU Botão de Login */}
        <div className="py-5 space-y-4">
          
          {isUnauthorized ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-rose-900">
                    Acesso Pendente de Autorização
                  </h3>
                  <p className="text-[11px] text-rose-800 mt-1 leading-relaxed">
                    A conta <strong>{unauthorizedEmail || firebaseUser?.email}</strong> não possui autorização prévia para acessar o acervo patrimonial de Capanema.
                  </p>
                  <p className="text-[10.5px] text-rose-700 mt-1.5">
                    Para solicitar liberação, entre em contato com a <strong>Diretoria de Patrimônio Público (DPP)</strong> pelo e-mail: <br />
                    <span className="font-mono font-bold text-rose-950">dpp@capanema.pa.gov.br</span>
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-rose-200 flex justify-end">
                <button
                  type="button"
                  onClick={logout}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-100 text-rose-800 font-bold text-xs border border-rose-300 transition-all cursor-pointer shadow-xs"
                >
                  Tentar com outro e-mail
                </button>
              </div>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleLoginGoogle}
                  disabled={isLoggingIn}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-600 hover:to-indigo-600 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-3 shadow-lg shadow-blue-900/30 active:scale-98 transition-all cursor-pointer disabled:opacity-60"
                >
                  {loggingProvider === 'google' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Autenticando com o Google...</span>
                    </>
                  ) : (
                    <>
                      {/* Ícone oficial Google G */}
                      <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Entrar com Conta Institucional</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLoginGithub}
                  disabled={isLoggingIn}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-3 shadow-lg shadow-slate-900/20 active:scale-98 transition-all cursor-pointer disabled:opacity-60"
                >
                  {loggingProvider === 'github' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Autenticando com o GitHub...</span>
                    </>
                  ) : (
                    <>
                      <Github className="w-4 h-4 shrink-0" />
                      <span>Entrar com GitHub</span>
                    </>
                  )}
                </button>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-center">
                  <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ambiente Autenticado e Auditado</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Conforme a Lei nº 4.320/64 e diretrizes do TCM/PA, toda alteração, movimentação e emissão de termo fica registrada com data, hora e responsável.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Aviso de acesso exclusivo institucional */}
          <div className="pt-3 border-t border-slate-200 text-center">
            <p className="text-[10.5px] text-slate-500">
              Acesso restrito a servidores autorizados pela Diretoria de Patrimônio Público (DPP).
            </p>
          </div>
        </div>

        {/* Rodapé do Cartão */}
        <div className="pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
          Prefeitura Municipal de Capanema • Secretaria Municipal de Administração
        </div>
      </div>

      {/* Rodapé Externo da Tela */}
      <div className="mt-6 text-center text-xs text-blue-200/70 space-y-1 relative z-10">
        <div>Diretoria de Patrimônio Público (DPP) • Gestão Municipal</div>
        <div className="text-[11px] text-blue-300/50">Capanema - Pará • Brasil</div>
      </div>
    </div>
  );
};
