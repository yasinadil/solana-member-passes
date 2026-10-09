'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Download,
  FileSpreadsheet,
  Layers,
  Wallet,
  Plane,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, type Tier } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ExportPage() {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [walletsToVerify, setWalletsToVerify] = useState('');

  useEffect(() => {
    loadTiers();
  }, []);

  async function loadTiers() {
    try {
      const res = await api.getTiers();
      setTiers(res.data);
    } catch (error) {
      console.error('Failed to load tiers:', error);
    }
  }

  async function handleExport(type: string, params?: Record<string, string>) {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in again',
        variant: 'destructive',
      });
      return;
    }

    setLoading(type);
    
    try {
      const queryString = params ? `?${new URLSearchParams(params)}` : '';
      const url = `${API_URL}/api/export/${type}${queryString}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const filename = response.headers.get('Content-Disposition')?.split('filename=')[1] || `${type}_export.csv`;
      
      // Download file
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename.replace(/"/g, '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Export successful',
        description: `Downloaded ${filename}`,
      });
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  }

  async function handleVerifyWallets() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in again',
        variant: 'destructive',
      });
      return;
    }

    const wallets = walletsToVerify
      .split('\n')
      .map(w => w.trim())
      .filter(w => w.length >= 32);

    if (wallets.length === 0) {
      toast({
        title: 'No valid wallets',
        description: 'Please enter valid wallet addresses',
        variant: 'destructive',
      });
      return;
    }

    setLoading('verify-wallets');
    
    try {
      const response = await fetch(`${API_URL}/api/export/verify-wallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ wallets }),
      });
      
      if (!response.ok) {
        throw new Error('Verification failed');
      }
      
      const blob = await response.blob();
      const filename = `wallet_verification_${Date.now()}.csv`;
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Verification complete',
        description: `Verified ${wallets.length} wallets against blockchain`,
      });
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  }

  const exports = [
    {
      id: 'tiers',
      title: 'Tier Statistics',
      description: 'Export tier configuration and minting statistics',
      icon: Layers,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      action: () => handleExport('tiers'),
    },
    {
      id: 'wallets',
      title: 'Wallet List',
      description: 'Export whitelist and blacklist entries',
      icon: Wallet,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
      action: () => handleExport('wallets'),
    },
    {
      id: 'airdrops',
      title: 'Airdrops Summary',
      description: 'Export all airdrop campaigns and their status',
      icon: Plane,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      action: () => handleExport('airdrops'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export Data</h1>
        <p className="text-muted-foreground">Download data as CSV for analytics and marketing</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {exports.map((exp, i) => (
          <motion.div
            key={exp.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${exp.bgColor}`}>
                    <exp.icon className={`w-6 h-6 ${exp.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{exp.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{exp.description}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={exp.action}
                      disabled={loading === exp.id}
                    >
                      {loading === exp.id ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Exporting...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Download CSV
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Real-time Wallet Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Verify Wallets (Real-time Blockchain)
          </CardTitle>
          <CardDescription>
            Check NFT holdings for a list of wallets by querying the Solana blockchain in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="wallets">Wallet Addresses (one per line, max 100)</Label>
            <textarea
              id="wallets"
              value={walletsToVerify}
              onChange={(e) => setWalletsToVerify(e.target.value)}
              placeholder="Paste wallet addresses here..."
              className="w-full h-32 mt-2 px-3 py-2 text-sm rounded-lg border border-input bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {walletsToVerify.split('\n').filter(w => w.trim().length >= 32).length} valid addresses detected
            </p>
          </div>
          
          <Button
            onClick={handleVerifyWallets}
            disabled={loading === 'verify-wallets' || walletsToVerify.trim().length === 0}
          >
            {loading === 'verify-wallets' ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Verifying on blockchain...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Verify & Export CSV
              </span>
            )}
          </Button>
          
          <p className="text-sm text-muted-foreground">
            This queries the Solana blockchain in real-time to check which NFTs each wallet holds.
            Results include tier access and NFT counts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
