import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  UserPlus,
  Users,
  Building2,
  ShieldCheck,
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Mail,
  RefreshCw,
  Check,
  Copy,
  Share2
} from 'lucide-react';
import { useAuth, UserRole, AuthorizedUserRecord } from '../context/AuthContext';
import { GERENTES_LIST } from '../data/secretarias';

interface TeamAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<UserRole, { label: string; desc: string; badgeClass: string }> = {
  admin: {
    label: 'Administrador Geral (DPP)',
    desc: 'Acesso total a todas as Secretarias, exclusão e gestão de equipe',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  gerente: {
    label: 'Gerente Setorial (Padrão)',
    desc: 'Cadastra, edita e transfere bens da própria Secretaria',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  cadastrador: {
    label: 'Gerente Cadastrador (Todas — Só Novo Bem)',
    desc: 'Acesso a todas as 15 Secretarias somente para Cadastrar Novo Bem (sem editar ou excluir)',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
  vistoriador: {
    label: 'Vistoriador de Campo',
    desc: 'Consulta acervo e registra vistorias presenciais via QR Code',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  leitor: {
    label: 'Leitor / Auditor',
    desc: 'Consulta relatórios e fichas (somente leitura)',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const TeamAccessModal: React.FC<TeamAccessModalProps> = ({ isOpen, onClose }) => {
  const {
    realProfile,
    profile,
    authorizedUsers,
    isLoadingUsers,
    usersLoadError,
    refreshAuthorizedUsers,
    addAuthorizedUser,
    removeAuthorizedUser,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'usuarios' | 'secretarias'>('usuarios');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [role, setRole] = useState<UserRole>('gerente');
  const [secretaria, setSecretaria] = useState<string>(GERENTES_LIST[0].secretaria);
  const [departamento, setDepartamento] = useState('Comissão Setorial de Patrimônio');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmRemoveEmail, setConfirmRemoveEmail] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<{
    email: string;
    nome: string;
    source: 'firestore';
  } | null>(null);

  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const nomeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      void refreshAuthorizedUsers();
    }
  }, [isOpen, refreshAuthorizedUsers]);

  const scrollToFormAndFocus = (focusTarget: 'email' | 'nome') => {
    setTimeout(() => {
      scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      if (focusTarget === 'email') {
        emailInputRef.current?.focus();
      } else {
        nomeInputRef.current?.focus();
      }
    }, 30);
  };

  const officialAppUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin.replace('ais-dev-', 'ais-pre-')
      : 'https://studio-9788369134-200bd.web.app';

  const copyWhatsAppInvite = async (user?: AuthorizedUserRecord) => {
    const roleLabel = user ? (ROLE_LABELS[user.role]?.label || 'Gerente Setorial') : 'Fiscal / Gerente de Patrimônio';
    const message = user
      ? [
          `🏛️ *Sistema Oficial de Patrimônio — Prefeitura de Capanema (DPP)*`,
          ``,
          `Olá, *${user.nome}*! Seu acesso foi liberado:`,
          `• *E-mail autorizado:* ${user.email}`,
          `• *Perfil:* ${roleLabel}`,
          `• *Secretaria:* ${user.secretaria}`,
          ``,
          `📲 *Como acessar no celular ou computador:*`,
          `1. Abra o link: ${officialAppUrl}`,
          `2. Toque em *"Entrar com Google"* usando o e-mail acima`,
          `3. Toque em *"Instalar APP"* no topo para deixar o ícone na tela do celular`,
        ].join('\n')
      : [
          `🏛️ *Sistema Oficial de Patrimônio — Prefeitura de Capanema (DPP)*`,
          ``,
          `📲 *Como acessar no celular ou computador:*`,
          `1. Abra o link: ${officialAppUrl}`,
          `2. Toque em *"Entrar com Google"* usando seu Gmail autorizado pela DPP`,
          `3. Toque em *"Instalar APP"* no topo para deixar o ícone na tela do celular`,
        ].join('\n');

    try {
      await navigator.clipboard.writeText(message);
      const key = user ? user.email : '__geral__';
      setCopiedKey(key);
      setFeedback({
        type: 'success',
        text: user
          ? `Convite de WhatsApp copiado para ${user.nome}! Basta colar (Ctrl+V) na conversa.`
          : 'Mensagem de convite copiada! Basta colar no grupo ou conversa do WhatsApp da equipe.',
      });
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2500);
    } catch {
      setFeedback({
        type: 'error',
        text: `Não foi possível copiar automaticamente. Link oficial: ${officialAppUrl}`,
      });
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return authorizedUsers;
    return authorizedUsers.filter(
      (u) =>
        u.nome.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.secretaria.toLowerCase().includes(q) ||
        (u.departamento || '').toLowerCase().includes(q)
    );
  }, [authorizedUsers, searchTerm]);

  const secretariasCoverage = useMemo(() => {
    return GERENTES_LIST.map((g) => {
      const linkedUsers = authorizedUsers.filter(
        (u) =>
          u.ativo !== false &&
          u.secretaria.toLowerCase().trim() === g.secretaria.toLowerCase().trim()
      );
      return {
        ...g,
        linkedUsers,
      };
    });
  }, [authorizedUsers]);

  const totalSecretariasCobertas = secretariasCoverage.filter((s) => s.linkedUsers.length > 0).length;
  const currentUserEmail = (realProfile?.email || profile?.email || '').toLowerCase().trim();
  const activeAdminsCount = useMemo(
    () => authorizedUsers.filter((u) => u.role === 'admin' && u.ativo !== false).length,
    [authorizedUsers]
  );
  const canRemoveUser = (u: AuthorizedUserRecord): boolean => {
    const targetEmail = u.email.toLowerCase().trim();
    if (targetEmail === currentUserEmail) return false;
    if (u.role === 'admin' && activeAdminsCount <= 1) return false;
    return true;
  };

  if (!isOpen) return null;

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFeedback({ type: 'error', text: 'Informe um e-mail Google válido (ex: servidor@gmail.com).' });
      return;
    }
    if (!nome.trim()) {
      setFeedback({ type: 'error', text: 'Informe o nome completo do servidor.' });
      return;
    }

    try {
      setIsSaving(true);
      const wasEditing = editingUser;
      await addAuthorizedUser(
        cleanEmail,
        nome.trim(),
        role,
        role === 'admin' || role === 'cadastrador' ? 'Todas' : secretaria,
        departamento.trim() || 'Setor de Patrimônio'
      );

      // Se trocou o e-mail de uma conta da nuvem durante edição, remove o e-mail antigo
      if (wasEditing && wasEditing.email.toLowerCase() !== cleanEmail && wasEditing.source === 'firestore') {
        try {
          await removeAuthorizedUser(wasEditing.email);
        } catch {
          // Ignora caso seja administrador padrão protegido
        }
      }

      setFeedback({
        type: 'success',
        text: wasEditing
          ? `Alterações salvas na nuvem para ${nome.trim()} (${cleanEmail})! Já vale em qualquer celular ou PC.`
          : `Acesso liberado na nuvem para ${cleanEmail}. O servidor já pode entrar com Google.`,
      });
      setEditingUser(null);
      setEmail('');
      setNome('');
      setRole('gerente');
      setSecretaria(GERENTES_LIST[0].secretaria);
      setDepartamento('Comissão Setorial de Patrimônio');
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Erro ao salvar usuário.';
      const lower = rawMsg.toLowerCase();
      const friendlyMsg =
        lower.includes('quota') || lower.includes('resource-exhausted') || lower.includes('resource_exhausted')
          ? 'Limite diário gratuito do Firebase atingido hoje. As contas já cadastradas continuam funcionando normalmente; amanhã a cota zera e você poderá salvar alterações aqui.'
          : rawMsg;
      setFeedback({ type: 'error', text: friendlyMsg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEmail('');
    setNome('');
    setRole('gerente');
    setSecretaria(GERENTES_LIST[0].secretaria);
    setDepartamento('Comissão Setorial de Patrimônio');
    setFeedback(null);
  };

  const handleEditUser = (u: AuthorizedUserRecord) => {
    const matchedSec =
      u.secretaria === 'Todas'
        ? 'Todas'
        : GERENTES_LIST.find(
            (g) => g.secretaria.toLowerCase().trim() === (u.secretaria || '').toLowerCase().trim()
          )?.secretaria || u.secretaria || GERENTES_LIST[0].secretaria;

    setEditingUser({ email: u.email, nome: u.nome, source: u.source });
    setEmail(u.email);
    setNome(u.nome);
    setRole(u.role);
    setSecretaria(matchedSec);
    setDepartamento(u.departamento || 'Setor de Patrimônio');
    setActiveTab('usuarios');
    setFeedback(null);
    scrollToFormAndFocus('nome');
  };

  const handlePrefillSecretaria = (secName: string, titularNome: string) => {
    setEditingUser(null);
    setEmail('');
    setNome(titularNome);
    setRole('gerente');
    setSecretaria(secName);
    setDepartamento('Comissão Setorial de Patrimônio');
    setActiveTab('usuarios');
    setFeedback(null);
    scrollToFormAndFocus('email');
  };

  const handleConfirmRemove = async (targetEmail: string) => {
    try {
      setIsSaving(true);
      await removeAuthorizedUser(targetEmail);
      setConfirmRemoveEmail(null);
      if (editingUser?.email.toLowerCase() === targetEmail.toLowerCase()) {
        handleCancelEdit();
      }
      setFeedback({ type: 'success', text: `Usuário ${targetEmail} excluído com sucesso. O acesso foi bloqueado imediatamente.` });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Não foi possível excluir este usuário.';
      const lower = rawMsg.toLowerCase();
      const friendlyMsg =
        lower.includes('quota') || lower.includes('resource-exhausted') || lower.includes('resource_exhausted')
          ? 'Limite diário gratuito do Firebase atingido hoje. Amanhã a cota zera e você poderá excluir ou editar contas normalmente.'
          : rawMsg;
      setFeedback({ type: 'error', text: friendlyMsg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-950 via-[#080c44] to-slate-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                Equipe Autorizada e E-mails por Secretaria
              </h2>
              <p className="text-xs text-slate-300">
                Cadastre os e-mails Google reais dos fiscais e gerentes da Prefeitura de Capanema
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas e Resumo */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('usuarios')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'usuarios'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Contas Autorizadas ({authorizedUsers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('secretarias')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'secretarias'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mapa das 15 Secretarias ({totalSecretariasCobertas}/15 com e-mail real)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyWhatsAppInvite()}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Copiar link e passo a passo pronto para enviar aos fiscais no WhatsApp"
            >
              {copiedKey === '__geral__' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === '__geral__' ? 'Convite Copiado!' : 'Copiar Convite WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={refreshAuthorizedUsers}
              disabled={isLoadingUsers}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              <span>Atualizar Nuvem</span>
            </button>
          </div>
        </div>

        {/* Corpo rolável */}
        <div ref={scrollBodyRef} className="p-5 overflow-y-auto space-y-5 flex-1">
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {usersLoadError && (
            <div className="p-3 rounded-xl border bg-amber-50 border-amber-300 text-amber-950 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold">Aviso de leitura na nuvem</div>
                <div>{usersLoadError}</div>
              </div>
            </div>
          )}

          {activeTab === 'usuarios' && (
            <>
              {/* Formulário de Cadastro / Edição */}
              <form
                onSubmit={handleSaveUser}
                autoComplete="off"
                className={`p-4 rounded-2xl border space-y-3 transition-all ${
                  editingUser
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-200/80'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    {editingUser ? (
                      <>
                        <Edit3 className="w-4 h-4 text-amber-600" />
                        <span>Editando servidor: {editingUser.nome}</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 text-blue-600" />
                        <span>Liberar ou Atualizar Conta Google da Equipe</span>
                      </>
                    )}
                  </h3>
                  {editingUser ? (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-amber-300 text-amber-900 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancelar Edição</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Vale na hora em qualquer celular ou PC
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      E-mail Google (Gmail) *
                    </label>
                    <input
                      ref={emailInputRef}
                      type="email"
                      name="novo-servidor-gmail"
                      autoComplete="off"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="servidor@gmail.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nome Completo do Servidor *
                    </label>
                    <input
                      ref={nomeInputRef}
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Maria da Silva"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nível de Acesso *
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="gerente">Gerente Setorial Padrão (Edita sua Secretaria)</option>
                      <option value="cadastrador">Gerente Setorial Cadastrador (Todas — Só Novo Bem)</option>
                      <option value="vistoriador">Vistoriador de Campo (Apenas Vistoria)</option>
                      <option value="leitor">Leitor / Auditor (Somente Leitura)</option>
                      <option value="admin">Administrador Geral (DPP - Todas)</option>
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                      {ROLE_LABELS[role]?.desc}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Secretaria de Lotação *
                    </label>
                    <select
                      value={role === 'admin' || role === 'cadastrador' ? 'Todas' : secretaria}
                      disabled={role === 'admin' || role === 'cadastrador'}
                      onChange={(e) => setSecretaria(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {role === 'admin' ? (
                        <option value="Todas">Todas as 15 Secretarias (Acesso Total)</option>
                      ) : role === 'cadastrador' ? (
                        <option value="Todas">Todas as 15 Secretarias (Somente Novo Bem)</option>
                      ) : (
                        <>
                          <option value="Todas">Todas as Secretarias</option>
                          {GERENTES_LIST.map((g) => (
                            <option key={g.id} value={g.secretaria}>
                              {g.secretaria}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Departamento / Setor
                    </label>
                    <input
                      type="text"
                      value={departamento}
                      onChange={(e) => setDepartamento(e.target.value)}
                      placeholder="Ex: Setor de Patrimônio"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className={`w-full py-2 px-4 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-60 cursor-pointer ${
                        editingUser
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isSaving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>{editingUser ? 'Salvar Alterações' : 'Salvar e Liberar Acesso'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Busca e Tabela de Usuários */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Servidores com Acesso Liberado ({filteredUsers.length})
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      id="team-search-filter"
                      name="team-search-filter"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar nome, e-mail ou pasta..."
                      className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        title="Limpar busca"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {filteredUsers.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-500 bg-white space-y-2">
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center gap-2 text-slate-600">
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Carregando equipe autorizada na nuvem...</span>
                        </div>
                      ) : searchTerm.trim() ? (
                        <>
                          <p>
                            Nenhum servidor encontrado para <strong>"{searchTerm.trim()}"</strong>.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
                          >
                            Limpar filtro de busca
                          </button>
                        </>
                      ) : (
                        <p>
                          Nenhuma conta carregada ainda. Clique em <strong>"Atualizar Nuvem"</strong> ou cadastre um servidor no formulário acima.
                        </p>
                      )}
                    </div>
                  )}
                  {filteredUsers.map((u) => {
                    const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.gerente;
                    const isConfirmingRemove = confirmRemoveEmail === u.email;
                    const isEditingThisRow = editingUser?.email.toLowerCase() === u.email.toLowerCase();
                    return (
                      <div
                        key={u.email}
                        className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                          isEditingThisRow
                            ? 'bg-amber-50/80 ring-1 ring-inset ring-amber-300'
                            : 'bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{u.nome}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleInfo.badgeClass}`}
                            >
                              {roleInfo.label}
                            </span>
                            {isEditingThisRow && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                Editando acima
                              </span>
                            )}
                            {u.source === 'firestore' ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Nuvem
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                Base DPP
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-mono text-slate-800">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {u.email}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-slate-700">{u.secretaria}</span>
                            {u.departamento && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500">{u.departamento}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => copyWhatsAppInvite(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Copiar mensagem personalizada de acesso para enviar no WhatsApp deste servidor"
                          >
                            {copiedKey === u.email ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-emerald-600" />
                            )}
                            <span>{copiedKey === u.email ? 'Copiado' : 'Convite'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEditUser(u)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              isEditingThisRow
                                ? 'bg-amber-600 text-white hover:bg-amber-700'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="Editar cargo ou secretaria"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{isEditingThisRow ? 'Editando...' : 'Editar'}</span>
                          </button>

                          {canRemoveUser(u) && (
                            isConfirmingRemove ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmRemove(u.email)}
                                  disabled={isSaving}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-60"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveEmail(null)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveEmail(u.email)}
                                className="px-2.5 py-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Excluir usuário e revogar acesso imediatamente"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Excluir</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'secretarias' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950">
                Abaixo estão as <strong>15 Secretarias Oficiais</strong> do cadastro. Para liberar o acesso do responsável de cada pasta, clique em <strong>"+ Vincular E-mail"</strong> e informe o Gmail real do servidor.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {secretariasCoverage.map((sec) => {
                  const hasEmail = sec.linkedUsers.length > 0;
                  return (
                    <div
                      key={sec.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                        hasEmail
                          ? 'bg-white border-emerald-200'
                          : 'bg-amber-50/40 border-amber-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900 leading-snug">
                            {sec.id}. {sec.secretaria}
                          </span>
                          {hasEmail ? (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {sec.linkedUsers.length} ativo(s)
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              Pendente
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Gerente titular: <strong className="text-slate-800">{sec.nome}</strong>
                        </div>

                        {hasEmail && (
                          <div className="pt-1 space-y-1">
                            {sec.linkedUsers.map((lu) => (
                              <div
                                key={lu.email}
                                className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 flex items-center justify-between gap-2"
                              >
                                <span className="font-mono text-slate-800 truncate">{lu.email}</span>
                                <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                                  {lu.nome}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePrefillSecretaria(sec.secretaria, sec.nome)}
                        className="w-full py-1.5 px-3 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{hasEmail ? 'Adicionar Outro E-mail' : 'Vincular E-mail Real'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Somente contas cadastradas aqui ou na lista oficial DPP conseguem entrar via Google.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
