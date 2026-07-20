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

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const overlay = $('overlay');
const menuCard = $('menu-card');
const pauseCard = $('pause-card');
const levelCard = $('level-card');
const gameoverCard = $('gameover-card');
const controlsCard = $('controls-card');
const walletCard = $('wallet-card');

let pendingLevelClear = null;
let bannerEl = null;
let returnToCard = menuCard;

function showCard(card) {
  for (const c of [menuCard, pauseCard, levelCard, gameoverCard, controlsCard, walletCard]) {
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
      'position:absolute;top:18%;left:50%;transform:translateX(-50%);z-index:6;pointer-events:none;font-family:Orbitron,sans-serif;font-size:1.1rem;letter-spacing:0.2em;color:#ff2bd6;text-shadow:0 0 20px rgba(255,43,214,0.6);transition:opacity 0.4s;white-space:nowrap;';
    canvas.parentElement.appendChild(bannerEl);
  }
  bannerEl.textContent = text;
  bannerEl.style.opacity = '1';
  clearTimeout(bannerEl._t);
  bannerEl._t = setTimeout(() => {
    bannerEl.style.opacity = '0';
  }, 1600);
}

function updateHud(h) {
  if (!h) return;
  $('hud-score').textContent = h.score.toLocaleString();
  $('hud-level').textContent = String(h.level);
  $('hud-lives').textContent = '■'.repeat(Math.max(0, h.lives)) || '—';
  $('hud-shield').style.width = `${Math.round((h.shield || 0) * 100)}%`;
  $('hud-weapon').textContent = h.weapon;
  $('hud-wave').textContent = `${h.wave} / ${h.waves}`;
  $('hud-kills').textContent = String(h.kills);
  $('hud-combo').textContent = `x${h.combo}`;
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
      ? `Connected on ${snap.chainLabel}${snap.mode === 'walletconnect' ? ' via WalletConnect' : ''}. Clear sectors to mint.`
      : `Connected, but switch to ${snap.chainLabel} to mint.`;
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
    const n = await getBadgeCount();
    $('hud-badges').textContent = String(n);
  } catch {
    $('hud-badges').textContent = '—';
  }
}

function updateContractStatus() {
  const el = $('contract-status');
  const parts = [];
  if (isContractConfigured()) {
    parts.push(`NFT: ${shortAddress(NFT_CONTRACT_ADDRESS)} · ${ACTIVE_CHAIN.label}`);
  } else {
    parts.push('NFT: demo mode');
  }
  parts.push(WC_PROJECT_ID ? 'WalletConnect: ready' : 'WalletConnect: set VITE_WALLETCONNECT_PROJECT_ID');
  el.textContent = parts.join(' · ');
}

function openWalletModal() {
  returnToCard =
    !menuCard.classList.contains('hidden')
      ? menuCard
      : !pauseCard.classList.contains('hidden')
        ? pauseCard
        : !levelCard.classList.contains('hidden')
          ? levelCard
          : menuCard;
  setOverlay(true, walletCard);
  const wcBtn = $('connect-wc');
  const wcHint = $('wc-hint');
  if (!WC_PROJECT_ID) {
    wcBtn.disabled = true;
    wcHint.textContent =
      'WalletConnect QR needs VITE_WALLETCONNECT_PROJECT_ID in .env (free at cloud.reown.com).';
  } else {
    wcBtn.disabled = false;
    wcHint.textContent = 'Scan the QR with Coinbase Wallet, MetaMask Mobile, Rainbow, etc.';
  }
  const inj = $('connect-injected');
  const snap = wallet.snapshot();
  inj.disabled = !snap.hasInjected;
  if (!snap.hasInjected) {
    inj.querySelector('.opt-sub').textContent = 'No extension detected — use QR below';
  }
}

async function prepareMintUI(clear) {
  pendingLevelClear = clear;
  $('level-title').textContent = `LEVEL ${clear.level} COMPLETE`;
  $('level-score').textContent = `${clear.name} · Score ${clear.score.toLocaleString()} · ${clear.kills} kills`;
  $('mint-art').textContent = `L${clear.level}`;
  const mintBtn = $('mint-btn');
  const status = $('mint-status');

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
    status.textContent = isContractConfigured()
      ? 'This level badge is already in your wallet.'
      : 'Already claimed in demo mode.';
    mintBtn.onclick = null;
    return;
  }

  mintBtn.disabled = false;
  mintBtn.textContent = isContractConfigured() ? 'Mint Badge on Base' : 'Claim Demo Badge';
  status.textContent = isContractConfigured()
    ? `Mint "${clear.badgeName}" NFT on ${ACTIVE_CHAIN.label}.`
    : 'Contract not set — claim is stored locally until you deploy.';
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
    }
  },
  onHud: updateHud,
  onBanner: showBanner,
  onSfx(name) {
    audio.play(name);
  },
  onLevelClear(clear) {
    prepareMintUI(clear);
  },
  onGameOver({ score, level, kills }) {
    $('final-score').textContent = `Score ${score.toLocaleString()} · Reached sector ${level} · ${kills} kills`;
  },
});

async function unlockAudio() {
  await audio.unlock();
}

// UI wiring
$('start-btn').addEventListener('click', async () => {
  audio.play('ui');
  await unlockAudio();
  game.start(1);
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
  const next = (pendingLevelClear?.level || game.level) + 1;
  game.start(next);
});
$('retry-btn').addEventListener('click', async () => {
  await unlockAudio();
  audio.play('ui');
  game.start(1);
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

$('connect-injected').addEventListener('click', async () => {
  audio.play('ui');
  try {
    await wallet.connect('injected');
    toast(`Connected · ${ACTIVE_CHAIN.label}`);
    if (pendingLevelClear && !levelCard.classList.contains('hidden')) {
      await prepareMintUI(pendingLevelClear);
    } else {
      showCard(returnToCard || menuCard);
    }
  } catch (e) {
    console.error(e);
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
    } else {
      showCard(returnToCard || menuCard);
    }
  } catch (e) {
    console.error(e);
    toast(e.message || 'WalletConnect failed');
  }
});

$('disconnect-btn').addEventListener('click', async () => {
  audio.play('ui');
  await wallet.disconnect();
  toast('Wallet disconnected');
});

// Audio toggles
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
  if (snap.connected && pendingLevelClear && game.state === 'levelclear') {
    prepareMintUI(pendingLevelClear);
  }
});
updateWalletUI(wallet.snapshot());
updateContractStatus();

// Draw idle frame on menu
game._draw();
