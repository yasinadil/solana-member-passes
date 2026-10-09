import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatSOL(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
}

// Cache for metadata JSON to avoid repeated fetches
const metadataCache = new Map<string, NFTMetadata>();

export interface NFTMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  properties?: {
    files?: Array<{ uri: string; type: string }>;
    category?: string;
  };
}

/**
 * Checks if a URL points to a JSON metadata file (not a direct image)
 */
export function isMetadataUrl(url: string): boolean {
  if (!url) return false;
  // If it ends with .json, it's metadata
  if (url.endsWith('.json')) return true;
  // If it's a Pinata IPFS link without extension, it could be JSON
  // We'll try to fetch and check content-type
  return url.includes('pinata') || url.includes('ipfs');
}

/**
 * Fetches NFT metadata from a JSON URL and extracts the image URL.
 * Returns the original URL if it's already an image or fetch fails.
 */
export async function getImageFromMetadata(url: string): Promise<string> {
  if (!url) return '';
  
  // Check cache first
  if (metadataCache.has(url)) {
    return metadataCache.get(url)?.image || url;
  }
  
  // If URL looks like a direct image, return as-is
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  if (imageExtensions.some(ext => url.toLowerCase().endsWith(ext))) {
    return url;
  }
  
  try {
    const response = await fetch(url, { 
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const metadata: NFTMetadata = await response.json();
      metadataCache.set(url, metadata);
      return metadata.image || url;
    }
    
    // If not JSON, it might be the image itself
    return url;
  } catch (error) {
    console.warn('Failed to fetch metadata from:', url, error);
    return url;
  }
}

