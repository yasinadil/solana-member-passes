import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

// Use service role key for backend operations (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database types
export interface Tier {
  id: string;
  name: string;
  description: string;
  artwork_url: string;
  display_order: number;
  supply_cap: number | null;
  minted_count: number;
  minting_open: boolean;
  price: number;
  collection_address: string | null;
  candy_machine_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletEntry {
  id: string;
  wallet_address: string;
  type: 'WHITELIST' | 'BLACKLIST';
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Airdrop {
  id: string;
  tier_id: string;
  name: string;
  description: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  total_recipients: number;
  success_count: number;
  failed_count: number;
  created_at: string;
  executed_at: string | null;
  completed_at: string | null;
}

export interface AirdropRecipient {
  id: string;
  airdrop_id: string;
  wallet_address: string;
  quantity: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  mint_address: string | null;
  tx_signature: string | null;
  error_message: string | null;
  processed_at: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  updated_at: string;
}

