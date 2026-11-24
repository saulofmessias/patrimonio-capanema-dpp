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
  source: 'firestore' | 'builtin';
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  realProfile: UserProfile | null;
  isLoading: boolean;
  isUnauthorized: boolean;
  unauthorizedEmail: string | null;
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

export const SUPER_ADMIN_EMAILS = new Set([
  'saulofmessias@gmail.com',
  'elielmarques40@gmail.com',
  'elieldasilvamarques@gmail.com',
]);

// Contas reais pré-cadastradas do Município de Capanema
export const BUILTIN_REAL_ACCOUNTS: UserProfile[] = [
  // 1. Administradores Gerais da DPP
  {
    uid: 'admin-saulo',
    email: 'saulofmessias@gmail.com',
    nome: 'Saulo Messias',
    role: 'admin',
    secretaria: 'Todas',
    departamento: 'Diretoria de Patrimônio Público (DPP)'
  },
  {
    uid: 'admin-eliel',
    email: 'elielmarques40@gmail.com',
    nome: 'Eliel Marques',
    role: 'admin',
    secretaria: 'Todas',
    departamento: 'Diretoria de Patrimônio Público (DPP)'
  },
  {
    uid: 'admin-eliel-alt',
    email: 'elieldasilvamarques@gmail.com',
    nome: 'Eliel da Silva Marques',
    role: 'admin',
    secretaria: 'Todas',
    departamento: 'Diretoria de Patrimônio Público (DPP)'
  },

  // 2. Funcionários e Operadores da DPP
  {
    uid: 'func-danilo',
    email: 'patrimoniopublicocapanema@gmail.com',
    nome: 'Danilo',
    role: 'gerente',
    secretaria: 'SECRETARIA DE ADMINISTRAÇÃO',
    departamento: 'Diretoria de Patrimônio Público (DPP)'
  },

  // 3. Usuários / Fiscais Setoriais (Secretaria de Educação - Sec 5)
  {
    uid: 'user-emano',
    email: 'emanueldamasceno656@gmail.com',
    nome: 'Emano',
    role: 'gerente',
    secretaria: 'SECRETARIA DE EDUCAÇÃO',
    departamento: 'Setor de Patrimônio - Educação'
  },
  {
    uid: 'user-luciano',
    email: 'lucianoafonsomilhomes22@gmail.com',
    nome: 'Luciano',
    role: 'gerente',
    secretaria: 'SECRETARIA DE EDUCAÇÃO',
    departamento: 'Setor de Patrimônio - Educação'
  },
  {
    uid: 'user-luciano1',
    email: 'antonyematheusdomine@gmail.com',
    nome: 'Luciano1',
    role: 'gerente',
    secretaria: 'SECRETARIA DE EDUCAÇÃO',
    departamento: 'Setor de Patrimônio - Educação'
  },

  // 4. Usuários / Fiscais Setoriais (Secretaria de Saúde - Sec 6)
  {
    uid: 'user-dada',
    email: 'nascimentoadalberto53@gmail.com',
    nome: 'Dada',
    role: 'gerente',
    secretaria: 'SECRETARIA DE SAÚDE',
    departamento: 'Setor de Patrimônio - Saúde'
  },
  {
    uid: 'user-daniel',
    email: 'engpescadaniel@gmail.com',
    nome: 'Daniel',
    role: 'gerente',
    secretaria: 'SECRETARIA DE SAÚDE',
    departamento: 'Setor de Patrimônio - Saúde'
  },
];

