import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import { createCollection, fetchCollectionV1 } from '@metaplex-foundation/mpl-core';
import { getUmi } from './umi.js';

interface CreateCollectionParams {
  name: string;
  uri: string;
}

/**
 * Creates a new Metaplex Core collection for an NFT tier.
 */
export async function createTierCollection(params: CreateCollectionParams): Promise<string> {
  const umi = getUmi();
  
  console.log(`[Collection] Creating collection with authority: ${umi.identity.publicKey.toString()}`);
  
  const collectionMint = generateSigner(umi);
  
  try {
    await createCollection(umi, {
      collection: collectionMint,
      name: params.name,
      uri: params.uri,
    }).sendAndConfirm(umi);
    
    console.log(`[Collection] Created: ${collectionMint.publicKey.toString()}`);
    
    return collectionMint.publicKey.toString();
  } catch (error: any) {
    console.error('[Collection] Error creating collection:', error.message);
    if (error.transactionMessage) {
      console.error('[Collection] Transaction message:', error.transactionMessage);
    }
    if (error.logs || error.transactionLogs) {
      console.error('[Collection] Logs:', error.logs || error.transactionLogs);
    }
    throw error;
  }
}

/**
 * Fetches collection information from the blockchain.
 */
export async function getCollectionInfo(collectionAddress: string) {
  const umi = getUmi();
  
  try {
    const collection = await fetchCollectionV1(umi, publicKey(collectionAddress));
    
    return {
      name: collection.name,
      uri: collection.uri,
      numMinted: collection.numMinted,
      currentSize: collection.currentSize,
      updateAuthority: collection.updateAuthority.toString(),
    };
  } catch (error) {
    console.error('Failed to fetch collection:', error);
    return null;
  }
}
