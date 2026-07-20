# SPACE IMPACT // NEON GENESIS — Base

Modernized **Space Impact** (Nokia classic) arcade shooter themed after neon “Genesis” style, built for **Base chain**.

- Side-scrolling shoot-’em-up with neon FX, screen shake, combos, power-ups, and bosses  
- **Connect any EIP-1193 wallet** that supports Base (MetaMask, Coinbase Wallet, Rabby, Brave, etc.)  
- **Mint a Level Badge NFT** after each sector clear  

Inspired by: [space-impact-game-base.gitlawb.app](https://space-impact-game-base.gitlawb.app/)

## Quick start

```bash
cd space-impact-base
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

### Play

| Control | Action |
|--------|--------|
| WASD / Arrows | Move |
| Space / hold click | Fire |
| Shift | Boost |
| P | Pause |
| Touch | Drag ship + hold to fire |

## Wallet + Base

1. Click **Connect Wallet**.  
2. Choose **Browser Wallet** (MetaMask, Coinbase, Rabby…) or **WalletConnect QR** for mobile.  
3. Approve connection and switch to **Base** (or **Base Sepolia** if configured).  
4. Clear a level → **Mint Badge** on the level-clear screen.

### WalletConnect (mobile QR)

1. Create a free project at [cloud.reown.com](https://cloud.reown.com).  
2. Copy the Project ID into `.env`:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

3. Restart `npm run dev`, then use **WalletConnect QR**.

Without a deployed NFT contract the game still runs and uses **demo local claims**.

## Sign in (Google)

Social login uses **Firebase Auth** (Google only). First login creates the account (no password).

1. Create a project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Authentication** → **Sign-in method** → **Google**.
3. Project settings → Your apps → Web app → copy config into `.env` / Vercel:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

4. **Authorized domains**: add `localhost` and `space-impact-base.vercel.app` (Authentication → Settings).
5. Redeploy Vercel after setting env vars.

High scores are stored **per signed-in user** in the browser.

## Audio

Procedural **neon synthwave BGM** + arcade **SFX** (Web Audio — no asset files).

- **♪** toggle music · **FX** toggle sound effects  
- Music starts when you press Engage Thrusters (browser autoplay policy)

## Deploy Level Badge NFT

```bash
npm run compile

# Base Sepolia testnet
set PRIVATE_KEY=0xYOUR_KEY
npm run deploy:base-sepolia

# Base mainnet
set PRIVATE_KEY=0xYOUR_KEY
npm run deploy:base
```

Deploy writes `.env`:

```
VITE_NFT_ADDRESS=0x...
VITE_CHAIN_ID=84532
```

Restart `npm run dev` after deploy.

### Env vars

| Variable | Description |
|----------|-------------|
| `VITE_CHAIN_ID` | `8453` Base mainnet (default) or `84532` Base Sepolia |
| `VITE_NFT_ADDRESS` | Deployed `LevelBadgeNFT` address |
| `PRIVATE_KEY` | Deployer key (scripts only, never commit) |
| `RPC_URL` | Optional custom RPC |

## Stack

- Vite + Canvas game loop  
- [viem](https://viem.sh) + [WalletConnect Ethereum Provider](https://docs.walletconnect.com/) for Base  
- Procedural Web Audio (synthwave BGM + SFX)  
- Multi-phase bosses (dash, minions, spiral, enrage)  
- Solidity `LevelBadgeNFT` (ERC-721 style, on-chain SVG metadata)

## Production notes

`mintLevelBadge(level, score)` is intentionally open for arcade demos (one mint per wallet per level). For a competitive release, gate mints with a backend signature or on-chain game verification.

## Build

```bash
npm run build
npm run preview
```
