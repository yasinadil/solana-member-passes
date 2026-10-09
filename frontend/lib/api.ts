const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type RequestOptions = {
  method?: string;
  body?: any;
  token?: string;
  timeout?: number;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeout = 30000 } = options;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    console.log(`[API] ${method} ${API_URL}${endpoint}`);
    
    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const data = await res.json();
    
    console.log(`[API] Response:`, res.status, data.success);
    
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    console.error(`[API] Error:`, error.message);
    throw error;
  }
}

// Public API
export const api = {
  // Tiers
  getTiers: () => request<{ success: boolean; data: Tier[] }>('/api/tiers'),
  getTier: (id: string) => request<{ success: boolean; data: Tier }>(`/api/tiers/${id}`),
  
  // Minting
  getMintStatus: (tierId: string) => 
    request<{ success: boolean; data: MintStatus }>(`/api/mint/status/${tierId}`),
  getMintConfig: () =>
    request<{ success: boolean; data: MintConfig }>('/api/mint/config'),
  mint: (tierId: string, walletAddress: string, paymentSignature?: string) =>
    request<{ success: boolean; data: MintResult }>('/api/mint', {
      method: 'POST',
      body: { tierId, walletAddress, paymentSignature },
    }),
  
  // Wallet check
  checkWallet: (address: string) =>
    request<{ success: boolean; data: WalletStatus }>(`/api/wallets/check/${address}`),
  
  // Token Gating (real-time blockchain verification)
  checkTokenGating: (walletAddress: string) =>
    request<{ success: boolean; data: TokenGatingResult }>(`/api/token-gating/${walletAddress}`),
  checkTierAccess: (walletAddress: string, tierName: string) =>
    request<{ success: boolean; data: TierAccessResult }>(`/api/token-gating/${walletAddress}/tier/${tierName}`),
  getWalletNFTs: (walletAddress: string) =>
    request<{ success: boolean; data: WalletNFTsResult }>(`/api/token-gating/${walletAddress}/nfts`),
};

// Admin API
export const adminApi = {
  // Auth
  login: (email: string, password: string) =>
    request<{ success: boolean; data: { token: string; user: AdminUser } }>('/api/admin/login', {
      method: 'POST',
      body: { email, password },
    }),
  getMe: (token: string) =>
    request<{ success: boolean; data: AdminUser }>('/api/admin/me', { token }),
  getStats: (token: string) =>
    request<{ success: boolean; data: DashboardStats }>('/api/admin/stats', { token }),
  
  // Tiers
  createTier: (data: CreateTierData, token: string) =>
    request<{ success: boolean; data: Tier }>('/api/tiers', {
      method: 'POST',
      body: data,
      token,
    }),
  updateTier: (id: string, data: Partial<CreateTierData>, token: string) =>
    request<{ success: boolean; data: Tier }>(`/api/tiers/${id}`, {
      method: 'PUT',
      body: data,
      token,
    }),
  deleteTier: (id: string, token: string) =>
    request<{ success: boolean }>(`/api/tiers/${id}`, {
      method: 'DELETE',
      token,
    }),
  createCollection: (tierId: string, token: string) =>
    request<{ success: boolean; data: Tier; collectionAddress: string }>(
      `/api/tiers/${tierId}/collection`,
      { method: 'POST', token }
    ),
  
  // Wallets
  getWallets: (token: string, params?: { type?: string; page?: number }) =>
    request<{ success: boolean; data: WalletEntry[]; pagination: Pagination }>(
      `/api/wallets?${new URLSearchParams(params as any)}`,
      { token }
    ),
  addWallet: (data: AddWalletData, token: string) =>
    request<{ success: boolean; data: WalletEntry }>('/api/wallets', {
      method: 'POST',
      body: data,
      token,
    }),
  removeWallet: (id: string, token: string) =>
    request<{ success: boolean }>(`/api/wallets/${id}`, {
      method: 'DELETE',
      token,
    }),
  
  // Airdrops
  getAirdrops: (token: string, params?: { tierId?: string; status?: string }) =>
    request<{ success: boolean; data: Airdrop[]; pagination: Pagination }>(
      `/api/airdrops?${new URLSearchParams(params as any)}`,
      { token }
    ),
  getAirdrop: (id: string, token: string) =>
    request<{ success: boolean; data: Airdrop }>(`/api/airdrops/${id}`, { token }),
  createAirdrop: (data: CreateAirdropData, token: string) =>
    request<{ success: boolean; data: Airdrop }>('/api/airdrops', {
      method: 'POST',
      body: data,
      token,
    }),
  executeAirdrop: (id: string, token: string) =>
    request<{ success: boolean; message: string }>(`/api/airdrops/${id}/execute`, {
      method: 'POST',
      token,
    }),
  cancelAirdrop: (id: string, token: string) =>
    request<{ success: boolean }>(`/api/airdrops/${id}`, {
      method: 'DELETE',
      token,
    }),
  
  // Admin users
  getAdminUsers: (token: string) =>
    request<{ success: boolean; data: AdminUser[] }>('/api/admin/users', { token }),
  createAdminUser: (data: CreateAdminUserData, token: string) =>
    request<{ success: boolean; data: AdminUser }>('/api/admin/users', {
      method: 'POST',
      body: data,
      token,
    }),
  
  // Exports
  exportHolders: (token: string, tierId?: string) =>
    `${API_URL}/api/export/holders${tierId ? `?tierId=${tierId}` : ''}`,
  exportHoldersSummary: (token: string) =>
    `${API_URL}/api/export/holders-summary`,
  exportTiers: (token: string) =>
    `${API_URL}/api/export/tiers`,
  exportMintActivity: (token: string) =>
    `${API_URL}/api/export/mint-activity`,
};

