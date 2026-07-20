import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  TwitterAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  linkWithPopup,
} from 'firebase/auth';
import { firebaseConfig, isAuthConfigured } from './config.js';

let app = null;
let auth = null;
let currentUser = null;
const listeners = new Set();

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const xProvider = new TwitterAuthProvider();

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
    isX: providerIds.includes('twitter.com'),
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

  // Complete redirect flow (mobile browsers that block popups)
  getRedirectResult(auth)
    .then((result) => {
      if (result?.user) {
        currentUser = mapUser(result.user);
        emit();
      }
    })
    .catch((err) => {
      console.warn('Auth redirect result:', err?.code || err?.message);
    });

  return { configured: true, auth };
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function signInWithProvider(provider, label) {
  if (!isAuthConfigured()) {
    throw new Error(
      'Sign-in is not configured. Add Firebase env vars (see README) to enable Google & X login.'
    );
  }
  if (!auth) initAuth();

  try {
    if (isMobile()) {
      await signInWithRedirect(auth, provider);
      return snapshot(); // page will navigate
    }
    const result = await signInWithPopup(auth, provider);
    currentUser = mapUser(result.user);
    emit();
    return snapshot();
  } catch (err) {
    // Popup blocked → redirect
    if (err?.code === 'auth/popup-blocked' || (err?.code === 'auth/cancelled-popup-request' && isMobile())) {
      await signInWithRedirect(auth, provider);
      return snapshot();
    }
    if (err?.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in window was closed. Try again.');
    }
    if (err?.code === 'auth/account-exists-with-different-credential') {
      throw new Error(
        'An account already exists with the same email using a different sign-in method. Use the original provider.'
      );
    }
    if (err?.code === 'auth/unauthorized-domain') {
      throw new Error(
        'This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.'
      );
    }
    if (err?.code === 'auth/operation-not-allowed') {
      throw new Error(
        `${label} sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.`
      );
    }
    if (
      err?.code === 'auth/configuration-not-found' ||
      /CONFIGURATION_NOT_FOUND|auth config not found/i.test(err?.message || '')
    ) {
      throw new Error(
        'Firebase Authentication is not enabled yet. Open Firebase Console → Authentication → Get started, then enable Google and Twitter (X).'
      );
    }
    if (err?.code === 'auth/invalid-api-key') {
      throw new Error('Invalid Firebase API key. Check VITE_FIREBASE_API_KEY.');
    }
    if (err?.code === 'auth/invalid-credential') {
      throw new Error(
        label === 'X'
          ? 'X credentials rejected. In developer.x.com: enable OAuth 1.0a, set callback https://spaceimpact-bb672.firebaseapp.com/__/auth/handler, then paste the Consumer API Key + Secret (not Bearer/Access tokens) into Firebase → Authentication → Twitter.'
          : 'Invalid credential. Check the provider keys in Firebase Console.'
      );
    }
    throw new Error(err?.message || `${label} sign-in failed`);
  }
}

/** Sign in or create account with Google */
export async function signInWithGoogle() {
  return signInWithProvider(googleProvider, 'Google');
}

/** Sign in or create account with X (Twitter) */
export async function signInWithX() {
  return signInWithProvider(xProvider, 'X');
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

/**
 * Optionally link the other provider to the current account.
 */
export async function linkGoogle() {
  if (!auth?.currentUser) throw new Error('Sign in first.');
  await linkWithPopup(auth.currentUser, googleProvider);
  currentUser = mapUser(auth.currentUser);
  emit();
}

export async function linkX() {
  if (!auth?.currentUser) throw new Error('Sign in first.');
  await linkWithPopup(auth.currentUser, xProvider);
  currentUser = mapUser(auth.currentUser);
  emit();
}

export { isAuthConfigured };
