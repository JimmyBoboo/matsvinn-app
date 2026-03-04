'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Category, StorageLocation } from '@/types';

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLocation?: StorageLocation;
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'dairy', label: 'Meieri' },
  { value: 'meat', label: 'Kjøtt' },
  { value: 'vegetables', label: 'Grønnsaker' },
  { value: 'fruit', label: 'Frukt' },
  { value: 'fish', label: 'Fisk' },
  { value: 'grains', label: 'Kornprodukter' },
  { value: 'condiments', label: 'Sauser/dressinger' },
  { value: 'spices', label: 'Krydder' },
  { value: 'canned', label: 'Hermetikk' },
  { value: 'frozen', label: 'Frosne varer' },
  { value: 'beverages', label: 'Drikke' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'other', label: 'Annet' },
];

const LOCATIONS: { value: StorageLocation; label: string }[] = [
  { value: 'fridge', label: 'Kjøleskap' },
  { value: 'pantry', label: 'Skap/skuff' },
  { value: 'freezer', label: 'Fryser' },
];

export function AddItemDialog({ open, onOpenChange, defaultLocation = 'fridge' }: AddItemDialogProps) {
  const { user } = useAuth();
  const { addItem } = useStore();
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [storageLocation, setStorageLocation] = useState<StorageLocation>(defaultLocation);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (defaultLocation) {
      setStorageLocation(defaultLocation);
    }
  }, [defaultLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Skriv inn navnet på varen');
      return;
    }

    if (!user) return;

    setIsLoading(true);
    try {
      await addItem(user.uid, {
        name: name.trim(),
        category,
        storageLocation,
        quantity: quantity ? parseInt(quantity) : undefined,
        unit: unit || undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });
      
      toast.success(`${name} lagt til!`);
      handleClose();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Kunne ikke legge til vare');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setCategory('other');
    setStorageLocation(defaultLocation);
    setQuantity('');
    setUnit('');
    setExpiresAt('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Legg til vare</DialogTitle>
          <DialogDescription>
            Legg til en ny vare i beholdningen din
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Navn på vare</Label>
              <Input
                id="name"
                placeholder="f.eks. Melk, Epler, Kylling"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plassering</Label>
              <Select value={storageLocation} onValueChange={(v) => setStorageLocation(v as StorageLocation)}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg plassering" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Antall</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Enhet</Label>
                <Input
                  id="unit"
                  placeholder="stk, liter, kg"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Utløpsdato (valgfritt)</Label>
              <Input
                id="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Avbryt
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isLoading}>
              {isLoading ? 'Legger til...' : 'Legg til vare'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