// Types
export interface Tier {
  id: string;
  name: string;
  description: string;
  artworkUrl: string;
  displayOrder: number;
  supplyCap: number | null;
  mintedCount: number;
  mintingOpen: boolean;
  price: number;
  collectionAddress: string | null;
  candyMachineAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MintStatus {
  id: string;
  name: string;
  supplyCap: number | null;
  mintedCount: number;
  mintingOpen: boolean;
  price: number;
  collectionAddress: string | null;
  available: number | null;
  canMint: boolean;
}


export interface MintResult {
  mintAddress: string;
  txSignature: string;
  tier: string;
  tokenNumber: number;
}

export interface MintConfig {
  treasuryWallet: string;
  network: string;
}

// Token Gating Types (real-time blockchain data)
export interface WalletNFT {
  mintAddress: string;
  name: string;
  uri: string;
  collectionAddress: string | null;
}

export interface WalletTierInfo {
  tier: string;
  tierId: string;
  count: number;
  nfts: WalletNFT[];
}

export interface TokenGatingResult {
  walletAddress: string;
  hasAccess: boolean;
  tiers: WalletTierInfo[];
  highestTier: string | null;
  totalNFTs: number;
}

export interface TierAccessResult {
  walletAddress: string;
  requiredTier: string;
  hasAccess: boolean;
  actualTier: string | null;
}

export interface WalletNFTsResult {
  walletAddress: string;
  count: number;
  nfts: WalletNFT[];
}

export interface WalletStatus {
  walletAddress: string;
  isWhitelisted: boolean;
  isBlacklisted: boolean;
  canMint: boolean;
}

export interface WalletEntry {
  id: string;
  walletAddress: string;
  type: 'WHITELIST' | 'BLACKLIST';
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Airdrop {
  id: string;
  tierId: string;
  name: string;
  description: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  executedAt: string | null;
  completedAt: string | null;
  tier?: Tier;
  recipients?: AirdropRecipient[];
}

export interface AirdropRecipient {
  id: string;
  walletAddress: string;
  quantity: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  mintAddress: string | null;
  txSignature: string | null;
  errorMessage: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface DashboardStats {
  tiers: Array<{
    id: string;
    name: string;
    supplyCap: number | null;
    mintedCount: number;
    mintingOpen: boolean;
  }>;
  totalNFTs: number;
  uniqueHolders: number;
  recentMints: Array<{
    walletAddress: string;
    tierId: string;
    mintedAt: string;
  }>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CreateTierData {
  name: string;
  description: string;
  artworkUrl: string;
  displayOrder?: number;
  supplyCap?: number | null;
  mintingOpen?: boolean;
  price?: number;
}

export interface AddWalletData {
  walletAddress: string;
  type: 'WHITELIST' | 'BLACKLIST';
  reason?: string;
  expiresAt?: string;
}

export interface CreateAirdropData {
  tierId: string;
  name: string;
  description?: string;
  recipients: Array<{ walletAddress: string; quantity: number }>;
}

export interface CreateAdminUserData {
  email: string;
  password: string;
  name: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
}

export interface CandyMachineInfo {
  address: string;
  itemsAvailable: number;
  itemsRedeemed: number;
  itemsRemaining: number;
  authority: string;
  collectionMint: string;
}

export interface CreateCandyMachineData {
  tierId: string;
  itemsAvailable: number;
  price?: number;
  startDate?: string;
  endDate?: string;
  mintLimit?: number;
}

// Candy Machine API
export const candyMachineApi = {
  getInfo: (tierId: string) =>
    request<{ success: boolean; data: CandyMachineInfo | null }>(`/api/candy-machine/${tierId}`),
  
  create: (data: CreateCandyMachineData, token: string) =>
    request<{ success: boolean; data: Tier; candyMachineAddress: string }>('/api/candy-machine', {
      method: 'POST',
      body: data,
      token,
    }),
  
  addItems: (tierId: string, items: Array<{ name: string; uri: string }>, token: string) =>
    request<{ success: boolean; message: string }>(`/api/candy-machine/${tierId}/items`, {
      method: 'POST',
      body: { items },
      token,
    }),
  
  mint: (tierId: string, walletAddress: string) =>
    request<{ success: boolean; data: { mintAddress: string; tier: string; tokenNumber: number } }>(
      `/api/candy-machine/${tierId}/mint`,
      { method: 'POST', body: { walletAddress } }
    ),
  
  close: (tierId: string, token: string) =>
    request<{ success: boolean; message: string }>(`/api/candy-machine/${tierId}/close`, {
      method: 'POST',
      token,
    }),
};

