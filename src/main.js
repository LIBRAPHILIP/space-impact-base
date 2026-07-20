import { Game } from './game/Game.js';
import { wallet } from './wallet/connect.js';
import {
  mintLevelBadge,
  hasMintedLevel,
  getBadgeCount,
  isContractConfigured,
} from './wallet/mint.js';
import { ACTIVE_CHAIN, NFT_CONTRACT_ADDRESS, shortAddress, WC_PROJECT_ID } from './wallet/config.js';
import { audio } from './audio/AudioEngine.js';
import { loadMeta, saveMeta, recordRun, DIFFICULTY, setStorageUser } from './game/storage.js';
import {
  initAuth,
  onAuthChange,
  signInWithGoogle,
  signOut,
  isAuthConfigured,
  consumeLastAuthError,
} from './auth/auth.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const overlay = $('overlay');
const menuCard = $('menu-card');
const pauseCard = $('pause-card');
const levelCard = $('level-card');
const gameoverCard = $('gameover-card');
const controlsCard = $('controls-card');
const walletCard = $('wallet-card');
const authCard = $('auth-card');

let pendingLevelClear = null;
let bannerEl = null;
let returnToCard = menuCard;
let meta = loadMeta();
let authSnap = { configured: false, user: null, signedIn: false };

function showCard(card) {
  for (const c of [menuCard, pauseCard, levelCard, gameoverCard, controlsCard, walletCard, authCard]) {
    c.classList.add('hidden');
  }
  if (card) card.classList.remove('hidden');
}

function setOverlay(visible, card = null) {
  if (visible) {
    overlay.classList.remove('playing');
    showCard(card || menuCard);
  } else {
    overlay.classList.add('playing');
    showCard(null);
  }
}

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText =
      'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);z-index:100;padding:0.75rem 1.1rem;border-radius:12px;background:rgba(8,12,28,0.92);border:1px solid rgba(0,240,255,0.35);color:#e8f7ff;font-family:Orbitron,sans-serif;font-size:0.72rem;letter-spacing:0.08em;box-shadow:0 0 24px rgba(0,240,255,0.2);max-width:90vw;text-align:center;transition:opacity 0.3s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.style.opacity = '0';
  }, 3600);
}

function showBanner(text) {
  if (!bannerEl) {
    bannerEl = document.createElement('div');
    bannerEl.style.cssText =
      'position:absolute;top:16%;left:50%;transform:translateX(-50%);z-index:6;pointer-events:none;font-family:Orbitron,sans-serif;font-size:1.05rem;letter-spacing:0.18em;color:#ff2bd6;text-shadow:0 0 20px rgba(255,43,214,0.6);transition:opacity 0.4s;white-space:nowrap;';
    canvas.parentElement.appendChild(bannerEl);
  }
  bannerEl.textContent = text;
  bannerEl.style.opacity = '1';
  clearTimeout(bannerEl._t);
  bannerEl._t = setTimeout(() => {
    bannerEl.style.opacity = '0';
  }, 1600);
}

function refreshRecords() {
  meta = loadMeta();
  $('rec-score').textContent = (meta.highScore || 0).toLocaleString();
  $('rec-level').textContent = String(meta.bestLevel || 1);
  $('rec-combo').textContent = `x${meta.bestCombo || 1}`;
}

