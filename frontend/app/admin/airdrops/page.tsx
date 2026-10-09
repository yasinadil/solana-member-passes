'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Plane,
  Play,
  XCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye
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
import { api, adminApi, type Airdrop, type Tier, type CreateAirdropData } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { formatAddress, formatNumber } from '@/lib/utils';

const statusIcons = {
  PENDING: Clock,
  IN_PROGRESS: Play,
  COMPLETED: CheckCircle,
  FAILED: AlertCircle,
  CANCELLED: XCircle,
};

const statusColors = {
  PENDING: 'text-yellow-500 bg-yellow-500/10',
  IN_PROGRESS: 'text-blue-500 bg-blue-500/10',
  COMPLETED: 'text-green-500 bg-green-500/10',
  FAILED: 'text-red-500 bg-red-500/10',
  CANCELLED: 'text-gray-500 bg-gray-500/10',
};

export default function AirdropsPage() {
  const { toast } = useToast();
  const [airdrops, setAirdrops] = useState<Airdrop[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAirdrop, setSelectedAirdrop] = useState<Airdrop | null>(null);
  const [formData, setFormData] = useState<CreateAirdropData>({
    tierId: '',
    name: '',
    description: '',
    recipients: [],
  });
  const [recipientText, setRecipientText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const [airdropsRes, tiersRes] = await Promise.all([
        adminApi.getAirdrops(token),
        api.getTiers(),
      ]);
      setAirdrops(airdropsRes.data);
      setTiers(tiersRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAirdropDetails(id: string) {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const res = await adminApi.getAirdrop(id, token);
      setSelectedAirdrop(res.data);
      setDetailDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  function parseRecipients(text: string) {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length >= 32)
      .map(wallet => ({ walletAddress: wallet, quantity: 1 }));
  }

  async function handleCreate() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const recipients = parseRecipients(recipientText);
    
    if (recipients.length === 0) {
      toast({
        title: 'No valid recipients',
        description: 'Please enter valid wallet addresses',
        variant: 'destructive',
      });
      return;
    }

    try {
      await adminApi.createAirdrop({
        ...formData,
        recipients,
      }, token);
      
      toast({ title: 'Airdrop created successfully' });
      setCreateDialogOpen(false);
      setFormData({ tierId: '', name: '', description: '', recipients: [] });
      setRecipientText('');
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function handleExecute(airdrop: Airdrop) {
    if (!confirm(`Start airdrop "${airdrop.name}"? This will mint NFTs to ${airdrop.totalRecipients} recipients.`)) {
      return;
    }
    
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      await adminApi.executeAirdrop(airdrop.id, token);
      toast({ title: 'Airdrop started', description: 'Minting in progress...' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function handleCancel(airdrop: Airdrop) {
    if (!confirm(`Cancel airdrop "${airdrop.name}"?`)) return;
    
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      await adminApi.cancelAirdrop(airdrop.id, token);
      toast({ title: 'Airdrop cancelled' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Airdrops</h1>
          <p className="text-muted-foreground">Manage NFT airdrops to multiple wallets</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Airdrop
        </Button>
      </div>

      {/* Airdrops List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : airdrops.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Plane className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No airdrops created yet</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Airdrop
              </Button>
            </CardContent>
          </Card>
        ) : (
          airdrops.map((airdrop, i) => {
            const StatusIcon = statusIcons[airdrop.status];
            const statusColor = statusColors[airdrop.status];
            const tier = tiers.find(t => t.id === airdrop.tierId);
            
            return (
              <motion.div
                key={airdrop.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${statusColor}`}>
                          <StatusIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{airdrop.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {tier?.name || 'Unknown'} tier • {airdrop.totalRecipients} recipients
                          </p>
                          {airdrop.description && (
                            <p className="text-sm text-muted-foreground mt-1">{airdrop.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadAirdropDetails(airdrop.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                        
                        {airdrop.status === 'PENDING' && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleExecute(airdrop)}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Execute
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(airdrop)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress bar for completed/in-progress */}
                    {(airdrop.status === 'COMPLETED' || airdrop.status === 'IN_PROGRESS') && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Progress</span>
                          <span>
                            {airdrop.successCount} / {airdrop.totalRecipients}
                            {airdrop.failedCount > 0 && (
                              <span className="text-red-500 ml-2">({airdrop.failedCount} failed)</span>
                            )}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(airdrop.successCount / airdrop.totalRecipients) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Create Airdrop Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Airdrop</DialogTitle>
            <DialogDescription>
              Create a new NFT airdrop to multiple wallets
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tier">Select Tier</Label>
              <select
                id="tier"
                value={formData.tierId}
                onChange={(e) => setFormData({ ...formData, tierId: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
              >
                <option value="">Select a tier...</option>
                {tiers.filter(t => t.collectionAddress).map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} ({tier.supplyCap ? `${tier.mintedCount}/${tier.supplyCap}` : 'Unlimited'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Airdrop Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Gold Tier Launch Airdrop"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notes about this airdrop..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="recipients">Recipients (one wallet per line)</Label>
              <textarea
                id="recipients"
                value={recipientText}
                onChange={(e) => setRecipientText(e.target.value)}
                placeholder="Paste wallet addresses here"
                className="w-full h-40 px-3 py-2 text-sm rounded-lg border border-input bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                {parseRecipients(recipientText).length} valid wallets detected
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!formData.tierId || !formData.name || parseRecipients(recipientText).length === 0}
            >
              Create Airdrop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Airdrop Details Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAirdrop?.name}</DialogTitle>
            <DialogDescription>
              Airdrop details and recipient status
            </DialogDescription>
          </DialogHeader>

          {selectedAirdrop && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{selectedAirdrop.totalRecipients}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-500">{selectedAirdrop.successCount}</p>
                  <p className="text-sm text-muted-foreground">Success</p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-red-500">{selectedAirdrop.failedCount}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>

              <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
                {selectedAirdrop.recipients?.map((recipient) => (
                  <div 
                    key={recipient.id}
                    className="flex items-center justify-between p-3 text-sm"
                  >
                    <code className="font-mono text-xs">
                      {formatAddress(recipient.walletAddress, 8)}
                    </code>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      recipient.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' :
                      recipient.status === 'FAILED' ? 'bg-red-500/10 text-red-500' :
                      recipient.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>
                      {recipient.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

