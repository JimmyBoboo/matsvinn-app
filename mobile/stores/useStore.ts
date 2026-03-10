import { create } from 'zustand';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { InventoryItem, ChatMessage, User } from '../types';

const INVENTORY_COLLECTION = 'items';
const CHAT_COLLECTION = 'chatHistory';

const itemsCollection = (userId: string) => 
  collection(db, 'users', userId, INVENTORY_COLLECTION);

const chatCollection = (userId: string) => 
  collection(db, 'users', userId, CHAT_COLLECTION);

interface AppState {
  user: User | null;
  isLoading: boolean;
  authLoading: boolean;
  items: InventoryItem[];
  chatHistory: ChatMessage[];
  isChatLoading: boolean;
  
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  
  subscribeToInventory: (userId: string) => () => void;
  addItem: (userId: string, item: Omit<InventoryItem, 'id' | 'createdAt'>) => Promise<string>;
  addItems: (userId: string, items: Omit<InventoryItem, 'id' | 'createdAt'>[]) => Promise<void>;
  removeItem: (userId: string, itemId: string) => Promise<void>;
  
  subscribeToChat: (userId: string) => () => void;
  sendMessage: (userId: string, content: string, apiUrl: string, inventory: InventoryItem[]) => Promise<void>;
  clearChat: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  isLoading: false,
  authLoading: true,
  items: [],
  chatHistory: [],
  isChatLoading: false,

  setUser: (user) => set({ user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),

  subscribeToInventory: (userId) => {
    set({ isLoading: true });
    const q = query(itemsCollection(userId), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          category: data.category,
          storageLocation: data.storageLocation,
          quantity: data.quantity ?? null,
          unit: data.unit ?? null,
          expiresAt: data.expiresAt?.toDate?.() ?? null,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        } as InventoryItem;
      });
      set({ items, isLoading: false });
    });
    
    return unsubscribe;
  },

  addItem: async (userId, item) => {
    const docData = {
      name: item.name,
      category: item.category,
      storageLocation: item.storageLocation,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      expiresAt: item.expiresAt ? Timestamp.fromDate(item.expiresAt) : null,
      createdAt: Timestamp.now(),
    };
    
    const docRef = await addDoc(itemsCollection(userId), docData);
    return docRef.id;
  },

  addItems: async (userId, items) => {
    const batch = items.map((item) => ({
      name: item.name,
      category: item.category,
      storageLocation: item.storageLocation,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      expiresAt: item.expiresAt ? Timestamp.fromDate(item.expiresAt) : null,
      createdAt: Timestamp.now(),
    }));
    
    const promises = batch.map((docData) => addDoc(itemsCollection(userId), docData));
    await Promise.all(promises);
  },

  removeItem: async (userId, itemId) => {
    await deleteDoc(doc(db, 'users', userId, INVENTORY_COLLECTION, itemId));
  },

  subscribeToChat: (userId) => {
    const q = query(chatCollection(userId), orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          role: data.role,
          content: data.content,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        } as ChatMessage;
      });
      set({ chatHistory: messages });
    });
    
    return unsubscribe;
  },

  sendMessage: async (userId, content, apiUrl, inventory) => {
    const { chatHistory } = get();
    set({ isChatLoading: true });

    try {
      await addDoc(chatCollection(userId), {
        role: 'user',
        content,
        createdAt: Timestamp.now(),
      });

      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          inventory: inventory.map(i => ({
            name: i.name,
            category: i.category,
            storageLocation: i.storageLocation,
            quantity: i.quantity,
            unit: i.unit,
            expiresAt: i.expiresAt?.toISOString() ?? null,
          })),
          history: chatHistory.map(h => ({
            role: h.role,
            content: h.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();
      
      await addDoc(chatCollection(userId), {
        role: 'assistant',
        content: data.message,
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      set({ isChatLoading: false });
    }
  },

  clearChat: () => set({ chatHistory: [] }),
}));