function updateAuthUI(snap) {
  authSnap = snap;
  const signinBtn = $('signin-btn');
  const userInfo = $('user-info');
  const greeting = $('pilot-greeting');
  const authStatus = $('auth-status');

  if (snap.signedIn && snap.user) {
    setStorageUser(snap.user.uid);
    meta = loadMeta();
    refreshRecords();
    setDifficulty(meta.difficulty || 'pilot');

    signinBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    $('user-name').textContent = snap.user.displayName;
    $('user-providers').textContent = snap.user.isGoogle ? 'Google' : 'Pilot';
    const av = $('user-avatar');
    if (snap.user.photoURL) {
      av.src = snap.user.photoURL;
      av.classList.remove('hidden');
    } else {
      av.removeAttribute('src');
      av.classList.add('hidden');
    }

    greeting.classList.remove('hidden');
    greeting.innerHTML = snap.user.photoURL
      ? `<img src="${snap.user.photoURL}" alt="" /><span>WELCOME, ${escapeHtml(snap.user.displayName).toUpperCase()}</span>`
      : `<span>WELCOME, ${escapeHtml(snap.user.displayName).toUpperCase()}</span>`;
  } else {
    setStorageUser(null);
    meta = loadMeta();
    refreshRecords();

    signinBtn.classList.remove('hidden');
    userInfo.classList.add('hidden');
    greeting.classList.add('hidden');
    greeting.textContent = '';
  }

  if (authStatus) {
    if (!snap.configured) {
      authStatus.textContent = 'Auth not configured yet. Add Firebase env vars — see README.';
    } else if (snap.signedIn) {
      authStatus.textContent = `Signed in as ${snap.user.displayName}.`;
    } else {
      authStatus.textContent = 'Secure OAuth via Firebase Auth · Google.';
    }
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openAuthModal() {
  returnToCard = !menuCard.classList.contains('hidden')
    ? menuCard
    : !levelCard.classList.contains('hidden')
      ? levelCard
      : menuCard;
  setOverlay(true, authCard);
  const ready = isAuthConfigured();
  $('auth-google').disabled = !ready;
  if (!ready) {
    $('auth-status').textContent =
      'Add VITE_FIREBASE_* env vars and enable Google in Firebase Console.';
  }
}

async function handleGoogleAuth() {
  const status = $('auth-status');
  const gBtn = $('auth-google');
  gBtn.disabled = true;
  status.textContent = 'Opening Google…';
  try {
    const result = await signInWithGoogle();
    if (result?.signedIn && result.user) {
      toast(`Signed in as ${result.user.displayName}`);
      status.textContent = `Welcome, ${result.user.displayName}`;
      showCard(returnToCard || menuCard);
    } else {
      status.textContent = 'Redirecting to sign-in…';
    }
  } catch (e) {
    console.error(e);
    status.textContent = e.message || 'Sign-in failed';
    toast(e.message || 'Sign-in failed');
  } finally {
    gBtn.disabled = !isAuthConfigured();
  }
}

function setDifficulty(id) {
  if (!DIFFICULTY[id]) return;
  meta = saveMeta({ difficulty: id });
  document.querySelectorAll('.diff-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.diff === id);
  });
  $('diff-desc').textContent = DIFFICULTY[id].desc;
  game.setOptions({ difficulty: id, autoFire: $('auto-fire').checked });
}

function updateHud(h) {
  if (!h) return;
  $('hud-score').textContent = h.score.toLocaleString();
  $('hud-level').textContent = String(h.level);
  $('hud-lives').textContent = '■'.repeat(Math.max(0, h.lives)) || '—';
  $('hud-shield').style.width = `${Math.round((h.shield || 0) * 100)}%`;
  $('hud-weapon').textContent = h.overdrive ? `${h.weapon}★` : h.weapon;
  $('hud-wave').textContent = `${h.wave} / ${h.waves}`;
  $('hud-kills').textContent = String(h.kills);
  $('hud-combo').textContent = `x${h.combo}`;
  $('hud-bombs').textContent = '◆'.repeat(Math.max(0, h.bombs)) || '—';
  $('hud-diff').textContent = h.difficulty || 'PILOT';
  $('hud-combo').style.color = h.combo >= 8 ? '#ff2bd6' : h.combo >= 4 ? '#ff8a3d' : '';
}

function updateWalletUI(snap) {
  const connectBtn = $('connect-btn');
  const info = $('wallet-info');
  const addr = $('wallet-address');
  const mode = $('wallet-mode');
  const badge = $('network-badge');
  const hint = $('wallet-hint');

  if (snap.connected) {
    connectBtn.classList.add('hidden');
    info.classList.remove('hidden');
    addr.textContent = snap.short;
    mode.textContent = snap.mode === 'walletconnect' ? 'WC' : 'EXT';
    badge.textContent = snap.onBase ? snap.chainLabel.toUpperCase() : 'WRONG NETWORK';
    badge.classList.toggle('online', snap.onBase);
    badge.classList.toggle('wrong', !snap.onBase);
    badge.classList.remove('offline');
    hint.textContent = snap.onBase
      ? `Connected on ${snap.chainLabel}${snap.mode === 'walletconnect' ? ' via WalletConnect' : ''}.`
      : `Connected — switch to ${snap.chainLabel} to mint.`;
    refreshBadges();
  } else {
    connectBtn.classList.remove('hidden');
    info.classList.add('hidden');
    badge.textContent = 'BASE';
    badge.classList.remove('online', 'wrong');
    badge.classList.add('offline');
    hint.textContent = 'Connect a wallet on Base (browser or WalletConnect QR) to mint level NFTs.';
    $('hud-badges').textContent = '—';
  }
}

async function refreshBadges() {
  try {
    $('hud-badges').textContent = String(await getBadgeCount());
  } catch {
    $('hud-badges').textContent = '—';
  }
}

function updateContractStatus() {
  const el = $('contract-status');
  const parts = [];
  if (isContractConfigured()) parts.push(`NFT: ${shortAddress(NFT_CONTRACT_ADDRESS)}`);
  else parts.push('NFT: demo mode');
  parts.push(WC_PROJECT_ID ? 'WalletConnect: ready' : 'WC: set project id');
  parts.push(isAuthConfigured() ? 'Auth: Google' : 'Auth: configure Firebase');
  el.textContent = parts.join(' · ');
}

function openWalletModal() {
  returnToCard = !menuCard.classList.contains('hidden')
    ? menuCard
    : !levelCard.classList.contains('hidden')
      ? levelCard
      : menuCard;
  setOverlay(true, walletCard);
  const wcBtn = $('connect-wc');
  const wcHint = $('wc-hint');
  if (!WC_PROJECT_ID) {
    wcBtn.disabled = true;
    wcHint.textContent = 'Set VITE_WALLETCONNECT_PROJECT_ID for QR connect.';
  } else {
    wcBtn.disabled = false;
    wcHint.textContent = 'Scan with Coinbase Wallet, MetaMask Mobile, Rainbow, etc.';
  }
  const inj = $('connect-injected');
  const snap = wallet.snapshot();
  inj.disabled = !snap.hasInjected;
}

async function prepareMintUI(clear) {
  pendingLevelClear = clear;
  $('level-title').textContent = `LEVEL ${clear.level} COMPLETE`;
  $('level-score').textContent = `${clear.name} · Score ${clear.score.toLocaleString()} · ${clear.kills} kills`;
  $('level-stats').textContent = `Max combo x${clear.maxCombo || 1} · Accuracy ${clear.accuracy || 0}%`;
  $('mint-art').textContent = `L${clear.level}`;
  const mintBtn = $('mint-btn');
  const status = $('mint-status');

  recordRun({ score: clear.score, level: clear.level, maxCombo: clear.maxCombo });
  refreshRecords();

  const snap = wallet.snapshot();
  if (!snap.connected) {
    mintBtn.disabled = false;
    mintBtn.textContent = 'Connect Wallet to Mint';
    status.textContent = 'Connect a browser wallet or scan WalletConnect QR.';
    mintBtn.onclick = () => openWalletModal();
    return;
  }
  if (!snap.onBase) {
    mintBtn.disabled = false;
    mintBtn.textContent = `Switch to ${ACTIVE_CHAIN.label}`;
    status.textContent = 'Wrong network — switch to Base, then mint.';
    mintBtn.onclick = async () => {
      try {
        await wallet.switchToBase();
        await prepareMintUI(clear);
      } catch (e) {
        toast(e.message || 'Network switch failed');
      }
    };
    return;
  }

  const already = await hasMintedLevel(clear.level);
  if (already) {
    mintBtn.disabled = true;
    mintBtn.textContent = 'Already Minted';
    status.textContent = 'This level badge is already claimed.';
    mintBtn.onclick = null;
    return;
  }

  mintBtn.disabled = false;
  mintBtn.textContent = isContractConfigured() ? 'Mint Badge on Base' : 'Claim Demo Badge';
  status.textContent = isContractConfigured()
    ? `Mint "${clear.badgeName}" on ${ACTIVE_CHAIN.label}.`
    : 'Demo claim (local) until NFT contract is deployed.';
  mintBtn.onclick = () => doMint(clear);
}

async function doMint(clear) {
  const mintBtn = $('mint-btn');
  const status = $('mint-status');
  mintBtn.disabled = true;
  mintBtn.textContent = 'Minting…';
  status.textContent = 'Confirm in your wallet…';
  try {
    const result = await mintLevelBadge(clear.level, clear.score);
    status.textContent = result.message;
    mintBtn.textContent = result.mode === 'onchain' ? 'Minted ✓' : 'Claimed ✓';
    if (result.explorer) {
      status.innerHTML = `${result.message} <a href="${result.explorer}" target="_blank" rel="noopener" style="color:#00f0ff">View tx</a>`;
    }
    toast(result.message);
    audio.play('powerup');
    await refreshBadges();
  } catch (e) {
    console.error(e);
    status.textContent = e.shortMessage || e.message || 'Mint failed';
    mintBtn.disabled = false;
    mintBtn.textContent = 'Retry Mint';
    toast(e.shortMessage || e.message || 'Mint failed');
  }
}

const game = new Game(canvas, {
  onState(state) {
    if (state === 'playing') {
      setOverlay(false);
      audio.startBgm();
      audio.resumeBgm();
    } else if (state === 'paused') {
      setOverlay(true, pauseCard);
      audio.pauseBgm();
    } else if (state === 'levelclear') {
      setOverlay(true, levelCard);
      audio.pauseBgm();
    } else if (state === 'gameover') {
      setOverlay(true, gameoverCard);
      audio.stopBgm();
    } else if (state === 'menu') {
      setOverlay(true, menuCard);
      audio.stopBgm();
      refreshRecords();
    }
  },
  onHud: updateHud,
  onBanner: showBanner,
  onSfx: (name) => audio.play(name),
  onMusicIntensity: (n) => audio.setIntensity(n),
  onLevelClear: (clear) => prepareMintUI(clear),
  onGameOver({ score, level, kills, maxCombo, accuracy, time }) {
    recordRun({ score, level, maxCombo });
    refreshRecords();
    $('final-score').textContent = `Score ${score.toLocaleString()} · Sector ${level} · ${kills} kills`;
    $('final-stats').textContent = `Max combo x${maxCombo} · Accuracy ${accuracy}% · Time ${time}s`;
  },
});

async function unlockAudio() {
  await audio.unlock();
}

function applyOptionsAndStart(level = 1) {
  game.setOptions({
    difficulty: meta.difficulty || 'pilot',
    autoFire: $('auto-fire').checked,
  });
  saveMeta({ autoFire: $('auto-fire').checked });
  game.start(level);
}

// Difficulty UI
document.querySelectorAll('.diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.play('ui');
    setDifficulty(btn.dataset.diff);
  });
});
setDifficulty(meta.difficulty || 'pilot');
$('auto-fire').checked = meta.autoFire !== false;
$('auto-fire').addEventListener('change', () => {
  saveMeta({ autoFire: $('auto-fire').checked });
  game.setOptions({ autoFire: $('auto-fire').checked });
});

