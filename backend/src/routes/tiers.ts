import { Router, Request, Response, NextFunction, type IRouter } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { createTierCollection, getCollectionInfo } from '../solana/collection.js';

const router: IRouter = Router();

// Validation schemas
const createTierSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500),
  artworkUrl: z.string().url(),
  displayOrder: z.number().int().min(0).optional(),
  supplyCap: z.number().int().positive().nullable().optional(),
  mintingOpen: z.boolean().optional(),
  price: z.number().min(0).optional(),
});

const updateTierSchema = createTierSchema.partial();

// GET /api/tiers - List all tiers (public)
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[Tiers] GET all tiers');
    
    const { data: tiers, error } = await supabase
      .from('tiers')
      .select('id, name, description, artwork_url, display_order, supply_cap, minted_count, minting_open, price, collection_address')
      .order('display_order', { ascending: true });
    
    console.log('[Tiers] Query result:', { count: tiers?.length, error: error?.message });
    
    if (error) throw new AppError(500, error.message);
    
    // Transform snake_case to camelCase for frontend
    const transformed = tiers?.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      artworkUrl: t.artwork_url,
      displayOrder: t.display_order,
      supplyCap: t.supply_cap,
      mintedCount: t.minted_count,
      mintingOpen: t.minting_open,
      price: t.price,
      collectionAddress: t.collection_address,
    }));
    
    res.json({
      success: true,
      data: transformed,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tiers/:id - Get single tier (public)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: tier, error } = await supabase
      .from('tiers')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error || !tier) {
      throw new AppError(404, 'Tier not found');
    }
    
    // Fetch on-chain collection info if available
    let collectionInfo = null;
    if (tier.collection_address) {
      collectionInfo = await getCollectionInfo(tier.collection_address);
    }
    
    res.json({
      success: true,
      data: {
        id: tier.id,
        name: tier.name,
        description: tier.description,
        artworkUrl: tier.artwork_url,
        displayOrder: tier.display_order,
        supplyCap: tier.supply_cap,
        mintedCount: tier.minted_count,
        mintingOpen: tier.minting_open,
        price: tier.price,
        collectionAddress: tier.collection_address,
        candyMachineAddress: tier.candy_machine_address,
        createdAt: tier.created_at,
        updatedAt: tier.updated_at,
        collectionInfo,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tiers - Create new tier (admin only)
router.post(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createTierSchema.parse(req.body);
      
      // Check if tier name already exists
      const { data: existing } = await supabase
        .from('tiers')
        .select('id')
        .eq('name', data.name)
        .single();
      
      if (existing) {
        throw new AppError(400, 'Tier with this name already exists');
      }
      
      // Create tier in database
      const { data: tier, error } = await supabase
        .from('tiers')
        .insert({
          name: data.name,
          description: data.description,
          artwork_url: data.artworkUrl,
          display_order: data.displayOrder ?? 0,
          supply_cap: data.supplyCap ?? null,
          minting_open: data.mintingOpen ?? false,
          price: data.price ?? 0,
        })
        .select()
        .single();
      
      if (error) throw new AppError(500, error.message);
      
      res.status(201).json({
        success: true,
        data: {
          id: tier.id,
          name: tier.name,
          description: tier.description,
          artworkUrl: tier.artwork_url,
          displayOrder: tier.display_order,
          supplyCap: tier.supply_cap,
          mintedCount: tier.minted_count,
          mintingOpen: tier.minting_open,
          price: tier.price,
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

// PUT /api/tiers/:id - Update tier (admin only)
router.put(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('[Tiers] PUT request for ID:', req.params.id);
      console.log('[Tiers] Request body:', req.body);
      
      const data = updateTierSchema.parse(req.body);
      
      const { data: tier, error: fetchError } = await supabase
        .from('tiers')
        .select('*')
        .eq('id', req.params.id)
        .single();
      
      console.log('[Tiers] Fetch result:', { tier: tier?.id, error: fetchError?.message });
      
      if (fetchError || !tier) {
        console.error('[Tiers] Tier not found. ID:', req.params.id, 'Error:', fetchError);
        throw new AppError(404, 'Tier not found');
      }
      
      // Check name uniqueness if changing name
      if (data.name && data.name !== tier.name) {
        const { data: existing } = await supabase
          .from('tiers')
          .select('id')
          .eq('name', data.name)
          .single();
        if (existing) {
          throw new AppError(400, 'Tier with this name already exists');
        }
      }
      
      // Build update object (convert camelCase to snake_case)
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.artworkUrl !== undefined) updateData.artwork_url = data.artworkUrl;
      if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder;
      if (data.supplyCap !== undefined) updateData.supply_cap = data.supplyCap;
      if (data.mintingOpen !== undefined) updateData.minting_open = data.mintingOpen;
      if (data.price !== undefined) updateData.price = data.price;
      
      const { data: updatedTier, error } = await supabase
        .from('tiers')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        data: {
          id: updatedTier.id,
          name: updatedTier.name,
          description: updatedTier.description,
          artworkUrl: updatedTier.artwork_url,
          displayOrder: updatedTier.display_order,
          supplyCap: updatedTier.supply_cap,
          mintedCount: updatedTier.minted_count,
          mintingOpen: updatedTier.minting_open,
          price: updatedTier.price,
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

// POST /api/tiers/:id/collection - Create Solana collection for tier (admin only)
router.post(
  '/:id/collection',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: tier, error: fetchError } = await supabase
        .from('tiers')
        .select('*')
        .eq('id', req.params.id)
        .single();
      
      if (fetchError || !tier) {
        throw new AppError(404, 'Tier not found');
      }
      
      if (tier.collection_address) {
        throw new AppError(400, 'Tier already has a collection');
      }
      
      // Create Metaplex Core collection
      const collectionAddress = await createTierCollection({
        name: `Member Pass ${tier.name}`,
        uri: tier.artwork_url,
      });
      
      // Update tier with collection address
      const { data: updatedTier, error } = await supabase
        .from('tiers')
        .update({ collection_address: collectionAddress })
        .eq('id', req.params.id)
        .select()
        .single();
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        data: {
          id: updatedTier.id,
          name: updatedTier.name,
          collectionAddress: updatedTier.collection_address,
        },
        collectionAddress,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/tiers/:id - Delete tier (super admin only)
router.delete(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: tier, error: fetchError } = await supabase
        .from('tiers')
        .select('*, airdrops(id)')
        .eq('id', req.params.id)
        .single();
      
      if (fetchError || !tier) {
        throw new AppError(404, 'Tier not found');
      }
      
      if (tier.minted_count > 0) {
        throw new AppError(400, 'Cannot delete tier with minted NFTs');
      }
      
      const { error } = await supabase
        .from('tiers')
        .delete()
        .eq('id', req.params.id);
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        message: 'Tier deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as tierRoutes };
