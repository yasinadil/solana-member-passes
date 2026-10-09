import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { checkTokenGating, getWalletNFTs } from '../solana/tokenGating.js';

const router = Router();

// GET /api/export/tiers - Export tier summary
router.get(
  '/tiers',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN', 'VIEWER'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: tiers, error } = await supabase
        .from('tiers')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw new AppError(500, error.message);
      
      const csvData = [
        ['Tier Name', 'Description', 'Supply Cap', 'Minted Count', 'Minting Open', 'Price (SOL)', 'Collection Address'].join(','),
        ...(tiers || []).map(t => [
          `"${t.name}"`,
          `"${t.description.replace(/"/g, '""')}"`,
          t.supply_cap ?? 'Unlimited',
          t.minted_count,
          t.minting_open,
          t.price,
          t.collection_address || '',
        ].join(',')),
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=tiers.csv');
      res.send(csvData);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/export/wallets - Export wallet entries
router.get(
  '/wallets',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN', 'VIEWER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;
      
      let query = supabase
        .from('wallet_entries')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (type) {
        query = query.eq('type', type);
      }
      
      const { data: entries, error } = await query;
      
      if (error) throw new AppError(500, error.message);
      
      const csvData = [
        ['Wallet Address', 'Type', 'Reason', 'Expires At', 'Created At'].join(','),
        ...(entries || []).map(e => [
          e.wallet_address,
          e.type,
          `"${(e.reason || '').replace(/"/g, '""')}"`,
          e.expires_at || '',
          e.created_at,
        ].join(',')),
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=wallet-entries.csv');
      res.send(csvData);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/export/airdrops/:id - Export airdrop recipients
router.get(
  '/airdrops/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN', 'VIEWER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: airdrop, error: airdropError } = await supabase
        .from('airdrops')
        .select('*, tiers(name)')
        .eq('id', req.params.id)
        .single();
      
      if (airdropError || !airdrop) {
        throw new AppError(404, 'Airdrop not found');
      }
      
      const { data: recipients, error } = await supabase
        .from('airdrop_recipients')
        .select('*')
        .eq('airdrop_id', req.params.id)
        .order('processed_at', { ascending: false });
      
      if (error) throw new AppError(500, error.message);
      
      const csvData = [
        ['Wallet Address', 'Quantity', 'Status', 'Mint Address', 'TX Signature', 'Error', 'Processed At'].join(','),
        ...(recipients || []).map(r => [
          r.wallet_address,
          r.quantity,
          r.status,
          r.mint_address || '',
          r.tx_signature || '',
          `"${(r.error_message || '').replace(/"/g, '""')}"`,
          r.processed_at || '',
        ].join(',')),
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=airdrop-${airdrop.name}.csv`);
      res.send(csvData);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/export/verify-wallets - Verify wallet ownership via blockchain (admin only)
router.post(
  '/verify-wallets',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { walletAddresses, tierId } = req.body;
      
      if (!Array.isArray(walletAddresses) || walletAddresses.length === 0) {
        throw new AppError(400, 'walletAddresses array is required');
      }
      
      let collectionAddress: string | null = null;
      if (tierId) {
        const { data: tier, error } = await supabase
          .from('tiers')
          .select('collection_address')
          .eq('id', tierId)
          .single();
        
        if (error || !tier) {
          throw new AppError(404, 'Tier not found');
        }
        collectionAddress = tier.collection_address;
      }
      
      const results = [];
      
      for (const walletAddress of walletAddresses) {
        try {
          const tokenGatingResult = await checkTokenGating(walletAddress);
          results.push({
            walletAddress,
            hasAccess: tokenGatingResult.hasAccess,
            highestTier: tokenGatingResult.highestTier,
            totalNFTs: tokenGatingResult.totalNFTs,
            tiers: tokenGatingResult.tiers.map(t => t.name),
          });
        } catch (error: any) {
          results.push({
            walletAddress,
            error: error.message || 'Failed to verify',
          });
        }
      }
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/export/holders - Export real-time holders from blockchain (admin only)
router.get(
  '/holders',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // This endpoint returns info about configured tiers
      // Actual holder data must be fetched via blockchain indexer or RPC
      const { data: tiers, error } = await supabase
        .from('tiers')
        .select('id, name, collection_address, minted_count')
        .order('display_order', { ascending: true });
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        data: {
          message: 'Holder data is fetched real-time from blockchain via token gating endpoints',
          tiers: tiers?.map(t => ({
            id: t.id,
            name: t.name,
            collectionAddress: t.collection_address,
            estimatedHolders: t.minted_count, // This is just an estimate from minted count
          })),
          instructions: {
            verifyWallet: 'POST /api/export/verify-wallets with {walletAddresses: [...]}',
            checkAccess: 'GET /api/token-gating/:walletAddress',
            checkTierAccess: 'GET /api/token-gating/:walletAddress/tier/:tierName',
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as exportRoutes };
