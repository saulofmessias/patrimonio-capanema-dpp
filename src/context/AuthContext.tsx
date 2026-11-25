import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, logoutFirebase, db } from '../services/firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { GERENTES_LIST } from '../components/AppSheetPatrimonioForm';
import { canOperarNaSecretaria } from '../data/secretarias';
import { handleFirestoreError, OperationType } from '../services/firebase';

export type UserRole = 'admin' | 'gerente' | 'vistoriador' | 'leitor';

export interface UserProfile {
  uid: string;
  email: string;
  nome: string;
  role: UserRole;
  secretaria: string;
  departamento?: string;
  fotoUrl?: string;
  isSimulated?: boolean;
  isPlaceholderEmail?: boolean;
}

export interface AuthorizedUserRecord {
  email: string;
  nome: string;
  role: UserRole;
  secretaria: string;
  departamento?: string;
  ativo?: boolean;
  criadoPor?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  source: 'firestore';
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  realProfile: UserProfile | null;
  isLoading: boolean;
  isUnauthorized: boolean;
  unauthorizedEmail: string | null;
  authCheckError: string | null;
  retryAuthCheck: () => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loginDemo: () => void;
  simulateProfile: (secretariaIdOrName: string) => void;
  resetToRealUser: () => void;
  canEditSecretaria: (secretaria: string) => boolean;
  canCreatePatrimonio: boolean;
  canRegisterVistoria: boolean;
  isAdmin: boolean;
  isRealAdmin: boolean;
  authorizedUsers: AuthorizedUserRecord[];
  isLoadingUsers: boolean;
  refreshAuthorizedUsers: () => Promise<void>;
  addAuthorizedUser: (
    email: string,
    nome: string,
    role: UserRole,
    secretaria: string,
    departamento?: string
  ) => Promise<void>;
  removeAuthorizedUser: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const VERIFIED_PROFILE_CACHE_KEY = 'capanema_verified_profile_v1';

function readCachedVerifiedProfile(uid: string, emailLower: string): UserProfile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VERIFIED_PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (
      parsed &&
      parsed.uid === uid &&
      typeof parsed.email === 'string' &&
      parsed.email.toLowerCase().trim() === emailLower &&
      parsed.role &&
      ['admin', 'gerente', 'vistoriador', 'leitor'].includes(parsed.role)
    ) {
      return {
        uid: parsed.uid,
        email: parsed.email,
        nome: parsed.nome || 'Servidor Autorizado',
        role: parsed.role as UserRole,
        secretaria: parsed.role === 'admin' ? 'Todas' : (parsed.secretaria || 'Todas'),
        departamento: parsed.departamento || 'Setor de Patrimônio',
        fotoUrl: parsed.fotoUrl,
        isSimulated: false,
      };
    }
  } catch {
    // Ignora cache corrompido
  }
  return null;
}

function writeCachedVerifiedProfile(profile: UserProfile): void {
  if (typeof localStorage === 'undefined' || profile.isSimulated) return;
  try {
    localStorage.setItem(VERIFIED_PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Ignora limite de localStorage
  }
}

function clearCachedVerifiedProfile(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(VERIFIED_PROFILE_CACHE_KEY);
  } catch {
    // Ignora erro de storage
  }
}

function isTransientFirestoreError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  const code = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code || '').toLowerCase()
    : '';
  return (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('resource-exhausted') ||
    code.includes('internal') ||
    code.includes('aborted') ||
    code.includes('network') ||
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('network') ||
    msg.includes('failed to fetch')
  );
}

