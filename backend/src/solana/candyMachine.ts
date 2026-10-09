import { generateSigner, publicKey, some, percentAmount } from '@metaplex-foundation/umi';
import {
  create,
  fetchCandyMachine,
  addConfigLines,
  setCandyMachineAuthority,
  mintFromCandyMachineV2,
} from '@metaplex-foundation/mpl-candy-machine';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { fetchCollectionV1 } from '@metaplex-foundation/mpl-core';
import { getUmi } from './umi.js';
import { Transaction } from '@solana/web3.js';

interface CreateCandyMachineParams {
  collectionAddress: string;
  itemsAvailable: number;
  price: number;
  startDate?: Date;
  endDate?: Date;
  mintLimit?: number;
}

interface CandyMachineState {
  itemsAvailable: number;
  itemsRedeemed: number;
  itemsRemaining: number;
  isMinting: boolean;
  price: number;
  goLiveDate: Date | null;
  endDate: Date | null;
}

/**
 * Creates a new Candy Machine for a tier.
 * Note: This is a simplified implementation. Full Candy Machine v3 setup
 * requires additional configuration for guards and minting.
 */
export async function createCandyMachine(params: CreateCandyMachineParams): Promise<string> {
  const umi = getUmi();
  
  const candyMachine = generateSigner(umi);
  const collectionPubkey = publicKey(params.collectionAddress);
  
  // Fetch collection to get proper reference
  const collection = await fetchCollectionV1(umi, collectionPubkey);
  
  const tx = await create(umi, {
    candyMachine,
    collectionMint: collection.publicKey,
    collectionUpdateAuthority: umi.identity,
    tokenStandard: 0, // NonFungible
    sellerFeeBasisPoints: percentAmount(5), // 5% royalty
    itemsAvailable: params.itemsAvailable,
    creators: [
      {
        address: umi.identity.publicKey,
        verified: true,
        percentageShare: 100,
      },
    ],
    isMutable: true,
    configLineSettings: some({
      prefixName: 'Member Pass #',
      nameLength: 10,
      prefixUri: '',
      uriLength: 200,
      isSequential: false,
    }),
  });
  
  await tx.sendAndConfirm(umi);
  
  console.log(`Created Candy Machine: ${candyMachine.publicKey.toString()}`);
  
  return candyMachine.publicKey.toString();
}

/**
 * Gets the current state of a Candy Machine.
 */
export async function getCandyMachineState(candyMachineAddress: string): Promise<CandyMachineState> {
  const umi = getUmi();
  
  const candyMachine = await fetchCandyMachine(umi, publicKey(candyMachineAddress));
  
  const itemsAvailable = Number(candyMachine.data.itemsAvailable);
  const itemsRedeemed = Number(candyMachine.itemsRedeemed);
  
  return {
    itemsAvailable,
    itemsRedeemed,
    itemsRemaining: itemsAvailable - itemsRedeemed,
    isMinting: itemsRedeemed < itemsAvailable,
    price: 0, // Would need to fetch from candy guard
    goLiveDate: null,
    endDate: null,
  };
}

/**
 * Updates Candy Machine settings.
 */
export async function updateCandyMachineSettings(
  candyMachineAddress: string,
  settings: Partial<{
    isMutable: boolean;
    authority: string;
  }>
): Promise<void> {
  const umi = getUmi();
  const cmPublicKey = publicKey(candyMachineAddress);
  
  if (settings.authority) {
    await (await setCandyMachineAuthority(umi, {
      candyMachine: cmPublicKey,
      authority: umi.identity,
      newAuthority: publicKey(settings.authority),
    })).sendAndConfirm(umi);
  }
}

/**
 * Prepares a mint transaction from Candy Machine for user to sign.
 * Returns an empty Transaction - full implementation requires proper
 * serialization for frontend signing.
 */
export async function prepareCandyMachineMint(
  candyMachineAddress: string,
  collectionAddress: string,
  payerWallet: string
): Promise<Transaction> {
  const umi = getUmi();
  
  const candyMachinePublicKey = publicKey(candyMachineAddress);
  const collectionPublicKey = publicKey(collectionAddress);
  const payer = publicKey(payerWallet);
  
  const nftMint = generateSigner(umi);
  
  // Fetch collection for proper reference
  const collection = await fetchCollectionV1(umi, collectionPublicKey);
  
  const builder = mintFromCandyMachineV2(umi, {
    candyMachine: candyMachinePublicKey,
    mintAuthority: umi.identity,
    nftMint,
    nftOwner: payer,
    collectionMint: collection.publicKey,
    collectionUpdateAuthority: umi.identity.publicKey,
  }).prepend(setComputeUnitLimit(umi, { units: 800_000 }));
  
  await builder.buildAndSign(umi);
  
  // Note: In production, properly serialize the UMI transaction for web3.js
  return new Transaction();
}

/**
 * Add config lines to Candy Machine (for setting up NFT metadata).
 */
export async function addConfigLinesToCandyMachine(
  candyMachineAddress: string,
  configLines: Array<{ name: string; uri: string }>
): Promise<void> {
  const umi = getUmi();
  
  const candyMachinePublicKey = publicKey(candyMachineAddress);
  
  const tx = await addConfigLines(umi, {
    candyMachine: candyMachinePublicKey,
    index: 0,
    configLines: configLines.map(line => ({
      name: line.name,
      uri: line.uri,
    })),
  });
  
  await tx.sendAndConfirm(umi);
}
