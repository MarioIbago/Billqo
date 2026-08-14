
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

function envValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

const firebaseConfig: FirebaseOptions = {
  apiKey: envValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: envValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: envValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  appId: envValue(import.meta.env.VITE_FIREBASE_APP_ID),
  storageBucket: envValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: envValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
};

for (const field of ['apiKey', 'authDomain', 'projectId', 'appId'] as const) {
  if (!firebaseConfig[field]) {
    throw new Error(`Firebase client configuration is incomplete: missing ${field}.`);
  }
}

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
auth.useDeviceLanguage();

export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
  console.warn('Firebase auth persistence could not be initialized.', error);
});

export const firebaseProjectId = firebaseConfig.projectId;
export const firebaseAuthDomain = firebaseConfig.authDomain;
