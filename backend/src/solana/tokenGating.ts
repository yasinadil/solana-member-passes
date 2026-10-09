import { publicKey } from '@metaplex-foundation/umi';
import { fetchAssetsByOwner, fetchAssetV1, type AssetV1 } from '@metaplex-foundation/mpl-core';
import { getUmi } from './umi.js';
import { supabase } from '../lib/supabase.js';

// Serializable NFT type (no BigInt)
interface SerializableNFT {
  mintAddress: string;
  name: string;
  uri: string;
  collectionAddress: string | null;
}

interface TierInfo {
  tier: string;
  tierId: string;
  count: number;
  nfts: SerializableNFT[];
}

interface TokenGatingResult {
  walletAddress: string;
  hasAccess: boolean;
  tiers: TierInfo[];
  highestTier: string | null;
  totalNFTs: number;
}

interface WalletNFTsResult {
  walletAddress: string;
  count: number;
  nfts: SerializableNFT[];
}

interface TierAccess {
  walletAddress: string;
  requiredTier: string;
  hasAccess: boolean;
  actualTier: string | null;
}

/**
 * Converts an AssetV1 to a JSON-serializable format
 */
function serializeAsset(asset: AssetV1): SerializableNFT {
  let collectionAddress: string | null = null;
  
  if (asset.updateAuthority.type === 'Collection') {
    collectionAddress = asset.updateAuthority.address?.toString() || null;
  }
  
  return {
    mintAddress: asset.publicKey.toString(),
    name: asset.name,
    uri: asset.uri,
    collectionAddress,
  };
}

/**
 * Checks if a wallet has any Member Pass NFT and returns detailed access information.
 * Queries the blockchain in real-time.
 * @param walletAddress The public key of the wallet to check.
 * @returns A TokenGatingResult object with JSON-serializable data.
 */
export async function checkTokenGating(walletAddress: string): Promise<TokenGatingResult> {
  const umi = getUmi();
  const ownerPublicKey = publicKey(walletAddress);

  // Fetch all assets owned by the wallet
  const ownedAssets = await fetchAssetsByOwner(umi, ownerPublicKey);

  // Fetch all active tiers from the database
  const { data: tiers, error } = await supabase
    .from('tiers')
    .select('id, name, collection_address, display_order')
    .not('collection_address', 'is', null)
    .order('display_order', { ascending: false }); // Higher displayOrder = higher tier

  if (error) {
    throw new Error(`Failed to fetch tiers: ${error.message}`);
  }

  let hasAccess = false;
  let highestTier: string | null = null;
  let highestTierOrder = -1;
  let totalNFTs = 0;
  const tierInfos: TierInfo[] = [];

  for (const tier of tiers || []) {
    const collectionAddress = tier.collection_address;
    if (!collectionAddress) continue;

    // Check if any owned asset belongs to this tier's collection
    const tierNFTs = ownedAssets.filter(asset => {
      // Check if asset is part of the collection
      if (asset.updateAuthority.type === 'Collection') {
        const authAddress = asset.updateAuthority.address;
        return authAddress && authAddress.toString() === collectionAddress;
      }
      return false;
    });

    if (tierNFTs.length > 0) {
      hasAccess = true;
      totalNFTs += tierNFTs.length;
      
      // Convert to serializable format
      tierInfos.push({
        tier: tier.name,
        tierId: tier.id,
        count: tierNFTs.length,
        nfts: tierNFTs.map(serializeAsset),
      });

      // Track highest tier
      if (tier.display_order > highestTierOrder) {
        highestTierOrder = tier.display_order;
        highestTier = tier.name;
      }
    }
  }

  return {
    walletAddress,
    hasAccess,
    tiers: tierInfos,
    highestTier,
    totalNFTs,
  };
}

/**
 * Checks if a wallet has access to a specific tier or higher.
 * @param walletAddress The public key of the wallet to check.
 * @param requiredTierName The name of the tier to check access for.
 * @returns An object indicating if access is granted and the actual highest tier found.
 */
export async function checkTierAccess(walletAddress: string, requiredTierName: string): Promise<TierAccess> {
  const { hasAccess, highestTier } = await checkTokenGating(walletAddress);

  if (!hasAccess || !highestTier) {
    return { walletAddress, requiredTier: requiredTierName, hasAccess: false, actualTier: null };
  }

  // Fetch tier display orders for comparison
  const { data: requiredTier, error: requiredError } = await supabase
    .from('tiers')
    .select('display_order')
    .eq('name', requiredTierName)
    .single();

  if (requiredError || !requiredTier) {
    throw new Error(`Tier '${requiredTierName}' not found.`);
  }

  const { data: actualTier, error: actualError } = await supabase
    .from('tiers')
    .select('display_order')
    .eq('name', highestTier)
    .single();

  if (actualError || !actualTier) {
    return { walletAddress, requiredTier: requiredTierName, hasAccess: false, actualTier: null };
  }

  const meetsRequirement = actualTier.display_order >= requiredTier.display_order;

  return { walletAddress, requiredTier: requiredTierName, hasAccess: meetsRequirement, actualTier: highestTier };
}

/**
 * Retrieves all NFTs owned by a given wallet address.
 * @param walletAddress The public key of the wallet to check.
 * @returns A serializable result with NFT data.
 */
export async function getWalletNFTs(walletAddress: string): Promise<WalletNFTsResult> {
  const umi = getUmi();
  const ownerPublicKey = publicKey(walletAddress);
  const ownedAssets = await fetchAssetsByOwner(umi, ownerPublicKey);
  
  return {
    walletAddress,
    count: ownedAssets.length,
    nfts: ownedAssets.map(serializeAsset),
  };
}

/**
 * Fetches detailed metadata for a specific NFT mint address.
 * @param mintAddress The mint address of the NFT.
 * @returns A serializable NFT object.
 */
export async function getNFTMetadata(mintAddress: string): Promise<SerializableNFT> {
  const umi = getUmi();
  const asset = await fetchAssetV1(umi, publicKey(mintAddress));
  return serializeAsset(asset);
}
