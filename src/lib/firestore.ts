import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { InventoryItem, ChatMessage, StorageLocation } from '@/types';

const INVENTORY_COLLECTION = 'items';
const CHAT_COLLECTION = 'chatHistory';

export const itemsCollection = (userId: string) =>
  collection(db, 'users', userId, INVENTORY_COLLECTION);

export const chatCollection = (userId: string) =>
  collection(db, 'users', userId, CHAT_COLLECTION);

export const createItem = async (
  userId: string,
  item: Omit<InventoryItem, 'id' | 'createdAt'>
): Promise<string> => {
  const docRef = await addDoc(itemsCollection(userId), {
    ...item,
    expiresAt: item.expiresAt ? Timestamp.fromDate(item.expiresAt) : null,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateItem = async (
  userId: string,
  itemId: string,
  updates: Partial<InventoryItem>
): Promise<void> => {
  const docRef = doc(db, 'users', userId, INVENTORY_COLLECTION, itemId);
  const updateData: DocumentData = { ...updates };
  if (updates.expiresAt) {
    updateData.expiresAt = Timestamp.fromDate(updates.expiresAt);
  }
  await updateDoc(docRef, updateData);
};

export const deleteItem = async (
  userId: string,
  itemId: string
): Promise<void> => {
  const docRef = doc(db, 'users', userId, INVENTORY_COLLECTION, itemId);
  await deleteDoc(docRef);
};

export const getItems = async (
  userId: string,
  storageLocation?: StorageLocation
): Promise<InventoryItem[]> => {
  let q = query(
    itemsCollection(userId),
    orderBy('createdAt', 'desc')
  );
  
  if (storageLocation) {
    q = query(
      itemsCollection(userId),
      where('storageLocation', '==', storageLocation),
      orderBy('createdAt', 'desc')
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      category: data.category,
      storageLocation: data.storageLocation,
      quantity: data.quantity,
      unit: data.unit,
      expiresAt: data.expiresAt?.toDate?.() || null,
      createdAt: data.createdAt?.toDate?.() || new Date(),
    } as InventoryItem;
  });
};

export const subscribeToItems = (
  userId: string,
  callback: (items: InventoryItem[]) => void,
  storageLocation?: StorageLocation
) => {
  let q = query(
    itemsCollection(userId),
    orderBy('createdAt', 'desc')
  );

  if (storageLocation) {
    q = query(
      itemsCollection(userId),
      where('storageLocation', '==', storageLocation),
      orderBy('createdAt', 'desc')
    );
  }

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        category: data.category,
        storageLocation: data.storageLocation,
        quantity: data.quantity,
        unit: data.unit,
        expiresAt: data.expiresAt?.toDate?.() || null,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as InventoryItem;
    });
    callback(items);
  });
};

export const addChatMessage = async (
  userId: string,
  message: Omit<ChatMessage, 'id' | 'createdAt'>
): Promise<string> => {
  const docRef = await addDoc(chatCollection(userId), {
    ...message,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getChatHistory = async (
  userId: string
): Promise<ChatMessage[]> => {
  const q = query(
    chatCollection(userId),
    orderBy('createdAt', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt?.toDate?.() || new Date(),
    } as ChatMessage;
  });
};

export const subscribeToChatHistory = (
  userId: string,
  callback: (messages: ChatMessage[]) => void
) => {
  const q = query(chatCollection(userId), orderBy('createdAt', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        role: data.role,
        content: data.content,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as ChatMessage;
    });
    callback(messages);
  });
};
