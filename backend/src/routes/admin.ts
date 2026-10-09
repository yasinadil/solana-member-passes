import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';
import { authMiddleware, requireRole, type AuthPayload } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'VIEWER']).optional(),
});

const updateAdminSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

// POST /api/admin/login - Admin login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', data.email)
      .single();
    
    if (error || !user || !user.is_active) {
      throw new AppError(401, 'Invalid credentials');
    }
    
    const isValidPassword = await bcrypt.compare(data.password, user.password_hash);
    
    if (!isValidPassword) {
      throw new AppError(401, 'Invalid credentials');
    }
    
    // Update last login
    await supabase
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);
    
    // Generate JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError(500, 'JWT secret not configured');
    }
    
    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    
    const token = jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// GET /api/admin/me - Get current user
router.get(
  '/me',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: user, error } = await supabase
        .from('admin_users')
        .select('id, email, name, role, last_login_at, created_at')
        .eq('id', req.user!.userId)
        .single();
      
      if (error || !user) {
        throw new AppError(404, 'User not found');
      }
      
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastLoginAt: user.last_login_at,
          createdAt: user.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admin/change-password - Change password
router.post(
  '/change-password',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = changePasswordSchema.parse(req.body);
      
      const { data: user, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', req.user!.userId)
        .single();
      
      if (error || !user) {
        throw new AppError(404, 'User not found');
      }
      
      const isValidPassword = await bcrypt.compare(data.currentPassword, user.password_hash);
      
      if (!isValidPassword) {
        throw new AppError(400, 'Current password is incorrect');
      }
      
      const passwordHash = await bcrypt.hash(data.newPassword, 12);
      
      await supabase
        .from('admin_users')
        .update({ password_hash: passwordHash })
        .eq('id', user.id);
      
      res.json({
        success: true,
        message: 'Password changed successfully',
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

// GET /api/admin/users - List admin users (super admin only)
router.get(
  '/users',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: users, error } = await supabase
        .from('admin_users')
        .select('id, email, name, role, is_active, last_login_at, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        data: users?.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          isActive: u.is_active,
          lastLoginAt: u.last_login_at,
          createdAt: u.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admin/users - Create admin user (super admin only)
router.post(
  '/users',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createAdminSchema.parse(req.body);
      
      // Check if email already exists
      const { data: existing } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', data.email)
        .single();
      
      if (existing) {
        throw new AppError(400, 'Email already exists');
      }
      
      const passwordHash = await bcrypt.hash(data.password, 12);
      
      const { data: user, error } = await supabase
        .from('admin_users')
        .insert({
          email: data.email,
          password_hash: passwordHash,
          name: data.name,
          role: data.role || 'ADMIN',
        })
        .select('id, email, name, role, created_at')
        .single();
      
      if (error) throw new AppError(500, error.message);
      
      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.created_at,
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

// PUT /api/admin/users/:id - Update admin user (super admin only)
router.put(
  '/users/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateAdminSchema.parse(req.body);
      
      const { data: user, error: fetchError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', req.params.id)
        .single();
      
      if (fetchError || !user) {
        throw new AppError(404, 'User not found');
      }
      
      // Check email uniqueness if changing
      if (data.email && data.email !== user.email) {
        const { data: existing } = await supabase
          .from('admin_users')
          .select('id')
          .eq('email', data.email)
          .single();
        if (existing) {
          throw new AppError(400, 'Email already exists');
        }
      }
      
      const updateData: any = {};
      if (data.email !== undefined) updateData.email = data.email;
      if (data.name !== undefined) updateData.name = data.name;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;
      
      const { data: updatedUser, error } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('id', req.params.id)
        .select('id, email, name, role, is_active, created_at')
        .single();
      
      if (error) throw new AppError(500, error.message);
      
      res.json({
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          isActive: updatedUser.is_active,
          createdAt: updatedUser.created_at,
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

// GET /api/admin/stats - Dashboard statistics
router.get(
  '/stats',
  authMiddleware,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Get tier stats
      const { data: tiers, error: tiersError } = await supabase
        .from('tiers')
        .select('id, name, supply_cap, minted_count, minting_open')
        .order('display_order', { ascending: true });
      
      if (tiersError) throw new AppError(500, tiersError.message);
      
      // Calculate totals
      const totalNFTs = tiers?.reduce((sum, t) => sum + (t.minted_count || 0), 0) || 0;
      
      res.json({
        success: true,
        data: {
          tiers: tiers?.map(t => ({
            id: t.id,
            name: t.name,
            supplyCap: t.supply_cap,
            mintedCount: t.minted_count,
            mintingOpen: t.minting_open,
          })),
          totalNFTs,
          // Note: uniqueHolders requires blockchain query now
          uniqueHolders: 0,
          recentMints: [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as adminRoutes };