// Lista completa usada para Auditoria RBAC (inclui perfis simulados das 15 Secretarias)
export const SYSTEM_ACCOUNTS: UserProfile[] = [
  ...BUILTIN_REAL_ACCOUNTS,
  ...GERENTES_LIST.map((g) => ({
    uid: `gerente-${g.id}`,
    email: `gerente.${g.secretaria.toLowerCase().replace(/[^a-z]/g, '')}@capanema.pa.gov.br`,
    nome: g.nome,
    role: 'gerente' as UserRole,
    secretaria: g.secretaria,
    departamento: 'Comissão Setorial de Patrimônio',
    isPlaceholderEmail: true
  }))
];

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
      const firestoreMap = new Map<string, AuthorizedUserRecord>();
      snap.forEach((d) => {
        const data = d.data() || {};
        const emailLower = (data.email || d.id || '').toLowerCase().trim();
        if (!emailLower) return;
        firestoreMap.set(emailLower, {
          email: emailLower,
          nome: data.nome || 'Servidor Autorizado',
          role: (data.role as UserRole) || 'gerente',
          secretaria: data.secretaria || 'Todas',
          departamento: data.departamento || 'Setor de Patrimônio',
          ativo: data.ativo !== false,
          criadoPor: data.criadoPor,
          criadoEm: data.criadoEm,
          atualizadoEm: data.atualizadoEm,
          source: 'firestore',
        });
      });

      const merged: AuthorizedUserRecord[] = Array.from(firestoreMap.values()).filter(
        (u) => u.ativo !== false
      );
      for (const builtIn of BUILTIN_REAL_ACCOUNTS) {
        const emailLower = builtIn.email.toLowerCase().trim();
        if (!firestoreMap.has(emailLower)) {
          merged.push({
            email: emailLower,
            nome: builtIn.nome,
            role: builtIn.role,
            secretaria: builtIn.secretaria,
            departamento: builtIn.departamento,
            ativo: true,
            source: 'builtin',
          });
        }
      }

      merged.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

      setAuthorizedUsers(merged);
    } catch (err) {
      console.warn('Erro ao carregar lista de usuários autorizados:', err);
      // Fallback apenas com contas fixas em memória
      setAuthorizedUsers(
        BUILTIN_REAL_ACCOUNTS.map((b) => ({
          email: b.email.toLowerCase(),
          nome: b.nome,
          role: b.role,
          secretaria: b.secretaria,
          departamento: b.departamento,
          ativo: true,
          source: 'builtin',
        }))
      );
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Monitorar estado de autenticação real do Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && user.email) {
        const emailLower = user.email.toLowerCase().trim();

        // E-mail explicitamente inativo
        if (emailLower === 'virginia.pedagogia2012@gmail.com') {
          setIsUnauthorized(true);
          setUnauthorizedEmail(user.email);
          setProfile(null);
          setRealProfile(null);
          setIsLoading(false);
          return;
        }

        const isSuperAdmin = SUPER_ADMIN_EMAILS.has(emailLower);
        const preMapped = BUILTIN_REAL_ACCOUNTS.find(
          (a) => a.email.toLowerCase().trim() === emailLower
        );

        let resolvedProfile: UserProfile | null = null;

        // 1. Verificar primeiro no Firestore (authorized_users/{email}) para refletir edições ou novos cadastros em tempo real
        try {
          const userDoc = await getDoc(doc(db, 'authorized_users', emailLower));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.ativo === false && !isSuperAdmin) {
              setIsUnauthorized(true);
              setUnauthorizedEmail(user.email);
              setProfile(null);
              setRealProfile(null);
              setIsLoading(false);
              return;
            }
            resolvedProfile = {
              uid: user.uid,
              email: user.email,
              nome: data.nome || user.displayName || preMapped?.nome || 'Servidor Autorizado',
              role: isSuperAdmin ? 'admin' : ((data.role as UserRole) || 'gerente'),
              secretaria: isSuperAdmin ? 'Todas' : (data.secretaria || 'Todas'),
              departamento: data.departamento || preMapped?.departamento || 'Setor de Patrimônio',
              fotoUrl: user.photoURL || undefined,
              isSimulated: false
            };
          }
        } catch (e) {
          console.warn('Erro ao verificar authorized_users:', e);
        }

        // 2. Fallback para contas institucionais pré-cadastradas no código (apenas e-mails reais)
        if (!resolvedProfile && (isSuperAdmin || preMapped)) {
          resolvedProfile = {
            uid: user.uid,
            email: user.email,
            nome: preMapped?.nome || (isSuperAdmin ? 'Administrador Geral DPP' : (user.displayName || 'Servidor Autorizado')),
            role: isSuperAdmin ? 'admin' : (preMapped?.role || 'gerente'),
            secretaria: isSuperAdmin ? 'Todas' : (preMapped?.secretaria || 'Todas'),
            departamento: isSuperAdmin ? 'Diretoria de Patrimônio Público (DPP)' : (preMapped?.departamento || 'Setor de Patrimônio'),
            fotoUrl: user.photoURL || undefined,
            isSimulated: false
          };
        }

        if (resolvedProfile) {
          // Espelho de perfil em /users/{uid}.
          // IMPORTANTE: aqui vao SO campos nao privilegiados. O papel (role), a
          // secretaria e a situacao (ativo) sao definidos pelo administrador em
          // authorized_users e lidos de la pelas regras do Firestore. Gravar
          // `role` aqui permitiria que o proprio servidor se auto-promovesse.
          const perfilMirror: Record<string, unknown> = {
            email: emailLower,
            nome: resolvedProfile.nome,
            departamento: resolvedProfile.departamento || 'Setor de Patrimônio',
            atualizadoEm: new Date().toISOString(),
          };
          if (resolvedProfile.fotoUrl) perfilMirror.fotoUrl = resolvedProfile.fotoUrl;
          setDoc(doc(db, 'users', user.uid), perfilMirror, { merge: true })
            .catch(err => console.warn('Aviso ao sincronizar perfil em /users:', err));

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

        // 3. Se não bateu com nenhuma lista autorizada, BLOQUEIA o acesso
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
          criadoPor: realProfile?.email || profile?.email || 'saulofmessias@gmail.com',
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

  // Remover ou revogar autorização de um servidor (tanto contas da Nuvem quanto da Base DPP)
  const removeAuthorizedUser = async (email: string) => {
    const emailLower = email.toLowerCase().trim();
    if (SUPER_ADMIN_EMAILS.has(emailLower)) {
      throw new Error('Não é possível excluir um Administrador Geral padrão da DPP.');
    }
    const builtInMatch = BUILTIN_REAL_ACCOUNTS.find(
      (b) => b.email.toLowerCase().trim() === emailLower
    );
    try {
      if (builtInMatch) {
        const nowIso = new Date().toISOString();
        await setDoc(
          doc(db, 'authorized_users', emailLower),
          {
            email: emailLower,
            nome: builtInMatch.nome,
            role: builtInMatch.role,
            secretaria: builtInMatch.secretaria,
            departamento: builtInMatch.departamento || 'Setor de Patrimônio',
            ativo: false,
            removidoPor: realProfile?.email || profile?.email || 'saulofmessias@gmail.com',
            atualizadoEm: nowIso,
          },
          { merge: true }
        );
      } else {
        await deleteDoc(doc(db, 'authorized_users', emailLower));
      }
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
