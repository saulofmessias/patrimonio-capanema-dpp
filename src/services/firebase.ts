import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Usa banco nomeado quando configurado (AI Studio) ou o banco padrão "(default)" em projetos Firebase Spark comuns
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Error handling conforming to the AI Studio Firestore specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

/**
 * Registra e propaga um erro do Firestore.
 *
 * O log vai enxuto de propósito: o console do navegador fica aberto nos
 * dispositivos dos servidores da prefeitura, então não gravamos e-mail nem
 * UID de servidores ali. O detalhe completo fica anexado ao erro lançado
 * (`erro.firestoreInfo`) para quem precisar tratar o caso.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const mensagem = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: mensagem,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
    },
  };

  console.error(`[Firestore:${operationType}] ${path ?? '(sem caminho)'} -> ${mensagem}`);

  const erro = new Error(`Firestore ${operationType} em ${path ?? '(sem caminho)'}: ${mensagem}`);
  (erro as Error & { firestoreInfo?: FirestoreErrorInfo }).firestoreInfo = errInfo;
  throw erro;
}

// CRITICAL CONSTRAINT: Test connection on app initialization
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Client is offline or connecting to Firestore.");
      return false;
    }
    // Expected in security rules when document doesn't exist
    return true;
  }
}

// Google Sign-In with Popup
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Erro ao autenticar com Google:', err);
    throw err;
  }
}

// Sign-Out
export async function logoutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Erro ao deslogar:', err);
    throw err;
  }
}
