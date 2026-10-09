'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Rocket
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { api, adminApi, type Tier, type CreateTierData } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { formatNumber } from '@/lib/utils';
import { NFTImage } from '@/components/ui/nft-image';

export default function TiersPage() {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [formData, setFormData] = useState<CreateTierData>({
    name: '',
    description: '',
    artworkUrl: '',
    displayOrder: 0,
    supplyCap: null,
    mintingOpen: false,
    price: 0,
  });

  useEffect(() => {
    loadTiers();
  }, []);

  async function loadTiers() {
    try {
      const res = await api.getTiers();
      setTiers(res.data);
    } catch (error) {
      console.error('Failed to load tiers:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTier(null);
    setFormData({
      name: '',
      description: '',
      artworkUrl: '',
      displayOrder: tiers.length,
      supplyCap: null,
      mintingOpen: false,
      price: 0,
    });
    setDialogOpen(true);
  }

  function openEditDialog(tier: Tier) {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      description: tier.description,
      artworkUrl: tier.artworkUrl,
      displayOrder: tier.displayOrder,
      supplyCap: tier.supplyCap,
      mintingOpen: tier.mintingOpen,
      price: tier.price,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      if (editingTier) {
        await adminApi.updateTier(editingTier.id, formData, token);
        toast({ title: 'Tier updated successfully' });
      } else {
        await adminApi.createTier(formData, token);
        toast({ title: 'Tier created successfully' });
      }
      setDialogOpen(false);
      loadTiers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function handleDelete(tier: Tier) {
    if (!confirm(`Are you sure you want to delete "${tier.name}"?`)) return;
    
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      await adminApi.deleteTier(tier.id, token);
      toast({ title: 'Tier deleted' });
      loadTiers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function handleToggleMinting(tier: Tier) {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      await adminApi.updateTier(tier.id, { mintingOpen: !tier.mintingOpen }, token);
      toast({ 
        title: tier.mintingOpen ? 'Minting closed' : 'Minting opened',
        description: `${tier.name} minting is now ${tier.mintingOpen ? 'closed' : 'open'}`,
      });
      loadTiers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function handleCreateCollection(tier: Tier) {
    if (!confirm(`Create Solana collection for "${tier.name}"? This cannot be undone.`)) return;
    
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const res = await adminApi.createCollection(tier.id, token);
      toast({ 
        title: 'Collection created!',
        description: `Address: ${res.collectionAddress.slice(0, 8)}...`,
      });
      loadTiers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NFT Tiers</h1>
          <p className="text-muted-foreground">Manage your NFT tier collections</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Tier
        </Button>
      </div>

      <div className="grid gap-4">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  {/* Tier image */}
                  <div className="w-24 h-24 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                    {tier.artworkUrl ? (
                      <NFTImage 
                        metadataUrl={tier.artworkUrl} 
                        alt={tier.name}
                        className="w-full h-full object-cover"
                        fallback={
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                            {tier.name[0]}
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                        {tier.name[0]}
                      </div>
                    )}
                  </div>

                  {/* Tier info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          {tier.name}
                          <span className="text-sm font-normal text-muted-foreground">
                            #{tier.displayOrder}
                          </span>
                        </h3>
                        <p className="text-muted-foreground text-sm mt-1">{tier.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleMinting(tier)}
                          title={tier.mintingOpen ? 'Close minting' : 'Open minting'}
                        >
                          {tier.mintingOpen ? (
                            <ToggleRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(tier)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(tier)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-6 mt-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Supply:</span>{' '}
                        <span className="font-medium">
                          {formatNumber(tier.mintedCount)} / {tier.supplyCap ? formatNumber(tier.supplyCap) : '∞'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Price:</span>{' '}
                        <span className="font-medium">{tier.price} SOL</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>{' '}
                        <span className={`font-medium ${tier.mintingOpen ? 'text-green-500' : 'text-red-500'}`}>
                          {tier.mintingOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                    </div>

                    {/* Collection info */}
                    <div className="mt-4 pt-4 border-t border-border">
                      {tier.collectionAddress ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Collection:</span>
                          <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                            {tier.collectionAddress.slice(0, 12)}...{tier.collectionAddress.slice(-8)}
                          </code>
                          <a
                            href={`https://solscan.io/token/${tier.collectionAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateCollection(tier)}
                        >
                          <Rocket className="w-4 h-4 mr-2" />
                          Create Solana Collection
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {tiers.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No tiers created yet</p>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Tier
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTier ? 'Edit Tier' : 'Create New Tier'}</DialogTitle>
            <DialogDescription>
              {editingTier 
                ? 'Update the tier configuration below' 
                : 'Add a new NFT tier to your collection'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Platinum"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Premium tier with exclusive benefits..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="artworkUrl">Artwork URL</Label>
              <Input
                id="artworkUrl"
                type="url"
                value={formData.artworkUrl}
                onChange={(e) => setFormData({ ...formData, artworkUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="supplyCap">Supply Cap</Label>
                <Input
                  id="supplyCap"
                  type="number"
                  value={formData.supplyCap || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    supplyCap: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="price">Price (SOL)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    price: parseFloat(e.target.value) || 0 
                  })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  displayOrder: parseInt(e.target.value) || 0 
                })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingTier ? 'Save Changes' : 'Create Tier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

