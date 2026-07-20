import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  getAddress,
} from 'viem';
import { ACTIVE_CHAIN, TARGET_CHAIN_ID, shortAddress, WC_PROJECT_ID } from './config.js';

/**
 * Wallet layer:
 * - Injected EIP-1193 (MetaMask, Coinbase, Rabby, Brave…)
 * - WalletConnect v2 QR modal for mobile wallets
 */
export class WalletManager {
  constructor() {
    this.address = null;
    this.chainId = null;
    this.walletClient = null;
    this.publicClient = null;
    this.provider = null;
    this.wcProvider = null;
    this.mode = null; // 'injected' | 'walletconnect'
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }

  snapshot() {
    return {
      address: this.address,
      short: shortAddress(this.address),
      chainId: this.chainId,
      onBase: this.chainId === TARGET_CHAIN_ID,
      connected: Boolean(this.address),
      chainLabel: ACTIVE_CHAIN.label,
      mode: this.mode,
      hasInjected: Boolean(this._getProvider()),
      wcReady: Boolean(WC_PROJECT_ID),
    };
  }

  _getProvider() {
    if (typeof window === 'undefined') return null;
    const eth = window.ethereum;
    if (!eth) return null;
    if (eth.providers?.length) {
      return (
        eth.providers.find((p) => p.isCoinbaseWallet) ||
        eth.providers.find((p) => p.isMetaMask) ||
        eth.providers[0]
      );
    }
    return eth;
  }

  async connect(preferred = 'auto') {
    if (preferred === 'walletconnect') {
      return this.connectWalletConnect();
    }
    if (preferred === 'injected') {
      return this.connectInjected();
    }
    // auto: injected first, else WalletConnect
    if (this._getProvider()) {
      return this.connectInjected();
    }
    return this.connectWalletConnect();
  }

  async connectInjected() {
    const provider = this._getProvider();
    if (!provider) {
      throw new Error(
        'No browser wallet found. Use WalletConnect QR for mobile, or install MetaMask / Coinbase Wallet.'
      );
    }
    await this._bindProvider(provider, 'injected');
    if (this.chainId !== TARGET_CHAIN_ID) {
      await this.switchToBase();
    }
    return this.snapshot();
  }

  async connectWalletConnect() {
    if (!WC_PROJECT_ID) {
      throw new Error(
        'WalletConnect Project ID missing. Set VITE_WALLETCONNECT_PROJECT_ID in .env (free at https://cloud.reown.com).'
      );
    }

    // Dynamic import keeps initial bundle lighter when not used
    const { default: EthereumProvider } = await import('@walletconnect/ethereum-provider');

    if (this.wcProvider) {
      try {
        await this.wcProvider.disconnect();
      } catch {
        /* ignore */
      }
      this.wcProvider = null;
    }

    const rpcMap = {
      [TARGET_CHAIN_ID]: ACTIVE_CHAIN.rpcUrls.default.http[0],
    };

    const provider = await EthereumProvider.init({
      projectId: WC_PROJECT_ID,
      optionalChains: [TARGET_CHAIN_ID],
      chains: [TARGET_CHAIN_ID],
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'dark',
        themeVariables: {
          '--wcm-z-index': '10000',
          '--wcm-accent-color': '#00f0ff',
          '--wcm-background-color': '#05060f',
        },
      },
      metadata: {
        name: 'Space Impact Neon Genesis',
        description: 'Arcade shooter on Base — mint level badge NFTs',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://base.org',
        icons: ['https://avatars.githubusercontent.com/u/166535711?s=200&v=4'],
      },
      rpcMap,
    });

    this.wcProvider = provider;
    await provider.connect();
    await this._bindProvider(provider, 'walletconnect');
    return this.snapshot();
  }

  async _bindProvider(provider, mode) {
    this.provider = provider;
    this.mode = mode;

    const accounts = await provider.request({ method: 'eth_requestAccounts' }).catch(async () => {
      // WalletConnect may already have accounts after connect()
      const acc = provider.accounts || [];
      return acc;
    });

    const list = accounts?.length ? accounts : provider.accounts || [];
    if (!list?.length) throw new Error('No account returned from wallet.');

    this.address = getAddress(list[0]);
    let chainHex;
    try {
      chainHex = await provider.request({ method: 'eth_chainId' });
    } catch {
      chainHex = provider.chainId ? `0x${Number(provider.chainId).toString(16)}` : `0x${TARGET_CHAIN_ID.toString(16)}`;
    }
    this.chainId = Number(chainHex);

    this.walletClient = createWalletClient({
      account: this.address,
      chain: ACTIVE_CHAIN,
      transport: custom(provider),
    });
    this.publicClient = createPublicClient({
      chain: ACTIVE_CHAIN,
      transport: custom(provider),
    });

    this._attachProviderEvents();
    this._emit();
  }

  async switchToBase() {
    if (!this.provider) throw new Error('Wallet not connected');
    const chainIdHex = `0x${TARGET_CHAIN_ID.toString(16)}`;
    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (err) {
      if (err?.code === 4902 || err?.code === -32603 || /unrecognized chain/i.test(err?.message || '')) {
        await this.provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName: ACTIVE_CHAIN.name,
              nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
              rpcUrls: ACTIVE_CHAIN.rpcUrls.default.http,
              blockExplorerUrls: ACTIVE_CHAIN.blockExplorers
                ? [ACTIVE_CHAIN.blockExplorers.default.url]
                : [],
            },
          ],
        });
      } else {
        throw err;
      }
    }
    const chainHex = await this.provider.request({ method: 'eth_chainId' });
    this.chainId = Number(chainHex);
    this._emit();
  }

  _attachProviderEvents() {
    if (!this.provider || this._eventsBound) return;
    this._eventsBound = true;

    const onAccounts = (accounts) => {
      if (!accounts?.length) {
        this.disconnect();
        return;
      }
      this.address = getAddress(accounts[0]);
      if (this.walletClient) {
        this.walletClient = createWalletClient({
          account: this.address,
          chain: ACTIVE_CHAIN,
          transport: custom(this.provider),
        });
      }
      this._emit();
    };

    const onChain = (chainHex) => {
      this.chainId = Number(chainHex);
      this._emit();
    };

    const onDisconnect = () => this.disconnect();

    this.provider.on?.('accountsChanged', onAccounts);
    this.provider.on?.('chainChanged', onChain);
    this.provider.on?.('disconnect', onDisconnect);
    this.provider.on?.('session_delete', onDisconnect);
  }

  async disconnect() {
    if (this.wcProvider) {
      try {
        await this.wcProvider.disconnect();
      } catch {
        /* ignore */
      }
      this.wcProvider = null;
    }
    this.address = null;
    this.chainId = null;
    this.walletClient = null;
    this.publicClient = null;
    this.provider = null;
    this.mode = null;
    this._eventsBound = false;
    this._emit();
  }

  getPublicClient() {
    if (this.publicClient) return this.publicClient;
    return createPublicClient({
      chain: ACTIVE_CHAIN,
      transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
    });
  }
}

export const wallet = new WalletManager();
