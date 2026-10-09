'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ExternalLink, Wallet, ArrowLeft, Crown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, type TokenGatingResult, type WalletTierInfo } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { formatAddress } from '@/lib/utils';
import { NFTImage } from '@/components/ui/nft-image';
import Link from 'next/link';
import { useAppKitAccount } from '@reown/appkit/react';

const tierGradients: Record<string, string> = {
  Bronze: 'from-amber-900 via-amber-700 to-amber-600',
  Silver: 'from-slate-400 via-slate-300 to-slate-200',
  Gold: 'from-yellow-600 via-yellow-400 to-yellow-300',
  Platinum: 'from-slate-300 via-slate-100 to-white',
  Diamond: 'from-cyan-300 via-sky-200 to-blue-100',
};

const tierBorders: Record<string, string> = {
  Bronze: 'border-amber-700/50 hover:border-amber-600',
  Silver: 'border-slate-400/50 hover:border-slate-300',
  Gold: 'border-yellow-500/50 hover:border-yellow-400',
  Platinum: 'border-slate-300/50 hover:border-slate-200',
  Diamond: 'border-cyan-400/50 hover:border-cyan-300',
};

const tierBgGlow: Record<string, string> = {
  Bronze: 'shadow-amber-500/20',
  Silver: 'shadow-slate-400/20',
  Gold: 'shadow-yellow-500/20',
  Platinum: 'shadow-slate-300/20',
  Diamond: 'shadow-cyan-400/20',
};

export default function MyNFTsPage() {
  const { address: walletAddress, isConnected } = useAppKitAccount();
  const { toast } = useToast();
  const [tokenGatingData, setTokenGatingData] = useState<TokenGatingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      loadNFTs();
    } else {
      setTokenGatingData(null);
    }
  }, [walletAddress]);

  async function loadNFTs() {
    if (!walletAddress) return;
    
    setLoading(true);
    try {
      const res = await api.checkTokenGating(walletAddress);
      setTokenGatingData(res.data);
    } catch (error: any) {
      console.error('Failed to load NFTs:', error);
      toast({
        title: 'Error loading NFTs',
        description: error.message || 'Failed to fetch your NFTs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadNFTs();
    setRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Your NFT collection has been updated',
    });
  }

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
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-black" />
              </div>
              <span className="text-xl font-bold tracking-tight">Member Pass NFT</span>
            </Link>
          </div>
          
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back to Mint
            </Link>
            <appkit-button />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-white via-primary to-gold bg-clip-text text-transparent">
                My NFT Collection
              </span>
            </h1>
            {walletAddress && (
              <p className="text-muted-foreground flex items-center justify-center gap-2">
                <Wallet className="w-4 h-4" />
                {formatAddress(walletAddress, 6)}
              </p>
            )}
          </motion.div>
        </div>

        {/* Not Connected State */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto"
          >
            <Card className="border-2 border-dashed border-border/50 bg-card/30 backdrop-blur-xl">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
                  <Wallet className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
                <p className="text-muted-foreground mb-6">
                  Connect your wallet to view your Member Pass NFT collection
                </p>
                <appkit-button />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Loading State */}
        {isConnected && loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground">Loading your NFTs...</p>
          </div>
        )}

        {/* Connected with NFTs */}
        {isConnected && !loading && tokenGatingData && (
          <>
            {/* Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-wrap items-center justify-center gap-6 mb-12"
            >
              <div className="glass rounded-xl px-6 py-4 text-center">
                <div className="text-3xl font-bold text-primary">{tokenGatingData.totalNFTs}</div>
                <div className="text-sm text-muted-foreground">Total NFTs</div>
              </div>
              
              {tokenGatingData.highestTier && (
                <div className="glass rounded-xl px-6 py-4 text-center">
                  <div className="text-3xl font-bold flex items-center gap-2 justify-center">
                    <Crown className="w-6 h-6 text-yellow-500" />
                    {tokenGatingData.highestTier}
                  </div>
                  <div className="text-sm text-muted-foreground">Highest Tier</div>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </motion.div>

            {/* No NFTs State */}
            {tokenGatingData.totalNFTs === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md mx-auto"
              >
                <Card className="border-2 border-dashed border-border/50 bg-card/30 backdrop-blur-xl">
                  <CardContent className="py-16 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No NFTs Yet</h2>
                    <p className="text-muted-foreground mb-6">
                      You don't own any Member Pass NFTs yet. Mint your first one!
                    </p>
                    <Link href="/">
                      <Button className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Mint NFT
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* NFTs Grid by Tier */}
            {tokenGatingData.tiers.map((tierInfo, tierIndex) => (
              <motion.section
                key={tierInfo.tierId}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + tierIndex * 0.1 }}
                className="mb-12"
              >
                {/* Tier Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${tierGradients[tierInfo.tier] || tierGradients.Bronze}`} />
                  <h2 className="text-2xl font-bold">{tierInfo.tier}</h2>
                  <span className="text-muted-foreground">({tierInfo.count} NFT{tierInfo.count !== 1 ? 's' : ''})</span>
                </div>

                {/* NFTs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {tierInfo.nfts.map((nft, nftIndex) => {
                    const gradient = tierGradients[tierInfo.tier] || tierGradients.Bronze;
                    const border = tierBorders[tierInfo.tier] || tierBorders.Bronze;
                    const glow = tierBgGlow[tierInfo.tier] || tierBgGlow.Bronze;
                    
                    return (
                      <motion.div
                        key={nft.mintAddress}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + nftIndex * 0.05 }}
                      >
                        <Card className={`group relative overflow-hidden border-2 ${border} bg-card/50 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${glow}`}>
                          {/* Gradient overlay */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
                          
                          <CardContent className="p-3">
                            {/* NFT Image */}
                            <div className={`aspect-square rounded-lg bg-gradient-to-br ${gradient} mb-3 overflow-hidden`}>
                              <NFTImage
                                metadataUrl={nft.uri}
                                alt={nft.name}
                                className="w-full h-full object-cover"
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-4xl font-bold text-black/20">{tierInfo.tier[0]}</span>
                                  </div>
                                }
                              />
                            </div>
                            
                            {/* NFT Info */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-sm truncate" title={nft.name}>
                                {nft.name}
                              </h3>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {formatAddress(nft.mintAddress, 4)}
                                </span>
                                
                                <a
                                  href={`https://solscan.io/token/${nft.mintAddress}?cluster=devnet`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  title="View on Solscan"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            ))}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Member Pass. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

