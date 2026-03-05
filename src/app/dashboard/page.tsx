'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Calendar, MessageCircle, LogOut, ChevronRight } from 'lucide-react';
import { AddItemDialog } from '@/components/inventory/AddItemDialog';
import { format, differenceInDays, isPast } from 'date-fns';
import { nb } from 'date-fns/locale';
import type { InventoryItem, StorageLocation } from '@/types';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { items, isLoading: itemsLoading, subscribeToInventory, removeItem } = useStore();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation>('fridge');
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = subscribeToInventory(user.uid);
      return () => unsubscribe();
    }
  }, [user?.uid, subscribeToInventory]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const getItemsByLocation = (location: StorageLocation) => {
    return items.filter((item) => item.storageLocation === location);
  };

  const getExpiryStatus = (item: InventoryItem) => {
    if (!item.expiresAt) return null;
    const daysUntilExpiry = differenceInDays(new Date(item.expiresAt), new Date());
    if (daysUntilExpiry < 0) return { status: 'expired', label: 'Utløpt' };
    if (daysUntilExpiry <= 3) return { status: 'expiring', label: `Utløper om ${daysUntilExpiry} dag${daysUntilExpiry === 1 ? '' : 'er'}` };
    if (daysUntilExpiry <= 7) return { status: 'soon', label: `Utløper om ${daysUntilExpiry} dager` };
    return null;
  };

  const ItemCard = ({ item }: { item: InventoryItem }) => {
    const [expanded, setExpanded] = useState(false);
    const expiryStatus = getExpiryStatus(item);
    
    return (
      <div 
        className="bg-white rounded-lg border shadow-sm cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between p-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{item.name}</span>
              {item.quantity && (
                <span className="text-sm text-gray-500">
                  {item.quantity} {item.unit || 'stk'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 capitalize">{item.category}</span>
              {expiryStatus && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    expiryStatus.status === 'expired'
                      ? 'bg-red-100 text-red-700'
                      : expiryStatus.status === 'expiring'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {expiryStatus.label}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                user && removeItem(user.uid, item.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {expanded && (
          <div className="px-3 pb-3 pt-0 border-t mt-0">
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              {item.expiresAt && (
                <div>
                  <span className="text-gray-500">Utløpsdato:</span>
                  <p className="font-medium">
                    {format(new Date(item.expiresAt), 'dd. MMMM yyyy', { locale: nb })}
                  </p>
                </div>
              )}
              {item.quantity && (
                <div>
                  <span className="text-gray-500">Antall:</span>
                  <p className="font-medium">{item.quantity} {item.unit || 'stk'}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Kategori:</span>
                <p className="font-medium capitalize">{item.category}</p>
              </div>
              <div>
                <span className="text-gray-500">Plassering:</span>
                <p className="font-medium">
                  {item.storageLocation === 'fridge' && 'Kjøleskap'}
                  {item.storageLocation === 'pantry' && 'Skap'}
                  {item.storageLocation === 'freezer' && 'Fryser'}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Lagt til:</span>
                <p className="font-medium">
                  {format(new Date(item.createdAt), 'dd. MMMM yyyy', { locale: nb })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (authLoading || itemsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">MatSvinn</h1>
            <p className="text-sm text-gray-500">Hei, {user.displayName || 'User'}!</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/chat">
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                <MessageCircle className="h-4 w-4 mr-1" />
                AI Kokk
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <Tabs
          value={selectedLocation}
          onValueChange={(v) => setSelectedLocation(v as StorageLocation)}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="fridge">
              🏠 Kjøleskap
            </TabsTrigger>
            <TabsTrigger value="pantry">
              🗄️ Skap
            </TabsTrigger>
            <TabsTrigger value="freezer">
              ❄️ Fryser
            </TabsTrigger>
          </TabsList>

          {(['fridge', 'pantry', 'freezer'] as StorageLocation[]).map((location) => (
            <TabsContent key={location} value={location} className="mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {location === 'fridge' && 'Kjøleskap'}
                      {location === 'pantry' && 'Skap & skuffer'}
                      {location === 'freezer' && 'Fryser'}
                    </CardTitle>
                    <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Legg til
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {getItemsByLocation(location).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>Ingen varer registrert</p>
                      <Button
                        variant="outline"
                        className="mt-2"
                        onClick={() => setAddDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Legg til din første vare
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {getItemsByLocation(location).map((item) => (
                        <ItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        defaultLocation={selectedLocation}
      />
    </div>
  );
}
