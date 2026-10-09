import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { mintNFTToWallet, verifyPayment } from '../solana/minting.js';

const router = Router();

// Treasury wallet for receiving payments
const TREASURY_WALLET = process.env.TREASURY_WALLET_ADDRESS || '';

// Validation schemas
const mintRequestSchema = z.object({
  tierId: z.string().uuid(),
  walletAddress: z.string().min(32).max(44),
  paymentSignature: z.string().optional(), // Required if price > 0
});

// GET /api/mint/config - Get mint configuration (treasury wallet, etc.)
router.get('/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: {
        treasuryWallet: TREASURY_WALLET,
        network: process.env.SOLANA_NETWORK || 'devnet',
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/mint - Mint NFT to user's wallet (with payment verification)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = mintRequestSchema.parse(req.body);
    
    // Get tier
    const { data: tier, error: tierError } = await supabase
      .from('tiers')
      .select('*')
      .eq('id', data.tierId)
      .single();
    
    if (tierError || !tier) {
      throw new AppError(404, 'Tier not found');
    }
    
    if (!tier.minting_open) {
      throw new AppError(400, 'Minting is closed for this tier');
    }
    
    if (tier.supply_cap !== null && tier.minted_count >= tier.supply_cap) {
      throw new AppError(400, 'Tier supply cap reached');
    }
    
    if (!tier.collection_address) {
      throw new AppError(400, 'Tier collection not configured');
    }
    
    // Check wallet status
    const { data: blacklistEntry } = await supabase
      .from('wallet_entries')
      .select('id')
      .eq('wallet_address', data.walletAddress)
      .eq('type', 'BLACKLIST')
      .or('expires_at.is.null,expires_at.gt.now()')
      .single();
    
    if (blacklistEntry) {
      throw new AppError(403, 'Wallet is not allowed to mint');
    }
    
    // Verify payment if price > 0
    if (tier.price > 0) {
      if (!data.paymentSignature) {
        throw new AppError(400, 'Payment signature required for paid mints');
      }
      
      if (!TREASURY_WALLET) {
        throw new AppError(500, 'Treasury wallet not configured');
      }
      
      console.log(`[Mint] Verifying payment of ${tier.price} SOL...`);
      
      const paymentValid = await verifyPayment(
        data.paymentSignature,
        data.walletAddress,
        TREASURY_WALLET,
        tier.price
      );
      
      if (!paymentValid) {
        throw new AppError(400, 'Payment verification failed. Please ensure you sent the correct amount.');
      }
      
      console.log(`[Mint] Payment verified!`);
    }
    
    // Mint NFT directly to user's wallet using backend authority
    const nftName = `Member Pass ${tier.name} #${tier.minted_count + 1}`;
    console.log(`[Mint] Minting ${nftName} to ${data.walletAddress}`);
    
    const result = await mintNFTToWallet(
      tier.collection_address,
      data.walletAddress,
      tier.artwork_url,  // Pinata metadata JSON URL
      nftName
    );
    
    // Increment minted count
    await supabase
      .from('tiers')
      .update({ minted_count: tier.minted_count + 1 })
      .eq('id', data.tierId);
    
    console.log(`[Mint] Success! Mint address: ${result.mintAddress}`);
    
    res.json({
      success: true,
      data: {
        mintAddress: result.mintAddress,
        txSignature: result.signature,
        tier: tier.name,
        tokenNumber: tier.minted_count + 1,
      },
    });
  } catch (error) {
    console.error('[Mint] Error:', error);
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// POST /api/mint/confirm - Legacy endpoint (minting now happens directly in POST /api/mint)
router.post('/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tierId, signature, mintAddress } = req.body;
    
    if (!tierId || !signature) {
      throw new AppError(400, 'tierId and signature are required');
    }
    
    // This endpoint is kept for backwards compatibility
    // The mint count is now incremented directly in the /api/mint endpoint
    res.json({
      success: true,
      data: {
        message: 'Mint confirmed',
        signature,
        mintAddress,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/mint/status/:tierId - Get minting status for a tier
router.get('/status/:tierId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: tier, error } = await supabase
      .from('tiers')
      .select('id, name, supply_cap, minted_count, minting_open, price, collection_address')
      .eq('id', req.params.tierId)
      .single();
    
    if (error || !tier) {
      throw new AppError(404, 'Tier not found');
    }
    
    const remaining = tier.supply_cap !== null 
      ? tier.supply_cap - tier.minted_count 
      : null;
    
    // Can mint if: minting is open, collection exists, and supply not reached
    const canMint = tier.minting_open && 
      tier.collection_address !== null &&
      (tier.supply_cap === null || tier.minted_count < tier.supply_cap);
    
    res.json({
      success: true,
      data: {
        id: tier.id,
        name: tier.name,
        supplyCap: tier.supply_cap,
        mintedCount: tier.minted_count,
        remaining,
        mintingOpen: tier.minting_open,
        price: tier.price,
        canMint,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as mintRoutes };
