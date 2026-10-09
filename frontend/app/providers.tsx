'use client';

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

// Context to track AppKit initialization
const AppKitContext = createContext({ initialized: false });

export function useAppKitReady() {
  return useContext(AppKitContext);
}

// Track if AppKit has been initialized
let appKitInitialized = false;
let initPromise: Promise<void> | null = null;

async function initializeAppKit() {
  if (appKitInitialized || typeof window === 'undefined') return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    // Get projectId from https://cloud.reown.com
    const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
    
    console.log('[AppKit] Initializing with projectId:', projectId ? `${projectId.slice(0, 8)}...` : 'MISSING');
    
    if (!projectId || projectId.trim() === '' || projectId === 'YOUR_PROJECT_ID') {
      console.error('[AppKit] NEXT_PUBLIC_REOWN_PROJECT_ID is not set or invalid');
      return;
    }

    // Dynamic imports to prevent SSR issues
    const [{ createAppKit }, { SolanaAdapter }] = await Promise.all([
      import('@reown/appkit/react'),
      import('@reown/appkit-adapter-solana/react'),
    ]);

    // Define Solana networks with explicit RPC URLs
    const solanaMainnet = {
      id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      chainId: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      name: 'Solana',
      currency: 'SOL',
      explorerUrl: 'https://solscan.io',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      chainNamespace: 'solana' as const,
    };

    const solanaDevnetNetwork = {
      id: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      chainId: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      name: 'Solana Devnet',
      currency: 'SOL',
      explorerUrl: 'https://solscan.io/?cluster=devnet',
      rpcUrl: 'https://api.devnet.solana.com',
      chainNamespace: 'solana' as const,
    };

    const solanaTestnetNetwork = {
      id: 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
      chainId: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
      name: 'Solana Testnet',
      currency: 'SOL',
      explorerUrl: 'https://solscan.io/?cluster=testnet',
      rpcUrl: 'https://api.testnet.solana.com',
      chainNamespace: 'solana' as const,
    };

    // Set up Solana adapter (uses built-in wallet detection)
    const solanaAdapter = new SolanaAdapter();

    // Metadata for your app
    const metadata = {
      name: 'Member Pass NFT',
      description: 'Member Pass Solana NFT Platform',
      url: window.location.origin,
      icons: ['https://example.com/icon.png'],
    };

    // Determine which network to use
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    const networks = network === 'mainnet-beta' 
      ? [solanaMainnet] 
      : network === 'testnet' 
        ? [solanaTestnetNetwork] 
        : [solanaDevnetNetwork];

    // Create AppKit instance
    createAppKit({
      adapters: [solanaAdapter],
      networks: networks as any,
      projectId,
      metadata,
      features: {
        analytics: true,
        email: false,
        socials: false,
      },
      themeMode: 'dark',
      themeVariables: {
        '--w3m-accent': '#FFD700',
        '--w3m-border-radius-master': '12px',
      },
    });
    
    appKitInitialized = true;
  })();
  
  return initPromise;
}

export function Providers({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initializeAppKit().then(() => setInitialized(true));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppKitContext.Provider value={{ initialized }}>
        {children}
      </AppKitContext.Provider>
      <Toaster />
    </QueryClientProvider>
  );
}
