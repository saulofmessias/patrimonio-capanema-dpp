import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signInWithGithub, logoutFirebase, db } from '../services/firebase';
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
  loginGoogle: () => Promise<void>;
  loginGithub: () => Promise<void>;
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

  // Monitorar estado de autenticação real do Firebase Auth (fonte unica: /authorized_users no Firestore)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && user.email) {
        const emailLower = user.email.toLowerCase().trim();
        let resolvedProfile: UserProfile | null = null;

        try {
          const userDoc = await getDoc(doc(db, 'authorized_users', emailLower));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.ativo === false) {
              setIsUnauthorized(true);
              setUnauthorizedEmail(user.email);
              setProfile(null);
              setRealProfile(null);
              setIsLoading(false);
              return;
            }
            const role = (data.role as UserRole) || 'gerente';
            resolvedProfile = {
              uid: user.uid,
              email: user.email,
              nome: data.nome || user.displayName || 'Servidor Autorizado',
              role,
              secretaria: role === 'admin' ? 'Todas' : (data.secretaria || 'Todas'),
              departamento: data.departamento || 'Setor de Patrimônio',
              fotoUrl: user.photoURL || undefined,
              isSimulated: false
            };
          }
        } catch (e) {
          console.warn('Erro ao verificar authorized_users:', e);
        }

        if (resolvedProfile) {
          // Espelho de perfil em /users/{uid}.
          // IMPORTANTE: aqui vao SO campos nao privilegiados. O papel (role), a
          // secretaria e a situacao (ativo) sao definidos pelo administrador em
          // authorized_users e lidos de la pelas regras do Firestore. Gravar
          // `role` aqui permitiria que o proprio servidor se auto-promovesse.
          const userPayload: Record<string, unknown> = {
            email: emailLower,
            nome: resolvedProfile.nome,
            departamento: resolvedProfile.departamento || 'Setor de Patrimônio',
            atualizadoEm: new Date().toISOString()
          };
          if (resolvedProfile.fotoUrl) {
            userPayload.fotoUrl = resolvedProfile.fotoUrl;
          }
          setDoc(doc(db, 'users', user.uid), userPayload, { merge: true }).catch(e => {
            console.warn('Aviso ao sincronizar perfil em /users:', e);
          });

          setIsUnauthorized(false);
          setUnauthorizedEmail(null);
          setRealProfile(resolvedProfile);
          setProfile(resolvedProfile);
          setIsLoading(false);
          if (resolvedProfile.role === 'admin') {
            refreshAuthorizedUsers();
          }
          return;
        }

        // Se não existe em authorized_users (ou está inativo), BLOQUEIA o acesso
        setIsUnauthorized(true);
        setUnauthorizedEmail(user.email);
        setProfile(null);
        setRealProfile(null);
      } else {
        setProfile(null);
        setRealProfile(null);
        setIsUnauthorized(false);
        setUnauthorizedEmail(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [refreshAuthorizedUsers]);

  const loginGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Falha no login Google:', err);
      throw err;
    }
  };

  const loginGithub = async () => {
    try {
      await signInWithGithub();
    } catch (err) {
      console.error('Falha no login GitHub:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutFirebase();
    } catch (err) {
      console.error('Falha no logout:', err);
    } finally {
      setFirebaseUser(null);
      setProfile(null);
      setRealProfile(null);
      setIsUnauthorized(false);
      setUnauthorizedEmail(null);
    }
  };

  const loginDemo = () => {
    setIsUnauthorized(false);
    setUnauthorizedEmail(null);
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
      loginGoogle,
      loginGithub,
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
