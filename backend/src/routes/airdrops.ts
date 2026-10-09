import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { mintNFTToWallet } from '../solana/minting.js';

const router = Router();

// Validation schemas
const createAirdropSchema = z.object({
  tierId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  recipients: z.array(
    z.object({
      walletAddress: z.string().min(32).max(44),
      quantity: z.number().int().positive().optional(),
    })
  ).min(1),
});

// GET /api/airdrops - List all airdrops (admin only)
router.get(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN', 'VIEWER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tierId, status, page = '1', limit = '20' } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;
      
      let query = supabase
        .from('airdrops')
        .select('*, tiers(id, name)', { count: 'exact' });
      
      if (tierId) {
        query = query.eq('tier_id', tierId);
      }
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data: airdrops, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        data: airdrops?.map(a => ({
          id: a.id,
          tierId: a.tier_id,
          tier: a.tiers ? { id: a.tiers.id, name: a.tiers.name } : null,
          name: a.name,
          description: a.description,
          status: a.status,
          totalRecipients: a.total_recipients,
          successCount: a.success_count,
          failedCount: a.failed_count,
          createdAt: a.created_at,
          executedAt: a.executed_at,
          completedAt: a.completed_at,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          pages: Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/airdrops/:id - Get single airdrop with recipients (admin only)
router.get(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN', 'VIEWER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: airdrop, error } = await supabase
        .from('airdrops')
        .select('*, tiers(id, name), airdrop_recipients(*)')
        .eq('id', req.params.id)
        .single();
      
      if (error || !airdrop) {
        throw new AppError(404, 'Airdrop not found');
      }
      
      res.json({
        success: true,
        data: {
          id: airdrop.id,
          tierId: airdrop.tier_id,
          tier: airdrop.tiers ? { id: airdrop.tiers.id, name: airdrop.tiers.name } : null,
          name: airdrop.name,
          description: airdrop.description,
          status: airdrop.status,
          totalRecipients: airdrop.total_recipients,
          successCount: airdrop.success_count,
          failedCount: airdrop.failed_count,
          createdAt: airdrop.created_at,
          executedAt: airdrop.executed_at,
          completedAt: airdrop.completed_at,
          recipients: airdrop.airdrop_recipients?.map((r: any) => ({
            id: r.id,
            walletAddress: r.wallet_address,
            quantity: r.quantity,
            status: r.status,
            mintAddress: r.mint_address,
            txSignature: r.tx_signature,
            errorMessage: r.error_message,
            processedAt: r.processed_at,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/airdrops - Create new airdrop (admin only)
router.post(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createAirdropSchema.parse(req.body);
      
      // Verify tier exists
      const { data: tier, error: tierError } = await supabase
        .from('tiers')
        .select('id, name, collection_address')
        .eq('id', data.tierId)
        .single();
      
      if (tierError || !tier) {
        throw new AppError(404, 'Tier not found');
      }
      
      if (!tier.collection_address) {
        throw new AppError(400, 'Tier does not have a collection address. Create a collection first.');
      }
      
      // Create airdrop
      const { data: airdrop, error: airdropError } = await supabase
        .from('airdrops')
        .insert({
          tier_id: data.tierId,
          name: data.name,
          description: data.description,
          total_recipients: data.recipients.length,
        })
        .select()
        .single();
      
      if (airdropError) throw new AppError(500, airdropError.message);
      
      // Create recipients
      const recipients = data.recipients.map(r => ({
        airdrop_id: airdrop.id,
        wallet_address: r.walletAddress,
        quantity: r.quantity || 1,
      }));
      
      const { error: recipientsError } = await supabase
        .from('airdrop_recipients')
        .insert(recipients);
      
      if (recipientsError) throw new AppError(500, recipientsError.message);
      
      res.status(201).json({
        success: true,
        data: {
          id: airdrop.id,
          tierId: airdrop.tier_id,
          name: airdrop.name,
          description: airdrop.description,
          status: airdrop.status,
          totalRecipients: airdrop.total_recipients,
          createdAt: airdrop.created_at,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new AppError(400, error.errors[0].message));
      } else {
        next(error);
      }
    }
  }
);

// POST /api/airdrops/:id/execute - Execute airdrop (admin only)
router.post(
  '/:id/execute',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: airdrop, error: fetchError } = await supabase
        .from('airdrops')
        .select('*, tiers(id, name, collection_address)')
        .eq('id', req.params.id)
        .single();
      
      if (fetchError || !airdrop) {
        throw new AppError(404, 'Airdrop not found');
      }
      
      if (airdrop.status !== 'PENDING') {
        throw new AppError(400, 'Airdrop is not in PENDING status');
      }
      
      if (!airdrop.tiers?.collection_address) {
        throw new AppError(400, 'Tier does not have a collection address');
      }
      
      // Fetch full tier info including artwork_url for metadata
      const { data: tier } = await supabase
        .from('tiers')
        .select('name, artwork_url, minted_count')
        .eq('id', airdrop.tier_id)
        .single();
      
      // Update status to IN_PROGRESS
      await supabase
        .from('airdrops')
        .update({
          status: 'IN_PROGRESS',
          executed_at: new Date().toISOString(),
        })
        .eq('id', airdrop.id);
      
      // Get pending recipients
      const { data: recipients, error: recipientsError } = await supabase
        .from('airdrop_recipients')
        .select('*')
        .eq('airdrop_id', airdrop.id)
        .eq('status', 'PENDING');
      
      if (recipientsError) throw new AppError(500, recipientsError.message);
      
      // Start async processing with metadata URI from database
      processAirdrop(
        airdrop.id,
        airdrop.tiers.collection_address,
        recipients || [],
        tier?.artwork_url || '',
        tier?.name || 'NFT',
        tier?.minted_count || 0
      );
      
      res.json({
        success: true,
        message: 'Airdrop execution started',
        data: {
          id: airdrop.id,
          status: 'IN_PROGRESS',
          totalRecipients: recipients?.length || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/airdrops/:id/cancel - Cancel airdrop (admin only)
router.post(
  '/:id/cancel',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: airdrop, error: fetchError } = await supabase
        .from('airdrops')
        .select('*')
        .eq('id', req.params.id)
        .single();
      
      if (fetchError || !airdrop) {
        throw new AppError(404, 'Airdrop not found');
      }
      
      if (!['PENDING', 'IN_PROGRESS'].includes(airdrop.status)) {
        throw new AppError(400, 'Cannot cancel airdrop in current status');
      }
      
      await supabase
        .from('airdrops')
        .update({ status: 'CANCELLED' })
        .eq('id', airdrop.id);
      
      res.json({
        success: true,
        message: 'Airdrop cancelled',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Async function to process airdrop
async function processAirdrop(
  airdropId: string,
  collectionAddress: string,
  recipients: any[],
  metadataUri: string,
  tierName: string,
  startingMintCount: number
) {
  let successCount = 0;
  let failedCount = 0;
  let currentMintNumber = startingMintCount;
  
  for (const recipient of recipients) {
    try {
      // Check if airdrop was cancelled
      const { data: airdrop } = await supabase
        .from('airdrops')
        .select('status')
        .eq('id', airdropId)
        .single();
      
      if (airdrop?.status === 'CANCELLED') {
        break;
      }
      
      currentMintNumber++;
      const nftName = `Member Pass ${tierName} #${currentMintNumber}`;
      
      // Mint NFT to recipient with proper metadata URI
      const result = await mintNFTToWallet(
        collectionAddress,
        recipient.wallet_address,
        metadataUri,
        nftName
      );
      
      // Update recipient status
      await supabase
        .from('airdrop_recipients')
        .update({
          status: 'SUCCESS',
          mint_address: result.mintAddress,
          tx_signature: result.signature,
          processed_at: new Date().toISOString(),
        })
        .eq('id', recipient.id);
      
      successCount++;
    } catch (error: any) {
      // Update recipient with error
      await supabase
        .from('airdrop_recipients')
        .update({
          status: 'FAILED',
          error_message: error.message || 'Unknown error',
          processed_at: new Date().toISOString(),
        })
        .eq('id', recipient.id);
      
      failedCount++;
    }
  }
  
  // Update airdrop final status
  const finalStatus = failedCount === 0 ? 'COMPLETED' : 
                      successCount === 0 ? 'FAILED' : 'COMPLETED';
  
  await supabase
    .from('airdrops')
    .update({
      status: finalStatus,
      success_count: successCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', airdropId);
}

export { router as airdropRoutes };
