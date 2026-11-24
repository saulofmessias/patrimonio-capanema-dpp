import React, { useState } from 'react';
import { useAuth, SYSTEM_ACCOUNTS } from '../context/AuthContext';
import { TeamAccessModal } from './TeamAccessModal';
import {
  Shield, LogIn, LogOut, Check, ChevronDown,
  Cloud, Users, RotateCcw, Eye
} from 'lucide-react';

export const UserAuthBar: React.FC = () => {
  const {
    profile,
    loginGoogle,
    logout,
    simulateProfile,
    resetToRealUser,
    isAdmin,
    isRealAdmin,
  } = useAuth();

  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const isDemoMode = profile?.uid === 'demo-leitor';

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await loginGoogle();
    } catch {
      // Ignorar cancelamento de popup
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getRoleBadgeLabel = () => {
    if (!profile) return '';
    if (profile.role === 'admin') return 'Administrador Geral (DPP)';
    if (profile.role === 'gerente') return `Gerente: ${profile.secretaria}`;
    if (profile.role === 'vistoriador') return `Vistoriador: ${profile.secretaria}`;
    return isDemoMode ? 'Modo Demonstração (Somente Leitura)' : 'Leitor / Auditor';
  };

  return (
    <>
      <div className="bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Lado Esquerdo: Identificação do Usuário e Perfil */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-inner text-xs">
              {profile?.nome.charAt(0) || 'U'}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                isDemoMode ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
          </div>

          <div className="leading-tight min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-100 text-xs truncate">{profile?.nome}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase ${
                  isAdmin
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    : isDemoMode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                }`}
              >
                {getRoleBadgeLabel()}
              </span>
              {profile?.isSimulated && !isDemoMode && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded">
                  Simulação RBAC
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span className="truncate">{profile?.email}</span>
              <span>•</span>
              <span className="text-slate-300 font-medium truncate">{profile?.secretaria}</span>
            </div>
          </div>
        </div>

        {/* Lado Direito: Equipe, Auditoria RBAC, Login/Logout */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gerenciar E-mails da Equipe (Apenas Administrador Real) */}
          {isRealAdmin && (
            <button
              type="button"
              onClick={() => setShowTeamModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white border border-blue-500 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cadastrar e-mails Google reais da equipe por Secretaria"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Equipe / Acessos</span>
            </button>
          )}

          {/* Voltar para Admin Geral quando estiver simulando outro perfil */}
          {isRealAdmin && profile?.isSimulated && (
            <button
              type="button"
              onClick={resetToRealUser}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Voltar p/ Admin</span>
            </button>
          )}

          {/* Seletor Rápido de Gerente para testes de Permissão (Apenas Administrador DPP Real) */}
          {isRealAdmin && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-colors"
                title="Alternar entre Administrador Geral e Gerentes das 15 Secretarias (Auditoria)"
              >
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Auditoria RBAC:</span>
                <strong className="text-slate-100 font-bold max-w-[130px] truncate">
                  {profile?.role === 'admin'
                    ? 'Admin Geral'
                    : profile?.secretaria.replace('SECRETARIA DE ', 'SEC. ')}
                </strong>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showSwitchMenu && (
                <div className="absolute right-0 mt-1 w-72 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 py-2 z-50 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Auditar Visão de Secretarias</span>
                    <span className="text-blue-600 font-semibold">Perfis DPP</span>
                  </div>

                  {SYSTEM_ACCOUNTS.map((acc) => {
                    const isCurrent =
                      profile?.email === acc.email ||
                      (acc.role === 'admin' && profile?.role === 'admin' && !profile.isSimulated);
                    return (
                      <button
                        key={acc.uid}
                        type="button"
                        onClick={() => {
                          simulateProfile(acc.secretaria);
                          setShowSwitchMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                          isCurrent ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-semibold">{acc.nome}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {acc.role === 'admin'
                              ? 'Acesso Total a Todas as 15 Secretarias'
                              : acc.secretaria}
                          </div>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Em Modo Demonstração: botão rápido para entrar com Conta Google */}
          {isDemoMode && (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isLoggingIn ? 'Entrando...' : 'Entrar com Google'}</span>
            </button>
          )}

          {/* Botão de Sair do Sistema */}
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white flex items-center gap-1.5 transition-all font-bold text-xs shadow-sm cursor-pointer active:scale-95 border border-red-500"
            title="Desconectar do sistema e voltar para a tela de login"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair do Sistema</span>
          </button>

          {/* Indicador de Conexão */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px]">
            {isDemoMode ? (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Somente Leitura</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Firestore Ativo</span>
              </>
            )}
          </div>
        </div>
      </div>

      {isRealAdmin && (
        <TeamAccessModal
          isOpen={showTeamModal}
          onClose={() => setShowTeamModal(false)}
        />
      )}
    </>
  );
};
