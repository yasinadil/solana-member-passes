import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Validation schemas
const walletEntrySchema = z.object({
  walletAddress: z.string().min(32).max(44),
  type: z.enum(['WHITELIST', 'BLACKLIST']),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

// GET /api/wallets - List wallet entries (admin only)
router.get(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN', 'VIEWER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, search, page = '1', limit = '50' } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;
      
      let query = supabase
        .from('wallet_entries')
        .select('*', { count: 'exact' });
      
      if (type) {
        query = query.eq('type', type);
      }
      
      if (search) {
        query = query.ilike('wallet_address', `%${search}%`);
      }
      
      const { data: entries, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        data: entries?.map(e => ({
          id: e.id,
          walletAddress: e.wallet_address,
          type: e.type,
          reason: e.reason,
          expiresAt: e.expires_at,
          createdAt: e.created_at,
          createdBy: e.created_by,
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

// GET /api/wallets/check/:address - Check wallet status (public)
router.get('/check/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    
    const { data: entries, error } = await supabase
      .from('wallet_entries')
      .select('*')
      .eq('wallet_address', address)
      .or('expires_at.is.null,expires_at.gt.now()');
    
    if (error) throw new AppError(500, error.message);
    
    const isWhitelisted = entries?.some(e => e.type === 'WHITELIST') || false;
    const isBlacklisted = entries?.some(e => e.type === 'BLACKLIST') || false;
    
    res.json({
      success: true,
      data: {
        walletAddress: address,
        isWhitelisted,
        isBlacklisted,
        canMint: isWhitelisted || !isBlacklisted,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/wallets - Add wallet entry (admin only)
router.post(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = walletEntrySchema.parse(req.body);
      
      // Check if entry already exists
      const { data: existing } = await supabase
        .from('wallet_entries')
        .select('id')
        .eq('wallet_address', data.walletAddress)
        .eq('type', data.type)
        .single();
      
      if (existing) {
        throw new AppError(400, 'Wallet entry already exists');
      }
      
      const { data: entry, error } = await supabase
        .from('wallet_entries')
        .insert({
          wallet_address: data.walletAddress,
          type: data.type,
          reason: data.reason,
          expires_at: data.expiresAt || null,
          created_by: req.user?.userId,
        })
        .select()
        .single();
      
      if (error) throw new AppError(500, error.message);
      
      res.status(201).json({
        success: true,
        data: {
          id: entry.id,
          walletAddress: entry.wallet_address,
          type: entry.type,
          reason: entry.reason,
          expiresAt: entry.expires_at,
          createdAt: entry.created_at,
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

// POST /api/wallets/bulk - Bulk add wallet entries (admin only)
router.post(
  '/bulk',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { wallets, type, reason, expiresAt } = req.body;
      
      if (!Array.isArray(wallets) || wallets.length === 0) {
        throw new AppError(400, 'Wallets array is required');
      }
      
      if (!['WHITELIST', 'BLACKLIST'].includes(type)) {
        throw new AppError(400, 'Invalid type');
      }
      
      const entries = wallets.map((wallet: string) => ({
        wallet_address: wallet,
        type,
        reason,
        expires_at: expiresAt || null,
        created_by: req.user?.userId,
      }));
      
      const { data, error } = await supabase
        .from('wallet_entries')
        .upsert(entries, { 
          onConflict: 'wallet_address,type',
          ignoreDuplicates: true 
        })
        .select();
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        data: {
          created: data?.length || 0,
          total: wallets.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/wallets/:id - Remove wallet entry (admin only)
router.delete(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: entry, error: fetchError } = await supabase
        .from('wallet_entries')
        .select('id')
        .eq('id', req.params.id)
        .single();
      
      if (fetchError || !entry) {
        throw new AppError(404, 'Wallet entry not found');
      }
      
      const { error } = await supabase
        .from('wallet_entries')
        .delete()
        .eq('id', req.params.id);
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        message: 'Wallet entry removed',
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as walletRoutes };