// Touch controls
const touch = $('touch-controls');
function bindTouch(el, on, off) {
  const start = (e) => {
    e.preventDefault();
    el.classList.add('active');
    on();
  };
  const end = (e) => {
    e.preventDefault();
    el.classList.remove('active');
    off();
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointerleave', end);
  el.addEventListener('pointercancel', end);
}

touch.querySelectorAll('[data-dir]').forEach((btn) => {
  const dir = btn.dataset.dir;
  bindTouch(
    btn,
    () => {
      game.input[dir] = true;
    },
    () => {
      game.input[dir] = false;
    }
  );
});
touch.querySelectorAll('[data-act]').forEach((btn) => {
  const act = btn.dataset.act;
  bindTouch(
    btn,
    () => {
      game.input[act] = true;
    },
    () => {
      game.input[act] = false;
      if (act === 'bomb') game._bombPressed = false;
    }
  );
});

// Buttons
$('start-btn').addEventListener('click', async () => {
  audio.play('ui');
  await unlockAudio();
  applyOptionsAndStart(1);
});
$('how-btn').addEventListener('click', () => {
  audio.play('ui');
  showCard(controlsCard);
});
$('controls-back').addEventListener('click', () => {
  audio.play('ui');
  showCard(menuCard);
});
$('resume-btn').addEventListener('click', async () => {
  await unlockAudio();
  audio.play('ui');
  game.resume();
});
$('next-btn').addEventListener('click', async () => {
  await unlockAudio();
  audio.play('ui');
  applyOptionsAndStart((pendingLevelClear?.level || game.level) + 1);
});
$('retry-btn').addEventListener('click', async () => {
  await unlockAudio();
  audio.play('ui');
  applyOptionsAndStart(1);
});
$('menu-btn').addEventListener('click', () => {
  audio.play('ui');
  game.goMenu();
  setOverlay(true, menuCard);
});

$('connect-btn').addEventListener('click', () => {
  audio.play('ui');
  openWalletModal();
});
$('wallet-back').addEventListener('click', () => {
  audio.play('ui');
  showCard(returnToCard || menuCard);
});

$('signin-btn').addEventListener('click', () => {
  audio.play('ui');
  openAuthModal();
});
$('auth-back').addEventListener('click', () => {
  audio.play('ui');
  showCard(returnToCard || menuCard);
});
$('auth-google').addEventListener('click', async () => {
  audio.play('ui');
  await handleGoogleAuth();
});
$('signout-btn').addEventListener('click', async () => {
  audio.play('ui');
  try {
    await signOut();
    toast('Signed out');
  } catch (e) {
    toast(e.message || 'Sign out failed');
  }
});
$('connect-injected').addEventListener('click', async () => {
  audio.play('ui');
  try {
    await wallet.connect('injected');
    toast(`Connected · ${ACTIVE_CHAIN.label}`);
    if (pendingLevelClear && !levelCard.classList.contains('hidden')) await prepareMintUI(pendingLevelClear);
    else showCard(returnToCard || menuCard);
  } catch (e) {
    toast(e.message || 'Wallet connection failed');
  }
});
$('connect-wc').addEventListener('click', async () => {
  audio.play('ui');
  try {
    toast('Opening WalletConnect QR…');
    await wallet.connect('walletconnect');
    toast(`Connected via WalletConnect · ${ACTIVE_CHAIN.label}`);
    if (pendingLevelClear && game.state === 'levelclear') {
      setOverlay(true, levelCard);
      await prepareMintUI(pendingLevelClear);
    } else showCard(returnToCard || menuCard);
  } catch (e) {
    toast(e.message || 'WalletConnect failed');
  }
});
$('disconnect-btn').addEventListener('click', async () => {
  audio.play('ui');
  await wallet.disconnect();
  toast('Wallet disconnected');
});

let musicOn = true;
let sfxOn = true;
$('btn-music').addEventListener('click', async () => {
  await unlockAudio();
  musicOn = !musicOn;
  audio.setMusic(musicOn);
  $('btn-music').classList.toggle('active', musicOn);
  if (musicOn && game.state === 'playing') audio.startBgm();
});
$('btn-sfx').addEventListener('click', async () => {
  await unlockAudio();
  sfxOn = !sfxOn;
  audio.setSfx(sfxOn);
  $('btn-sfx').classList.toggle('active', sfxOn);
  if (sfxOn) audio.play('ui');
});

wallet.onChange((snap) => {
  updateWalletUI(snap);
  if (snap.connected && pendingLevelClear && game.state === 'levelclear') prepareMintUI(pendingLevelClear);
});
updateWalletUI(wallet.snapshot());
updateContractStatus();
refreshRecords();

initAuth();
onAuthChange(updateAuthUI);

// Show Google redirect errors after return to the page
const redirectAuthErr = consumeLastAuthError();
if (redirectAuthErr) {
  toast(redirectAuthErr);
  setOverlay(true, authCard);
  const status = $('auth-status');
  if (status) status.textContent = redirectAuthErr;
}

game._draw();
