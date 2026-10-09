import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { mplCandyMachine } from '@metaplex-foundation/mpl-candy-machine';
import { keypairIdentity, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

let umiInstance: ReturnType<typeof createUmi> | null = null;

export function getUmi() {
  if (umiInstance) {
    return umiInstance;
  }

  const network = process.env.SOLANA_NETWORK || 'devnet';
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network as any);

  const umi = createUmi(rpcUrl)
    .use(mplCore())
    .use(mplCandyMachine());

  // Set up authority keypair if provided
  const authorityPrivateKey = process.env.SOLANA_AUTHORITY_PRIVATE_KEY;
  if (authorityPrivateKey) {
    try {
      const secretKey = bs58.decode(authorityPrivateKey);
      const web3Keypair = Keypair.fromSecretKey(secretKey);
      const keypair = fromWeb3JsKeypair(web3Keypair);
      const signer = createSignerFromKeypair(umi, keypair);
      umi.use(keypairIdentity(signer));
    } catch (error) {
      console.error('Failed to parse authority keypair:', error);
    }
  }

  umiInstance = umi;
  return umi;
}

export function getAuthorityPublicKey(): string | null {
  const umi = getUmi();
  if (umi.identity.publicKey) {
    return umi.identity.publicKey.toString();
  }
  return null;
}
