import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import { create, fetchAssetV1, fetchCollectionV1 } from '@metaplex-foundation/mpl-core';
import { getUmi } from './umi.js';
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from '@solana/web3.js';

interface MintResult {
  mintAddress: string;
  signature: string;
}

/**
 * Mints an NFT directly to a wallet (for airdrops).
 * Uses the authority keypair to mint.
 * @param metadataUri - The metadata JSON URI (from Pinata) to use for this NFT
 * @param nftName - Optional custom name for the NFT
 */
export async function mintNFTToWallet(
  collectionAddress: string,
  recipientWallet: string,
  metadataUri?: string,
  nftName?: string
): Promise<MintResult> {
  const umi = getUmi();
  
  const assetSigner = generateSigner(umi);
  const collectionPubkey = publicKey(collectionAddress);
  const owner = publicKey(recipientWallet);
  
  // Fetch collection to get proper reference
  const collection = await fetchCollectionV1(umi, collectionPubkey);
  
  // Use provided metadata URI, or fall back to collection URI
  const uri = metadataUri || collection.uri;
  const name = nftName || 'Member Pass NFT';
  
  console.log(`[Minting] Using metadata URI: ${uri}`);
  
  const builder = create(umi, {
    asset: assetSigner,
    collection,
    owner,
    name,
    uri,
  });
  
  const result = await builder.sendAndConfirm(umi);
  
  return {
    mintAddress: assetSigner.publicKey.toString(),
    signature: Buffer.from(result.signature).toString('base64'),
  };
}

/**
 * Prepares a mint transaction for user to sign.
 * Returns an unsigned transaction that includes payment.
 * @param metadataUri - The metadata JSON URI (from Pinata) to use for this NFT
 * @param nftName - Optional custom name for the NFT
 */
export async function prepareMintTransaction(
  collectionAddress: string,
  payerWallet: string,
  priceInSol: number,
  metadataUri?: string,
  nftName?: string
): Promise<Transaction> {
  const umi = getUmi();
  
  const assetSigner = generateSigner(umi);
  const collectionPubkey = publicKey(collectionAddress);
  const payer = publicKey(payerWallet);
  
  // Fetch collection to get proper reference
  const collection = await fetchCollectionV1(umi, collectionPubkey);
  
  // Use provided metadata URI, or fall back to collection URI
  const uri = metadataUri || collection.uri;
  const name = nftName || 'Member Pass NFT';
  
  // Create the mint instruction
  const mintBuilder = create(umi, {
    asset: assetSigner,
    collection,
    owner: payer,
    name,
    uri,
  });
  
  // Build the transaction
  await mintBuilder.buildAndSign(umi);
  
  // Convert to web3.js Transaction format for frontend
  const tx = new Transaction();
  
  // Add payment transfer if price > 0
  if (priceInSol > 0) {
    const treasuryWallet = process.env.TREASURY_WALLET_ADDRESS;
    if (treasuryWallet) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(payerWallet),
          toPubkey: new PublicKey(treasuryWallet),
          lamports: Math.floor(priceInSol * LAMPORTS_PER_SOL),
        })
      );
    }
  }
  
  return tx;
}

/**
 * Verifies an NFT exists and is owned by a wallet.
 */
export async function verifyNFTOwnership(
  mintAddress: string,
  walletAddress: string
): Promise<boolean> {
  const umi = getUmi();
  
  try {
    const asset = await fetchAssetV1(umi, publicKey(mintAddress));
    return asset.owner.toString() === walletAddress;
  } catch {
    return false;
  }
}

/**
 * Verifies a payment transaction on the blockchain.
 * Checks that the transaction:
 * - Is confirmed
 * - Contains a transfer from the payer to the treasury
 * - Has the correct amount
 */
export async function verifyPayment(
  signature: string,
  payerWallet: string,
  treasuryWallet: string,
  expectedAmountSol: number
): Promise<boolean> {
  const network = process.env.SOLANA_NETWORK || 'devnet';
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network as any);
  const connection = new Connection(rpcUrl, 'confirmed');
  
  try {
    // Fetch transaction details
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx) {
      console.error('[Payment] Transaction not found:', signature);
      return false;
    }
    
    if (tx.meta?.err) {
      console.error('[Payment] Transaction failed:', tx.meta.err);
      return false;
    }
    
    // Get pre and post balances to verify transfer
    const accountKeys = tx.transaction.message.getAccountKeys();
    const payerIndex = accountKeys.staticAccountKeys.findIndex(
      key => key.toString() === payerWallet
    );
    const treasuryIndex = accountKeys.staticAccountKeys.findIndex(
      key => key.toString() === treasuryWallet
    );
    
    if (payerIndex === -1 || treasuryIndex === -1) {
      console.error('[Payment] Payer or treasury not found in transaction');
      return false;
    }
    
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    
    // Calculate how much was sent to treasury
    const treasuryReceived = postBalances[treasuryIndex] - preBalances[treasuryIndex];
    const expectedLamports = Math.floor(expectedAmountSol * LAMPORTS_PER_SOL);
    
    // Allow 1% tolerance for fees
    const minExpected = expectedLamports * 0.99;
    
    if (treasuryReceived < minExpected) {
      console.error(`[Payment] Insufficient amount. Expected: ${expectedLamports}, Received: ${treasuryReceived}`);
      return false;
    }
    
    console.log(`[Payment] Verified! Treasury received ${treasuryReceived / LAMPORTS_PER_SOL} SOL`);
    return true;
    
  } catch (error) {
    console.error('[Payment] Verification error:', error);
    return false;
  }
}
