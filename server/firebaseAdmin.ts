import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminConfig } from './config';
import { errors } from './errors';

let app: App | undefined;

export function getFirebaseAdminApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }

  const config = getFirebaseAdminConfig();
  try {
    app = initializeApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
      projectId: config.projectId,
    });
    return app;
  } catch (error) {
    console.error('Firebase Admin initialization failed', error instanceof Error ? error.name : 'unknown_error');
    throw errors.configuration('Firebase Admin no pudo inicializarse. Revisa projectId, clientEmail y el formato de la private key.');
  }
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getFirebaseAdminApp(), getFirebaseAdminDatabaseId());
}

function getFirebaseAdminDatabaseId(): string {
  return getFirebaseAdminConfig().databaseId;
}
