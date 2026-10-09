'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Shield, Zap, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, type Tier, type MintStatus, type MintConfig } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { formatNumber } from '@/lib/utils';
import { NFTImage } from '@/components/ui/nft-image';
import Link from 'next/link';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  clusterApiUrl 
} from '@solana/web3.js';
import type { Provider } from '@reown/appkit-adapter-solana/react';

const tierGradients: Record<string, string> = {
  Bronze: 'from-amber-900 via-amber-700 to-amber-600',
  Silver: 'from-slate-400 via-slate-300 to-slate-200',
  Gold: 'from-yellow-600 via-yellow-400 to-yellow-300',
  Platinum: 'from-slate-300 via-slate-100 to-white',
  Diamond: 'from-cyan-300 via-sky-200 to-blue-100',
};

const tierBorders: Record<string, string> = {
  Bronze: 'border-amber-700/50',
  Silver: 'border-slate-400/50',
  Gold: 'border-yellow-500/50',
  Platinum: 'border-slate-300/50',
  Diamond: 'border-cyan-400/50',
};

export default function HomePage() {
  // Use Reown AppKit hooks for wallet connection
  const { address: walletAddress, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('solana');
  const { toast } = useToast();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [mintStatuses, setMintStatuses] = useState<Record<string, MintStatus>>({});
  const [mintConfig, setMintConfig] = useState<MintConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState<string | null>(null);

  useEffect(() => {
    loadTiers();
    loadMintConfig();
  }, []);

  async function loadTiers() {
    try {
      const res = await api.getTiers();
      setTiers(res.data);
      
      // Load mint status for each tier
      const statuses: Record<string, MintStatus> = {};
      for (const tier of res.data) {
        try {
          const statusRes = await api.getMintStatus(tier.id);
          statuses[tier.id] = statusRes.data;
        } catch (e) {
          // Ignore individual tier errors
        }
      }
      setMintStatuses(statuses);
    } catch (error) {
      console.error('Failed to load tiers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMintConfig() {
    try {
      const res = await api.getMintConfig();
      setMintConfig(res.data);
    } catch (error) {
      console.error('Failed to load mint config:', error);
    }
  }

  const handleMint = useCallback(async (tierId: string) => {
    if (!walletAddress) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    const tier = tiers.find(t => t.id === tierId);
    if (!tier) {
      toast({
        title: 'Error',
        description: 'Tier not found',
        variant: 'destructive',
      });
      return;
    }

    setMinting(tierId);
    
    try {
      let paymentSignature: string | undefined;
      
      // If tier has a price, process payment first
      if (tier.price > 0) {
        if (!walletProvider) {
          toast({
            title: 'Wallet not ready',
            description: 'Please reconnect your wallet',
            variant: 'destructive',
          });
          setMinting(null);
          return;
        }

        if (!mintConfig?.treasuryWallet) {
          toast({
            title: 'Configuration error',
            description: 'Treasury wallet not configured',
            variant: 'destructive',
          });
          setMinting(null);
          return;
        }

        toast({
          title: 'Payment Required',
          description: `Please approve the ${tier.price} SOL payment in your wallet`,
        });

        try {
          // Create payment transaction
          const network = mintConfig.network || 'devnet';
          const connection = new Connection(
            network === 'mainnet-beta' 
              ? 'https://api.mainnet-beta.solana.com' 
              : clusterApiUrl(network as any),
            'confirmed'
          );
          
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          
          const transaction = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: new PublicKey(walletAddress),
          });
          
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: new PublicKey(walletAddress),
              toPubkey: new PublicKey(mintConfig.treasuryWallet),
              lamports: Math.floor(tier.price * LAMPORTS_PER_SOL),
            })
          );
          
          // Sign and send transaction using wallet provider
          const signature = await walletProvider.sendTransaction(transaction, connection);
          
          // Wait for confirmation
          toast({
            title: 'Payment sent',
            description: 'Waiting for confirmation...',
          });
          
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
          }, 'confirmed');
          
          paymentSignature = signature;
          
          toast({
            title: 'Payment confirmed!',
            description: 'Minting your NFT...',
          });
          
        } catch (paymentError: unknown) {
          console.error('Payment error:', paymentError);
          
          // Check if user rejected the transaction
          const errorMessage = paymentError instanceof Error ? paymentError.message : String(paymentError);
          const isUserRejection = 
            errorMessage.toLowerCase().includes('rejected') ||
            errorMessage.toLowerCase().includes('cancelled') ||
            errorMessage.toLowerCase().includes('canceled') ||
            errorMessage.toLowerCase().includes('user rejected') ||
            errorMessage.toLowerCase().includes('user denied') ||
            errorMessage.includes('4001') || // Standard wallet rejection code
            errorMessage.includes('User rejected');
          
          if (isUserRejection) {
            toast({
              title: 'Transaction cancelled',
              description: 'You cancelled the payment request',
            });
          } else {
            toast({
              title: 'Payment failed',
              description: errorMessage || 'Transaction failed. Please try again.',
              variant: 'destructive',
            });
          }
          
          setMinting(null);
          return;
        }
      }
      
      // Call mint API (with payment signature if applicable)
      const res = await api.mint(tierId, walletAddress, paymentSignature);
      
      toast({
        title: 'Mint successful! 🎉',
        description: `You minted ${res.data.tier} #${res.data.tokenNumber}`,
        variant: 'success' as any,
      });
      
      // Refresh mint status
      const statusRes = await api.getMintStatus(tierId);
      setMintStatuses(prev => ({ ...prev, [tierId]: statusRes.data }));
      
    } catch (error: unknown) {
      console.error('Mint error:', error);
      
      // Safely extract error message
      let errorMessage = 'Something went wrong';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      
      // Check if it's a user rejection that somehow bubbled up
      const isUserRejection = 
        errorMessage.toLowerCase().includes('rejected') ||
        errorMessage.toLowerCase().includes('cancelled') ||
        errorMessage.toLowerCase().includes('canceled') ||
        errorMessage.toLowerCase().includes('user denied');
      
      if (isUserRejection) {
        toast({
          title: 'Cancelled',
          description: 'The operation was cancelled',
        });
      } else {
        toast({
          title: 'Mint failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setMinting(null);
    }
  }, [toast, walletAddress, walletProvider, tiers, mintConfig]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gold/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-black" />
            </div>
            <span className="text-xl font-bold tracking-tight">Member Pass NFT</span>
          </div>
          
          <nav className="flex items-center gap-4">
            {isConnected && (
              <Link href="/my-nfts" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                My NFTs
              </Link>
            )}
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Admin
            </Link>
            {/* Reown AppKit Connect Button */}
            <appkit-button />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-white via-primary to-gold bg-clip-text text-transparent">
              Member Pass NFT Collection
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Exclusive membership NFTs on Solana. Unlock trading benefits, earn rewards, 
            and join the Member Pass ecosystem with your tier.
          </p>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
          {[
            { icon: Shield, title: 'Verified Ownership', desc: 'On-chain proof of membership' },
            { icon: Zap, title: 'Trading Benefits', desc: 'Reduced fees & priority access' },
            { icon: Sparkles, title: 'Exclusive Rewards', desc: 'Airdrops & special events' },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="glass rounded-xl p-6 text-center"
            >
              <feature.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* NFT Tiers */}
      <section className="relative z-10 container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-center mb-12">Choose Your Tier</h2>
        
        {loading ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {tiers.map((tier, i) => {
              const status = mintStatuses[tier.id];
              const gradient = tierGradients[tier.name] || tierGradients.Bronze;
              const borderColor = tierBorders[tier.name] || tierBorders.Bronze;
              
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                >
                  <Card className={`relative overflow-hidden border-2 ${borderColor} bg-card/50 backdrop-blur-xl hover:scale-[1.02] transition-transform duration-300`}>
                    {/* Tier badge gradient overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`} />
                    
                    <CardHeader className="relative">
                      {/* NFT Image placeholder */}
                      <div className={`w-full aspect-square rounded-lg bg-gradient-to-br ${gradient} mb-4 flex items-center justify-center overflow-hidden`}>
                        {tier.artworkUrl ? (
                          <NFTImage 
                            metadataUrl={tier.artworkUrl} 
                            alt={tier.name}
                            className="w-full h-full object-cover"
                            fallback={<span className="text-6xl font-bold text-black/20">{tier.name[0]}</span>}
                          />
                        ) : (
                          <span className="text-6xl font-bold text-black/20">{tier.name[0]}</span>
                        )}
                      </div>
                      
                      <CardTitle className="text-2xl">{tier.name}</CardTitle>
                      <CardDescription>{tier.description}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="relative space-y-4">
                      {/* Supply info */}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Supply</span>
                        <span className="font-mono">
                          {formatNumber(tier.mintedCount)} / {tier.supplyCap ? formatNumber(tier.supplyCap) : '∞'}
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      {tier.supplyCap && (
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                            style={{ width: `${(tier.mintedCount / tier.supplyCap) * 100}%` }}
                          />
                        </div>
                      )}
                      
                      {/* Price */}
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-sm">Price</span>
                        <span className="text-xl font-bold">{tier.price} SOL</span>
                      </div>
                      
                      {/* Mint button */}
                      {tier.mintingOpen && status?.canMint ? (
                        <Button
                          className="w-full"
                          size="lg"
                          variant={tier.name.toLowerCase() as any}
                          disabled={minting === tier.id}
                          onClick={() => handleMint(tier.id)}
                        >
                          {minting === tier.id ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              Minting...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              Mint Now
                              <ChevronRight className="w-4 h-4" />
                            </span>
                          )}
                        </Button>
                      ) : (
                        <Button className="w-full" size="lg" variant="secondary" disabled>
                          {tier.supplyCap && tier.mintedCount >= tier.supplyCap 
                            ? 'Sold Out' 
                            : 'Minting Closed'}
                        </Button>
                      )}
                      
                      {/* Collection link */}
                      {tier.collectionAddress && (
                        <a
                          href={`https://solscan.io/token/${tier.collectionAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          View on Solscan
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Member Pass. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
