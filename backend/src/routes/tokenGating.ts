import { Router, Request, Response, NextFunction } from 'express';
import { checkTokenGating, checkTierAccess, getWalletNFTs, getNFTMetadata } from '../solana/tokenGating.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/token-gating/:walletAddress - Get full token gating status for a wallet
router.get('/:walletAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const walletAddress = req.params.walletAddress as string;
    
    if (!walletAddress || walletAddress.length < 32) {
      throw new AppError(400, 'Invalid wallet address');
    }
    
    const result = await checkTokenGating(walletAddress);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/token-gating/:walletAddress/tier/:tierName - Check if a wallet has access to a specific tier or higher
router.get('/:walletAddress/tier/:tierName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const walletAddress = req.params.walletAddress as string;
    const tierName = req.params.tierName as string;
    
    if (!walletAddress || walletAddress.length < 32) {
      throw new AppError(400, 'Invalid wallet address');
    }
    
    const access = await checkTierAccess(walletAddress, tierName);
    
    res.json({
      success: true,
      data: access,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/token-gating/:walletAddress/nfts - Get all NFTs owned by a wallet
router.get('/:walletAddress/nfts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const walletAddress = req.params.walletAddress as string;
    
    if (!walletAddress || walletAddress.length < 32) {
      throw new AppError(400, 'Invalid wallet address');
    }
    
    const nfts = await getWalletNFTs(walletAddress);
    
    res.json({
      success: true,
      data: nfts,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/token-gating/nft/:mintAddress - Get metadata for a specific NFT
router.get('/nft/:mintAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mintAddress = req.params.mintAddress as string;
    
    if (!mintAddress || mintAddress.length < 32) {
      throw new AppError(400, 'Invalid mint address');
    }
    
    const metadata = await getNFTMetadata(mintAddress);
    
    res.json({
      success: true,
      data: metadata,
    });
  } catch (error) {
    next(error);
  }
});

export { router as tokenGatingRoutes };
