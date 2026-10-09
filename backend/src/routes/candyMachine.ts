import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  createCandyMachine,
  getCandyMachineState,
  updateCandyMachineSettings,
  prepareCandyMachineMint,
} from '../solana/candyMachine.js';

const router = Router();

// Validation schemas
const createCandyMachineSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  mintLimit: z.number().int().positive().optional(),
  solPaymentAmount: z.number().min(0).optional(),
});

// POST /api/candy-machine/:tierId - Create Candy Machine for tier (admin only)
router.post(
  '/:tierId',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createCandyMachineSchema.parse(req.body);
      
      const { data: tier, error: tierError } = await supabase
        .from('tiers')
        .select('*')
        .eq('id', req.params.tierId)
        .single();
      
      if (tierError || !tier) {
        throw new AppError(404, 'Tier not found');
      }
      
      if (!tier.collection_address) {
        throw new AppError(400, 'Tier must have a collection before creating Candy Machine');
      }
      
      if (tier.candy_machine_address) {
        throw new AppError(400, 'Tier already has a Candy Machine');
      }
      
      const candyMachineAddress = await createCandyMachine({
        collectionAddress: tier.collection_address,
        itemsAvailable: tier.supply_cap || 10000, // Default to 10k if unlimited
        price: tier.price,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        mintLimit: data.mintLimit,
      });
      
      // Update tier with Candy Machine address
      await supabase
        .from('tiers')
        .update({ candy_machine_address: candyMachineAddress })
        .eq('id', tier.id);
      
      res.status(201).json({
        success: true,
        data: {
          tierId: tier.id,
          tierName: tier.name,
          candyMachineAddress,
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

// GET /api/candy-machine/:tierId - Get Candy Machine state (public)
router.get('/:tierId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: tier, error } = await supabase
      .from('tiers')
      .select('id, name, candy_machine_address')
      .eq('id', req.params.tierId)
      .single();
    
    if (error || !tier) {
      throw new AppError(404, 'Tier not found');
    }
    
    if (!tier.candy_machine_address) {
      throw new AppError(400, 'Tier does not have a Candy Machine');
    }
    
    const state = await getCandyMachineState(tier.candy_machine_address);
    
    res.json({
      success: true,
      data: {
        tierId: tier.id,
        tierName: tier.name,
        candyMachineAddress: tier.candy_machine_address,
        ...state,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/candy-machine/:tierId - Update Candy Machine settings (admin only)
router.put(
  '/:tierId',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: tier, error: tierError } = await supabase
        .from('tiers')
        .select('*')
        .eq('id', req.params.tierId)
        .single();
      
      if (tierError || !tier) {
        throw new AppError(404, 'Tier not found');
      }
      
      if (!tier.candy_machine_address) {
        throw new AppError(400, 'Tier does not have a Candy Machine');
      }
      
      await updateCandyMachineSettings(tier.candy_machine_address, req.body);
      
      res.json({
        success: true,
        message: 'Candy Machine settings updated',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/candy-machine/:tierId/mint - Prepare mint transaction from Candy Machine (public)
router.post('/:tierId/mint', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      throw new AppError(400, 'walletAddress is required');
    }
    
    const { data: tier, error: tierError } = await supabase
      .from('tiers')
      .select('*')
      .eq('id', req.params.tierId)
      .single();
    
    if (tierError || !tier) {
      throw new AppError(404, 'Tier not found');
    }
    
    if (!tier.candy_machine_address) {
      throw new AppError(400, 'Tier does not have a Candy Machine');
    }
    
    if (!tier.minting_open) {
      throw new AppError(400, 'Minting is closed for this tier');
    }
    
    // Check blacklist
    const { data: blacklistEntry } = await supabase
      .from('wallet_entries')
      .select('id')
      .eq('wallet_address', walletAddress)
      .eq('type', 'BLACKLIST')
      .or('expires_at.is.null,expires_at.gt.now()')
      .single();
    
    if (blacklistEntry) {
      throw new AppError(403, 'Wallet is not allowed to mint');
    }
    
    const transaction = await prepareCandyMachineMint(
      tier.candy_machine_address,
      tier.collection_address!,
      walletAddress
    );
    
    res.json({
      success: true,
      data: {
        transaction: Buffer.from(transaction.serialize()).toJSON(),
        tier: {
          id: tier.id,
          name: tier.name,
          price: tier.price,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as candyMachineRoutes };
