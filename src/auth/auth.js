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

/** Fresh provider each time — avoids stale OAuth state */
function makeXProvider() {
  return new TwitterAuthProvider();
}

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

  // Complete redirect flow (X uses redirect; mobile popups often blocked)
  getRedirectResult(auth)
    .then((result) => {
      if (result?.user) {
        currentUser = mapUser(result.user);
        emit();
      }
    })
    .catch((err) => {
      console.warn('Auth redirect result:', err?.code || err?.message, err);
      // Surface redirect failures on next UI paint via sessionStorage
      try {
        sessionStorage.setItem(
          'auth:lastError',
          friendlyAuthError(err, err?.customData?.providerId?.includes('twitter') ? 'X' : 'Auth')
        );
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

function friendlyAuthError(err, label = 'Auth') {
  const code = err?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in window was closed. Try again.';
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email via another method. Sign in with Google first, or use the same provider.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized in Firebase. Add space-impact-base.vercel.app under Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/operation-not-allowed') {
    return `${label} sign-in is not enabled. Enable Twitter in Firebase Console → Authentication → Sign-in method.`;
  }
  if (code === 'auth/configuration-not-found' || /CONFIGURATION_NOT_FOUND/i.test(err?.message || '')) {
    return 'Firebase Authentication is not fully set up. Open Authentication → Get started, enable providers.';
  }
  if (code === 'auth/invalid-api-key') return 'Invalid Firebase API key.';
  if (code === 'auth/invalid-credential' || /invalid-credential|invalid credential/i.test(err?.message || '')) {
    if (label === 'X') {
      return [
        'X rejected the login (invalid-credential).',
        'Fix: developer.x.com → your app → Keys and tokens → copy API Key + API Key Secret (Consumer keys).',
        'Paste those into Firebase → Authentication → Twitter (not Bearer / Access / OAuth2 Client).',
        'Callback must be exactly: https://spaceimpact-bb672.firebaseapp.com/__/auth/handler',
        'User auth must use OAuth 1.0a (not OAuth 2.0 only). Then Save both sides and retry.',
      ].join(' ');
    }
    return 'Invalid credential. Check provider keys in Firebase Console.';
  }
  if (code === 'auth/popup-blocked') return 'Popup blocked. Allow popups or use the redirect flow.';
  return err?.message || `${label} sign-in failed`;
}

async function signInWithProvider(provider, label, { preferRedirect = false } = {}) {
  if (!isAuthConfigured()) {
    throw new Error(
      'Sign-in is not configured. Add Firebase env vars (see README) to enable Google & X login.'
    );
  }
  if (!auth) initAuth();

  const useRedirect = preferRedirect || isMobile();

  try {
    if (useRedirect) {
      await signInWithRedirect(auth, provider);
      return snapshot(); // page navigates away
    }
    const result = await signInWithPopup(auth, provider);
    currentUser = mapUser(result.user);
    emit();
    return snapshot();
  } catch (err) {
    console.error(`${label} sign-in error:`, err?.code, err);

    // Popup blocked / cancelled → redirect fallback
    if (
      err?.code === 'auth/popup-blocked' ||
      err?.code === 'auth/cancelled-popup-request' ||
      (err?.code === 'auth/popup-closed-by-user' && isMobile())
    ) {
      await signInWithRedirect(auth, provider);
      return snapshot();
    }

    // For X invalid-credential, one retry via redirect sometimes helps if popup mangled the flow
    if (label === 'X' && err?.code === 'auth/invalid-credential' && !preferRedirect) {
      // Don't auto-redirect on bad keys — it would loop. Surface the setup error.
    }

    throw new Error(friendlyAuthError(err, label));
  }
}

/** Sign in or create account with Google */
export async function signInWithGoogle() {
  return signInWithProvider(googleProvider, 'Google');
}

/**
 * Sign in or create account with X (Twitter).
 * Uses full-page redirect — more reliable than popup for Twitter OAuth 1.0a.
 */
export async function signInWithX() {
  return signInWithProvider(makeXProvider(), 'X', { preferRedirect: true });
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

export async function linkGoogle() {
  if (!auth?.currentUser) throw new Error('Sign in first.');
  await linkWithPopup(auth.currentUser, googleProvider);
  currentUser = mapUser(auth.currentUser);
  emit();
}

export async function linkX() {
  if (!auth?.currentUser) throw new Error('Sign in first.');
  await linkWithPopup(auth.currentUser, makeXProvider());
  currentUser = mapUser(auth.currentUser);
  emit();
}

export { isAuthConfigured };
