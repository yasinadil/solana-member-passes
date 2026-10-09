'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Layers, 
  Users, 
  Coins, 
  TrendingUp, 
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi, type DashboardStats } from '@/lib/api';
import { formatNumber, formatAddress } from '@/lib/utils';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      
      const res = await adminApi.getStats(token);
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total NFTs',
      value: formatNumber(stats?.totalNFTs || 0),
      icon: Coins,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Unique Holders',
      value: formatNumber(stats?.uniqueHolders || 0),
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Active Tiers',
      value: stats?.tiers.filter(t => t.mintingOpen).length || 0,
      icon: Layers,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Recent Mints',
      value: stats?.recentMints.length || 0,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      subtitle: 'Last 24h',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your NFT collections and minting activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                {stat.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tier Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tier Progress</CardTitle>
            <CardDescription>Minting progress for each tier</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {stats?.tiers.map((tier) => {
              const progress = tier.supplyCap 
                ? (tier.mintedCount / tier.supplyCap) * 100 
                : null;
              
              return (
                <div key={tier.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tier.name}</span>
                      {tier.mintingOpen ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
                          Open
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                          Closed
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(tier.mintedCount)} / {tier.supplyCap ? formatNumber(tier.supplyCap) : '∞'}
                    </span>
                  </div>
                  
                  {progress !== null && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Mints */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Mints</CardTitle>
            <CardDescription>Latest minting activity</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentMints.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent mints</p>
            ) : (
              <div className="space-y-4">
                {stats?.recentMints.map((mint, i) => {
                  const tier = stats.tiers.find(t => t.id === mint.tierId);
                  const mintDate = new Date(mint.mintedAt);
                  
                  return (
                    <div 
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ArrowUpRight className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-mono text-sm">
                            {formatAddress(mint.walletAddress, 6)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tier?.name || 'Unknown'} tier
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {mintDate.toLocaleTimeString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {mintDate.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

