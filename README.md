# Member Pass Solana NFT Platform

A comprehensive Solana NFT management platform for Member Pass with admin dashboard, tier management, and user minting capabilities.

## Features

- **NFT Tier Management**: Bronze, Silver, Gold, and configurable future tiers
- **Metaplex Core Integration**: Modern NFT standard on Solana
- **Candy Machine**: Managed minting with supply caps
- **Admin Dashboard**: Full control over tiers, wallets, and minting
- **Wallet Management**: Whitelist/blacklist functionality
- **CSV Export**: Export holder data for analytics

## Tech Stack

- **Backend**: Node.js, Express, Prisma, PostgreSQL
- **Frontend**: Next.js 16, TailwindCSS, shadcn/ui, Reown AppKit
- **Blockchain**: Solana, Metaplex Core, Candy Machine v3
- **Wallet Integration**: [Reown AppKit](https://docs.reown.com/appkit/next/core/installation) for Solana

## Project Structure

```
solana-member-passes/
├── backend/           # Express API server
│   ├── src/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   ├── solana/    # Metaplex integration
│   │   └── prisma/    # Database schema
│   └── package.json
├── frontend/          # Next.js application
│   ├── app/           # App router pages
│   ├── components/    # React components
│   └── package.json
└── package.json       # Workspace root
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Solana CLI tools
- Phantom or compatible wallet

### Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Backend (.env)
DATABASE_URL="postgresql://user:password@localhost:5432/member_passes"
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
ADMIN_WALLET_SECRET="[your-admin-wallet-keypair]"
JWT_SECRET="your-jwt-secret"

# Frontend (.env.local)
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_SOLANA_NETWORK="mainnet-beta"
NEXT_PUBLIC_REOWN_PROJECT_ID="your-reown-project-id"
```

> **Note**: Get your Reown Project ID from [Reown Dashboard](https://cloud.reown.com)

3. Initialize database:
```bash
cd backend && npx prisma migrate dev
```

4. Run development servers:
```bash
npm run dev
```

## NFT Tiers

| Tier | Supply Cap | Status |
|------|------------|--------|
| Bronze | Unlimited | Minting Open |
| Silver | 1,500 | Partial Airdrop + Minting |
| Gold | 500 | Full Airdrop (Closed) |

## Admin Dashboard

Access the admin dashboard at `/admin` to:
- Create and edit NFT tiers
- Manage supply caps and minting status
- Whitelist/blacklist wallets
- Export holder data as CSV
- Monitor minting activity

## License

Proprietary - Member Pass

