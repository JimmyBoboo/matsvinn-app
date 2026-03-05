export type StorageLocation = 'fridge' | 'pantry' | 'freezer';

export type Category = 
  | 'dairy'
  | 'meat'
  | 'vegetables'
  | 'fruit'
  | 'fish'
  | 'grains'
  | 'condiments'
  | 'spices'
  | 'canned'
  | 'frozen'
  | 'beverages'
  | 'snacks'
  | 'other';

export interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  storageLocation: StorageLocation;
  quantity?: number | null;
  unit?: string | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}
