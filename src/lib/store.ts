import { create } from 'zustand';
import type { InventoryItem, ChatMessage, User, StorageLocation } from '@/types';
import {
  subscribeToItems,
  createItem,
  updateItem,
  deleteItem,
  getItems,
  subscribeToChatHistory,
  addChatMessage,
  getChatHistory,
} from '@/lib/firestore';

interface AppState {
  user: User | null;
  items: InventoryItem[];
  chatHistory: ChatMessage[];
  isLoading: boolean;
  isChatLoading: boolean;
  
  setUser: (user: User | null) => void;
  
  subscribeToInventory: (userId: string) => () => void;
  fetchItems: (userId: string) => Promise<void>;
  addItem: (userId: string, item: Omit<InventoryItem, 'id' | 'createdAt'>) => Promise<string>;
  editItem: (userId: string, itemId: string, updates: Partial<InventoryItem>) => Promise<void>;
  removeItem: (userId: string, itemId: string) => Promise<void>;
  
  subscribeToChat: (userId: string) => () => void;
  fetchChatHistory: (userId: string) => Promise<void>;
  sendMessage: (userId: string, content: string) => Promise<void>;
  clearChat: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  items: [],
  chatHistory: [],
  isLoading: false,
  isChatLoading: false,

  setUser: (user) => set({ user }),

  subscribeToInventory: (userId) => {
    set({ isLoading: true });
    const unsubscribe = subscribeToItems(userId, (items) => {
      set({ items, isLoading: false });
    });
    return unsubscribe;
  },

  fetchItems: async (userId) => {
    set({ isLoading: true });
    try {
      const items = await getItems(userId);
      set({ items, isLoading: false });
    } catch (error) {
      console.error('Error fetching items:', error);
      set({ isLoading: false });
    }
  },

  addItem: async (userId, item) => {
    try {
      const id = await createItem(userId, item);
      return id;
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  },

  editItem: async (userId, itemId, updates) => {
    try {
      await updateItem(userId, itemId, updates);
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  },

  removeItem: async (userId, itemId) => {
    try {
      await deleteItem(userId, itemId);
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  },

  subscribeToChat: (userId) => {
    const unsubscribe = subscribeToChatHistory(userId, (messages) => {
      set({ chatHistory: messages });
    });
    return unsubscribe;
  },

  fetchChatHistory: async (userId) => {
    try {
      const messages = await getChatHistory(userId);
      set({ chatHistory: messages });
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  },

  sendMessage: async (userId, content) => {
    const { chatHistory, items } = get();
    
    set({ isChatLoading: true });

    try {
      await addChatMessage(userId, {
        role: 'user',
        content,
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          inventory: items,
          history: chatHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();
      
      await addChatMessage(userId, {
        role: 'assistant',
        content: data.message,
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
