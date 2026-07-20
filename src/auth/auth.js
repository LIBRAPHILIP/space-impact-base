import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { firebaseConfig, isAuthConfigured } from './config.js';

let app = null;
let auth = null;
let currentUser = null;
const listeners = new Set();

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function emit() {
  const snap = snapshot();
  for (const fn of listeners) fn(snap);
}

function mapUser(user) {
  if (!user) return null;
  const providerIds = user.providerData.map((p) => p.providerId);
  return {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || user.email?.split('@')[0] || 'Pilot',
    photoURL: user.photoURL || null,
    providerIds,
    isGoogle: providerIds.includes('google.com'),
    raw: user,
  };
}

export function snapshot() {
  return {
    configured: isAuthConfigured(),
    user: currentUser,
    signedIn: Boolean(currentUser),
  };
}

export function onAuthChange(fn) {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

export function initAuth() {
  if (!isAuthConfigured()) {
    emit();
    return { configured: false };
  }
  if (auth) return { configured: true, auth };

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  onAuthStateChanged(auth, (user) => {
    currentUser = mapUser(user);
    emit();
  });

  getRedirectResult(auth)
    .then((result) => {
      if (result?.user) {
        currentUser = mapUser(result.user);
        emit();
      }
    })
    .catch((err) => {
      console.warn('Auth redirect result:', err?.code || err?.message);
      try {
        sessionStorage.setItem('auth:lastError', friendlyAuthError(err));
      } catch {
        /* ignore */
      }
    });

  return { configured: true, auth };
}

export function consumeLastAuthError() {
  try {
    const msg = sessionStorage.getItem('auth:lastError');
    if (msg) sessionStorage.removeItem('auth:lastError');
    return msg;
  } catch {
    return null;
  }
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function friendlyAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in window was closed. Try again.';
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email via another method.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized in Firebase. Add space-impact-base.vercel.app under Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled. Enable Google in Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/configuration-not-found' || /CONFIGURATION_NOT_FOUND/i.test(err?.message || '')) {
    return 'Firebase Authentication is not fully set up. Open Authentication → Get started, then enable Google.';
  }
  if (code === 'auth/invalid-api-key') return 'Invalid Firebase API key.';
  if (code === 'auth/invalid-credential') {
    return 'Invalid credential. Check Google sign-in is enabled in Firebase Console.';
  }
  if (code === 'auth/popup-blocked') return 'Popup blocked. Allow popups for this site and try again.';
  return err?.message || 'Google sign-in failed';
}

/** Sign in or create account with Google */
export async function signInWithGoogle() {
  if (!isAuthConfigured()) {
    throw new Error('Sign-in is not configured. Add Firebase env vars to enable Google login.');
  }
  if (!auth) initAuth();

  try {
    if (isMobile()) {
      await signInWithRedirect(auth, googleProvider);
      return snapshot();
    }
    const result = await signInWithPopup(auth, googleProvider);
    currentUser = mapUser(result.user);
    emit();
    return snapshot();
  } catch (err) {
    console.error('Google sign-in error:', err?.code, err);
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, googleProvider);
      return snapshot();
    }
    throw new Error(friendlyAuthError(err));
  }
}

export async function signOut() {
  if (!auth) {
    currentUser = null;
    emit();
    return;
  }
  await fbSignOut(auth);
  currentUser = null;
  emit();
}

export { isAuthConfigured };
