-- Member Pass Solana NFT Platform Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- NFT Tier Configuration
CREATE TABLE IF NOT EXISTS tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  artwork_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  supply_cap INTEGER, -- NULL = unlimited
  minted_count INTEGER DEFAULT 0,
  minting_open BOOLEAN DEFAULT FALSE,
  price DECIMAL(10, 4) DEFAULT 0,
  collection_address TEXT UNIQUE,
  candy_machine_address TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet Management (Whitelist/Blacklist)
CREATE TYPE wallet_type AS ENUM ('WHITELIST', 'BLACKLIST');

CREATE TABLE IF NOT EXISTS wallet_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL,
  type wallet_type NOT NULL,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  UNIQUE(wallet_address, type)
);

CREATE INDEX idx_wallet_entries_address ON wallet_entries(wallet_address);

-- Airdrop Management
CREATE TYPE airdrop_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS airdrops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_id UUID NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status airdrop_status DEFAULT 'PENDING',
  total_recipients INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_airdrops_tier ON airdrops(tier_id);

-- Airdrop Recipients
CREATE TYPE airdrop_recipient_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');

CREATE TABLE IF NOT EXISTS airdrop_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airdrop_id UUID NOT NULL REFERENCES airdrops(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  status airdrop_recipient_status DEFAULT 'PENDING',
  mint_address TEXT,
  tx_signature TEXT,
  error_message TEXT,
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_airdrop_recipients_airdrop ON airdrop_recipients(airdrop_id);
CREATE INDEX idx_airdrop_recipients_wallet ON airdrop_recipients(wallet_address);

-- Admin Users
CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER');

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role admin_role DEFAULT 'ADMIN',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Configuration
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tiers_updated_at
  BEFORE UPDATE ON tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Optional, since we use service role key
-- Enable if you want to use RLS policies
-- ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wallet_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE airdrops ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE airdrop_recipients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