// Perfis institucionais simulados (sem e-mails pessoais no bundle) usados apenas para auditoria RBAC pelo Admin
export const SYSTEM_ACCOUNTS: UserProfile[] = GERENTES_LIST.map((g) => ({
  uid: `gerente-${g.id}`,
  email: `gerente.${g.secretaria.toLowerCase().replace(/[^a-z]/g, '')}@capanema.pa.gov.br`,
  nome: g.nome,
  role: 'gerente' as UserRole,
  secretaria: g.secretaria,
  departamento: 'Comissão Setorial de Patrimônio',
  isPlaceholderEmail: true
}));

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [realProfile, setRealProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null);
  const [authCheckError, setAuthCheckError] = useState<string | null>(null);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUserRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  const refreshAuthorizedUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, 'authorized_users'));
      const activeUsers: AuthorizedUserRecord[] = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        const emailLower = (data.email || d.id || '').toLowerCase().trim();
        if (!emailLower || data.ativo === false) return;
        activeUsers.push({
          email: emailLower,
          nome: data.nome || 'Servidor Autorizado',
          role: (data.role as UserRole) || 'gerente',
          secretaria: data.secretaria || 'Todas',
          departamento: data.departamento || 'Setor de Patrimônio',
          ativo: true,
          criadoPor: data.criadoPor,
          criadoEm: data.criadoEm,
          atualizadoEm: data.atualizadoEm,
          source: 'firestore',
        });
      });

      activeUsers.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

      setAuthorizedUsers(activeUsers);
    } catch (err) {
      console.warn('Erro ao carregar lista de usuários autorizados:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const verifyUserSession = useCallback(async (user: FirebaseUser | null) => {
    setFirebaseUser(user);
    setAuthCheckError(null);

    if (!user || !user.email) {
      setProfile(null);
      setRealProfile(null);
      setIsUnauthorized(false);
      setUnauthorizedEmail(null);
      setIsLoading(false);
      return;
    }

    const emailLower = user.email.toLowerCase().trim();
    const cachedProfile = readCachedVerifiedProfile(user.uid, emailLower);

    // Se já temos o perfil verificado em cache local (ex.: F5 ou abertura offline),
    // aplicamos imediatamente para evitar bloqueio indevido em recarregamentos.
    if (cachedProfile) {
      setIsUnauthorized(false);
      setUnauthorizedEmail(null);
      setRealProfile(cachedProfile);
      setProfile(cachedProfile);
      setIsLoading(false);
    }

    const applyAuthorizedProfile = (resolved: UserProfile) => {
      writeCachedVerifiedProfile(resolved);
      const userPayload: Record<string, unknown> = {
        email: emailLower,
        nome: resolved.nome,
        departamento: resolved.departamento || 'Setor de Patrimônio',
        atualizadoEm: new Date().toISOString()
      };
      if (resolved.fotoUrl) {
        userPayload.fotoUrl = resolved.fotoUrl;
      }
      setDoc(doc(db, 'users', user.uid), userPayload, { merge: true }).catch(e => {
        console.warn('Aviso ao sincronizar perfil em /users:', e);
      });

      setIsUnauthorized(false);
      setUnauthorizedEmail(null);
      setAuthCheckError(null);
      setRealProfile(resolved);
      setProfile(resolved);
      setIsLoading(false);
      if (resolved.role === 'admin') {
        refreshAuthorizedUsers();
      }
    };

    const applyExplicitDenied = () => {
      clearCachedVerifiedProfile();
      setIsUnauthorized(true);
      setUnauthorizedEmail(user.email);
      setAuthCheckError(null);
      setProfile(null);
      setRealProfile(null);
      setIsLoading(false);
    };

    // Garante que o token do Firebase Auth esteja pronto no F5 antes de consultar o Firestore
    const fetchAuthorizedDocWithRetry = async () => {
      try {
        await user.getIdToken();
      } catch {
        // Segue (pode estar offline)
      }
      try {
        return await getDoc(doc(db, 'authorized_users', emailLower));
      } catch (firstErr) {
        // 1 tentativa extra renovando o token (resolve race condition comum após F5)
        try {
          await user.getIdToken(true);
          return await getDoc(doc(db, 'authorized_users', emailLower));
        } catch {
          throw firstErr;
        }
      }
    };

    try {
      const userDoc = await fetchAuthorizedDocWithRetry();

      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.ativo === false) {
          applyExplicitDenied();
          return;
        }
        const role = (data.role as UserRole) || 'gerente';
        applyAuthorizedProfile({
          uid: user.uid,
          email: user.email,
          nome: data.nome || user.displayName || 'Servidor Autorizado',
          role,
          secretaria: role === 'admin' ? 'Todas' : (data.secretaria || 'Todas'),
          departamento: data.departamento || 'Setor de Patrimônio',
          fotoUrl: user.photoURL || undefined,
          isSimulated: false
        });
        return;
      }

      // Documento ainda não existe em authorized_users:
      // Auto-recuperação segura validada EXCLUSIVAMENTE pelo servidor (firestore.rules).
      // Apenas administradores bootstrap conseguem criar o próprio doc; qualquer outro
      // usuário recebe PERMISSION_DENIED do servidor.
      try {
        const nowIso = new Date().toISOString();
        const adminNome = user.displayName || 'Administrador Geral DPP';
        await setDoc(doc(db, 'authorized_users', emailLower), {
          email: emailLower,
          nome: adminNome,
          role: 'admin',
          secretaria: 'Todas',
          departamento: 'Diretoria de Patrimônio Público (DPP)',
          ativo: true,
          criadoPor: emailLower,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
        });
        applyAuthorizedProfile({
          uid: user.uid,
          email: user.email,
          nome: adminNome,
          role: 'admin',
          secretaria: 'Todas',
          departamento: 'Diretoria de Patrimônio Público (DPP)',
          fotoUrl: user.photoURL || undefined,
          isSimulated: false,
        });
        return;
      } catch (bootstrapErr) {
        if (isTransientFirestoreError(bootstrapErr)) {
          if (cachedProfile) {
            setIsLoading(false);
            return;
          }
          setAuthCheckError(
            'Não foi possível validar suas credenciais na nuvem agora (conexão instável ou cota diária atingida). Tente novamente em instantes.'
          );
          setIsUnauthorized(false);
          setIsLoading(false);
          return;
        }
        // Rejeitado explicitamente pelo servidor (PERMISSION_DENIED) -> não autorizado
        applyExplicitDenied();
        return;
      }
    } catch (err) {
      console.warn('Erro ao verificar authorized_users:', err);
      // Em erro de rede/offline/cota após F5, mantém o perfil verificado em cache
      // (nunca mostra falsamente "Acesso Pendente de Autorização").
      if (cachedProfile) {
        if (cachedProfile.role === 'admin') {
          refreshAuthorizedUsers();
        }
        setIsLoading(false);
        return;
      }

      if (isTransientFirestoreError(err)) {
        setAuthCheckError(
          'Falha temporária ao consultar o servidor de autenticação (sem internet, conexão instável ou limite diário do Firebase). Clique em "Tentar novamente".'
        );
        setIsUnauthorized(false);
        setProfile(null);
        setRealProfile(null);
        setIsLoading(false);
        return;
      }

      // Outro erro inesperado sem cache -> mostra tela com botão de tentar novamente
      setAuthCheckError(
        'Não foi possível confirmar sua autorização no Firestore neste momento. Clique em "Tentar novamente" ou saia e entre novamente com o Google.'
      );
      setIsUnauthorized(false);
      setProfile(null);
      setRealProfile(null);
      setIsLoading(false);
    }
  }, [refreshAuthorizedUsers]);

  // Monitorar estado de autenticação real do Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void verifyUserSession(user);
    });
    return () => unsubscribe();
  }, [verifyUserSession]);

  const retryAuthCheck = async () => {
    setIsLoading(true);
    await verifyUserSession(auth.currentUser);
  };

  const loginGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Falha no login Google:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutFirebase();
    } catch (err) {
      console.error('Falha no logout:', err);
    } finally {
      clearCachedVerifiedProfile();
      setFirebaseUser(null);
      setProfile(null);
      setRealProfile(null);
      setIsUnauthorized(false);
      setUnauthorizedEmail(null);
      setAuthCheckError(null);
    }
  };

  const loginDemo = () => {
    setIsUnauthorized(false);
    setUnauthorizedEmail(null);
    setAuthCheckError(null);
    setRealProfile(null);
    setProfile({
      uid: 'demo-leitor',
      email: 'visitante.demonstracao@capanema.pa.gov.br',
      nome: 'Visitante (Modo Demonstração)',
      role: 'leitor',
      secretaria: 'Todas',
      departamento: 'Consulta e Demonstração',
      isSimulated: true
    });
  };

  // Simular perfil de qualquer um dos 15 Gerentes de Patrimônio para testes de auditoria (apenas Admin real)
  const simulateProfile = (secretariaOrId: string) => {
    if (realProfile?.role !== 'admin') return;

    if (secretariaOrId === 'admin' || secretariaOrId === 'Todas') {
      setProfile(realProfile);
      return;
    }

    const gerenteFound = SYSTEM_ACCOUNTS.find(
      u => u.secretaria === secretariaOrId || u.uid === secretariaOrId
    );

    if (gerenteFound) {
      setProfile({ ...gerenteFound, isSimulated: true });
    }
  };

  const resetToRealUser = () => {
    if (realProfile) {
      setProfile(realProfile);
    } else {
      setProfile(null);
    }
  };

  // Cadastrar ou atualizar servidor autorizado (Apenas Administrador Geral)
  const addAuthorizedUser = async (
    email: string,
    nome: string,
    role: UserRole,
    secretaria: string,
    departamento?: string
  ) => {
    const emailLower = email.toLowerCase().trim();
    const nowIso = new Date().toISOString();
    try {
      await setDoc(
        doc(db, 'authorized_users', emailLower),
        {
          email: emailLower,
          nome: nome.trim(),
          role,
          secretaria: role === 'admin' ? 'Todas' : secretaria,
          departamento: (departamento || 'Setor de Patrimônio').trim(),
          ativo: true,
          criadoPor: realProfile?.email || profile?.email || 'dpp@capanema.pa.gov.br',
          criadoEm: nowIso,
          atualizadoEm: nowIso,
        },
        { merge: true }
      );
      await refreshAuthorizedUsers();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `authorized_users/${emailLower}`);
      throw err;
    }
  };

  // Remover autorização de um servidor (protege contra auto-exclusão e exclusão do último admin)
  const removeAuthorizedUser = async (email: string) => {
    const emailLower = email.toLowerCase().trim();
    const currentEmail = (realProfile?.email || profile?.email || '').toLowerCase().trim();

    if (emailLower === currentEmail) {
      throw new Error('Não é possível excluir sua própria conta de administrador enquanto estiver logado.');
    }

    const activeAdmins = authorizedUsers.filter((u) => u.role === 'admin' && u.ativo !== false);
    const isTargetAdmin = activeAdmins.some((u) => u.email.toLowerCase().trim() === emailLower);
    if (isTargetAdmin && activeAdmins.length <= 1) {
      throw new Error('Não é possível excluir o último Administrador Geral ativo da DPP.');
    }

    try {
      await deleteDoc(doc(db, 'authorized_users', emailLower));
      await refreshAuthorizedUsers();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `authorized_users/${emailLower}`);
      throw err;
    }
  };

  // Verificar se o usuário pode editar/transferir patrimônio desta secretaria
  const canEditSecretaria = (secretariaAlvo: string): boolean => {
    if (!profile) return false;
    if (profile.role === 'leitor' || profile.role === 'vistoriador') return false;
    if (profile.role === 'admin') return true;
    // Compara sem acento, caixa e grafias legadas ("ASSITENCIA" x "ASSISTÊNCIA").
    return canOperarNaSecretaria(profile.secretaria, secretariaAlvo);
  };

  const canCreatePatrimonio = !!profile && (profile.role === 'admin' || profile.role === 'gerente');
  const canRegisterVistoria = !!profile && profile.role !== 'leitor';
  const isAdmin = profile?.role === 'admin';
  const isRealAdmin = realProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      profile,
      realProfile,
      isLoading,
      isUnauthorized,
      unauthorizedEmail,
      authCheckError,
      retryAuthCheck,
      loginGoogle,
      logout,
      loginDemo,
      simulateProfile,
      resetToRealUser,
      canEditSecretaria,
      canCreatePatrimonio,
      canRegisterVistoria,
      isAdmin,
      isRealAdmin,
      authorizedUsers,
      isLoadingUsers,
      refreshAuthorizedUsers,
      addAuthorizedUser,
      removeAuthorizedUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
