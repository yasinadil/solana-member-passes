'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Search,
  Shield,
  Ban,
  Clock,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminApi, type WalletEntry, type AddWalletData } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { formatAddress } from '@/lib/utils';

type WalletType = 'WHITELIST' | 'BLACKLIST';

export default function WalletsPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WalletType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [formData, setFormData] = useState<AddWalletData>({
    walletAddress: '',
    type: 'WHITELIST',
    reason: '',
  });
  const [bulkWallets, setBulkWallets] = useState('');
  const [bulkType, setBulkType] = useState<WalletType>('WHITELIST');

  useEffect(() => {
    loadWallets();
  }, [filter]);

  async function loadWallets() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const params: any = {};
      if (filter !== 'ALL') params.type = filter;
      
      const res = await adminApi.getWallets(token, params);
      setEntries(res.data);
    } catch (error) {
      console.error('Failed to load wallets:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      await adminApi.addWallet(formData, token);
      toast({ title: 'Wallet added successfully' });
      setDialogOpen(false);
      setFormData({ walletAddress: '', type: 'WHITELIST', reason: '' });
      loadWallets();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function handleBulkAdd() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const wallets = bulkWallets
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

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/wallets/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          wallets,
          type: bulkType,
          reason: 'Bulk import',
        }),
      });
      
      const data = await res.json();
      
      toast({ 
        title: 'Bulk import complete',
        description: `Added: ${data.data.created}, Skipped: ${data.data.skipped}`,
      });
      setBulkDialogOpen(false);
      setBulkWallets('');
      loadWallets();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function handleRemove(entry: WalletEntry) {
    if (!confirm(`Remove ${entry.walletAddress.slice(0, 8)}... from ${entry.type.toLowerCase()}?`)) {
      return;
    }
    
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      await adminApi.removeWallet(entry.id, token);
      toast({ title: 'Wallet removed' });
      loadWallets();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  const filteredEntries = entries.filter(e => 
    search === '' || e.walletAddress.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet Management</h1>
          <p className="text-muted-foreground">Manage whitelist and blacklist entries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Wallet
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          {(['ALL', 'WHITELIST', 'BLACKLIST'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === type 
                  ? 'bg-background text-foreground shadow' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type === 'ALL' ? 'All' : type === 'WHITELIST' ? 'Whitelist' : 'Blacklist'}
            </button>
          ))}
        </div>
        
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by wallet address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Wallet List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No wallet entries found
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredEntries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      entry.type === 'WHITELIST' 
                        ? 'bg-green-500/10 text-green-500' 
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {entry.type === 'WHITELIST' ? <Shield className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-mono text-sm">{entry.walletAddress}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className={`px-2 py-0.5 rounded-full ${
                          entry.type === 'WHITELIST' 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {entry.type}
                        </span>
                        {entry.reason && <span>• {entry.reason}</span>}
                        {entry.expiresAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Expires: {new Date(entry.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(entry)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Wallet Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Wallet</DialogTitle>
            <DialogDescription>
              Add a wallet to the whitelist or blacklist
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="walletAddress">Wallet Address</Label>
              <Input
                id="walletAddress"
                value={formData.walletAddress}
                onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                placeholder="Enter Solana wallet address"
                className="font-mono"
              />
            </div>

            <div className="grid gap-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(['WHITELIST', 'BLACKLIST'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData({ ...formData, type })}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      formData.type === type
                        ? type === 'WHITELIST'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500 bg-red-500/10'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {type === 'WHITELIST' ? (
                        <Shield className={`w-4 h-4 ${formData.type === type ? 'text-green-500' : ''}`} />
                      ) : (
                        <Ban className={`w-4 h-4 ${formData.type === type ? 'text-red-500' : ''}`} />
                      )}
                      <span className="font-medium">{type}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., VIP member, Abuse detected..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add Wallet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Wallets</DialogTitle>
            <DialogDescription>
              Paste wallet addresses (one per line)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(['WHITELIST', 'BLACKLIST'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBulkType(type)}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                      bulkType === type
                        ? type === 'WHITELIST'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500 bg-red-500/10'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bulkWallets">Wallet Addresses</Label>
              <textarea
                id="bulkWallets"
                value={bulkWallets}
                onChange={(e) => setBulkWallets(e.target.value)}
                placeholder="Paste wallet addresses here (one per line)"
                className="w-full h-48 px-3 py-2 text-sm rounded-lg border border-input bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                {bulkWallets.split('\n').filter(w => w.trim().length >= 32).length} valid addresses detected
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAdd}>Import Wallets</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

