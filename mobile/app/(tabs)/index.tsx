import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from '@react-native-firebase/auth';
import { auth } from '../../firebase/config';
import { useStore } from '../../stores/useStore';
import * as ImagePicker from 'expo-image-picker';
import OpenAI from 'openai';
import type { StorageLocation, Category } from '../../types';

const CATEGORY_MAP: Record<string, Category> = {
  melk: 'dairy', ost: 'dairy', smør: 'dairy', egg: 'dairy', krem: 'dairy', youghurt: 'dairy', kesong: 'dairy',
  kjøtt: 'meat', kylling: 'meat', biff: 'meat', svinekjøtt: 'meat', bacon: 'meat', kjøttdeig: 'meat',
  gulrot: 'vegetables', løk: 'vegetables', hvitløk: 'vegetables', paprika: 'vegetables', agurk: 'vegetables', tomater: 'vegetables', salat: 'vegetables', spinat: 'vegetables', brokkoli: 'vegetables', kål: 'vegetables', sopp: 'vegetables', mais: 'vegetables', erter: 'vegetables',
  eple: 'fruit', banan: 'fruit', appelsin: 'fruit', sitron: 'fruit', bær: 'fruit', druer: 'fruit', melon: 'fruit',
  laks: 'fish', torsk: 'fish', sei: 'fish', makrell: 'fish', reker: 'fish', fisk: 'fish',
  brød: 'grains', knekkebrød: 'grains', pasta: 'grains', ris: 'grains', mel: 'grains', havregryn: 'grains',
  ketchup: 'condiments', sennep: 'condiments', majones: 'condiments', olje: 'condiments', eddik: 'condiments', remulade: 'condiments', sauser: 'condiments',
  salt: 'spices', pepper: 'spices', krydder: 'spices', oregano: 'spices', basilikum: 'spices', timian: 'spices',
  bønner: 'canned', hermetikk: 'canned',
  is: 'frozen', frosne: 'frozen',
  juice: 'beverages', vann: 'beverages', brus: 'beverages', kaffe: 'beverages', te: 'beverages',
};

function categorizeIngredient(name: string): Category {
  const lower = name.toLowerCase();
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return category;
  }
  return 'other';
}

interface ScannedItem {
  name: string;
  category: Category;
  storageLocation: StorageLocation;
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'dairy', label: 'Meieri' },
  { value: 'meat', label: 'Kjøtt' },
  { value: 'vegetables', label: 'Grønnsaker' },
  { value: 'fruit', label: 'Frukt' },
  { value: 'fish', label: 'Fisk' },
  { value: 'grains', label: 'Kornprodukter' },
  { value: 'condiments', label: 'Sauser' },
  { value: 'spices', label: 'Krydder' },
  { value: 'canned', label: 'Hermetikk' },
  { value: 'frozen', label: 'Frosne' },
  { value: 'beverages', label: 'Drikke' },
  { value: 'other', label: 'Annet' },
];

const LOCATIONS: { value: StorageLocation; label: string }[] = [
  { value: 'fridge', label: 'Kjøleskap' },
  { value: 'pantry', label: 'Skap' },
  { value: 'freezer', label: 'Fryser' },
];

export default function DashboardScreen() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [storageLocation, setStorageLocation] = useState<StorageLocation>('fridge');
  const [quantity, setQuantity] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation>('fridge');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);

  const [showScanModal, setShowScanModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const { user, items, isLoading, subscribeToInventory, addItem, addItems, removeItem } = useStore();
  const router = useRouter();

  const openai = new OpenAI({
    apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  });

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Tillatelse nødvendig', 'Vi trenger tilgang til kameraet for å ta bilde av kjøleskapet ditt.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setCapturedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      await analyzeImage(result.assets[0].base64);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    if (!user) return;
    
    setIsScanning(true);
    setShowScanModal(true);
    
    try {
      const analysisPrompt = `Du er en AI som analyserer bilder av kjøleskap og skuffer. Se på bildet og identifiser alle matvarer du kan se.

Vennligst gi svaret ditt som en JSON-array med objekter. Hvert objekt skal ha "name" (navn på norsk) og "quantity" (antall, standard 1).
For eksempel: [{"name": "Melk", "quantity": 2}, {"name": "Egg", "quantity": 6}, {"name": "Ost", "quantity": 1}]
Ikke legg til andre forklaringer eller tekst - bare JSON array.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content || '[]';
      let parsed: { name: string; quantity: number }[] = [];
      
      try {
        const cleaned = content.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        Alert.alert('Feil', 'Kunne ikke analysere bildet. Prøv igjen.');
        setShowScanModal(false);
        return;
      }

      const mappedItems: ScannedItem[] = parsed.map((p) => ({
        name: p.name,
        category: categorizeIngredient(p.name),
        storageLocation: selectedLocation,
      }));

      setScannedItems(mappedItems);
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Feil', 'Kunne ikke analysere bildet. Sjekk at OpenAI-nøkkelen er riktig.');
      setShowScanModal(false);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddScannedItems = async () => {
    if (!user || scannedItems.length === 0) return;
    
    setIsAddingItem(true);
    try {
      await addItems(user.uid, scannedItems.map((item) => ({
        name: item.name,
        category: item.category,
        storageLocation: item.storageLocation,
        quantity: null,
        unit: null,
        expiresAt: null,
      })));
      setShowScanModal(false);
      setScannedItems([]);
      setCapturedImage(null);
    } catch (error) {
      Alert.alert('Feil', 'Kunne ikke legge til varer');
    } finally {
      setIsAddingItem(false);
    }
  };

  const updateScannedItem = (index: number, field: keyof ScannedItem, value: string) => {
    setScannedItems((prev) => {
      const updated = [...prev];
      if (field === 'name') {
        updated[index] = { ...updated[index], name: value, category: categorizeIngredient(value) };
      } else if (field === 'storageLocation') {
        updated[index] = { ...updated[index], storageLocation: value as StorageLocation };
      }
      return updated;
    });
  };

  const removeScannedItem = (index: number) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = subscribeToInventory(user.uid);
      return () => unsubscribe();
    }
  }, [user?.uid]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  const handleAddItem = async () => {
    if (!name.trim() || !user) return;
    setIsAddingItem(true);
    try {
      await addItem(user.uid, {
        name: name.trim(),
        category,
        storageLocation,
        quantity: quantity ? parseInt(quantity) : null,
        unit: null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      setShowAddModal(false);
      setName('');
      setCategory('other');
      setStorageLocation('fridge');
      setQuantity('');
      setExpiresAt('');
    } catch (error) {
      alert('Kunne ikke legge til vare');
    } finally {
      setIsAddingItem(false);
    }
  };

  const getItemsByLocation = (location: StorageLocation) => {
    return items.filter((item) => item.storageLocation === location);
  };

  const getExpiryLabel = (item: any) => {
    if (!item.expiresAt) return null;
    const days = Math.ceil((new Date(item.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: 'Utløpt', color: '#fee2e2', textColor: '#991b1b' };
    if (days <= 3) return { label: `${days}d`, color: '#fed7aa', textColor: '#9a3412' };
    return null;
  };

  if (isLoading && items.length === 0) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#22c55e" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MatSvinn</Text>
        <TouchableOpacity onPress={handleSignOut}><Text style={styles.signOutText}>Logg ut</Text></TouchableOpacity>
      </View>

      <View style={styles.locationTabs}>
        {LOCATIONS.map((loc) => (
          <TouchableOpacity key={loc.value} style={[styles.locationTab, selectedLocation === loc.value && styles.locationTabActive]} onPress={() => setSelectedLocation(loc.value)}>
            <Text style={[styles.locationLabel, selectedLocation === loc.value && styles.locationLabelActive]}>{loc.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.addButton, styles.scanButton]} onPress={takePhoto}>
          <Text style={styles.addButtonText}>📷 Scan kjøleskap</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addButton, styles.manualButton]} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonText}>+ Legg til</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.itemList}>
        {getItemsByLocation(selectedLocation).map((item) => {
          const expiry = getExpiryLabel(item);
          const isExpanded = expandedItem === item.id;
          return (
            <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => setExpandedItem(isExpanded ? null : item.id)}>
              <View style={styles.itemHeader}>
                <View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.quantity && <Text style={styles.itemQuantity}>{item.quantity} stk</Text>}
                </View>
                <TouchableOpacity onPress={() => removeItem(user!.uid, item.id)}><Text>🗑️</Text></TouchableOpacity>
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemCategory}>{item.category}</Text>
                {expiry && <View style={[styles.expiryBadge, { backgroundColor: expiry.color }]}><Text style={[styles.expiryText, { color: expiry.textColor }]}>{expiry.label}</Text></View>}
              </View>
              {isExpanded && (
                <View style={styles.itemDetails}>
                  <Text>Utløper: {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('nb-NO') : '-'}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Legg til vare</Text>
            <TextInput style={styles.input} placeholder="Navn" value={name} onChangeText={setName} />
            <View style={styles.optionRow}>
              {LOCATIONS.map((loc) => (
                <TouchableOpacity key={loc.value} style={[styles.optionButton, storageLocation === loc.value && styles.optionButtonActive]} onPress={() => setStorageLocation(loc.value)}>
                  <Text>{loc.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat.value} style={[styles.categoryChip, category === cat.value && styles.categoryChipActive]} onPress={() => setCategory(cat.value)}>
                  <Text style={{ color: category === cat.value ? 'white' : '#666' }}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput style={styles.input} placeholder="Antall" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Utløpsdato (YYYY-MM-DD)" value={expiresAt} onChangeText={setExpiresAt} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddModal(false)}><Text>Avbryt</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleAddItem} disabled={isAddingItem}>
                {isAddingItem ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white' }}>Legg til</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showScanModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>
              {isScanning ? 'Analyserer bilde...' : `Fant ${scannedItems.length} varer`}
            </Text>
            
            {capturedImage && !isScanning && (
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
            )}
            
            {isScanning ? (
              <View style={styles.scanningContainer}>
                <ActivityIndicator size="large" color="#22c55e" />
                <Text style={{ marginTop: 12, color: '#666' }}>AI analyserer kjøleskapet ditt...</Text>
              </View>
            ) : (
              <>
                <ScrollView style={styles.scannedItemsList}>
                  {scannedItems.map((item, index) => (
                    <View key={index} style={styles.scannedItem}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        value={item.name}
                        onChangeText={(val) => updateScannedItem(index, 'name', val)}
                      />
                      <View style={styles.scannedItemRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {LOCATIONS.map((loc) => (
                            <TouchableOpacity
                              key={loc.value}
                              style={[styles.locationChip, item.storageLocation === loc.value && styles.locationChipActive]}
                              onPress={() => updateScannedItem(index, 'storageLocation', loc.value)}
                            >
                              <Text style={{ fontSize: 12, color: item.storageLocation === loc.value ? 'white' : '#666' }}>{loc.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        <TouchableOpacity onPress={() => removeScannedItem(index)} style={styles.removeButton}>
                          <Text style={{ color: '#ef4444' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowScanModal(false); setScannedItems([]); setCapturedImage(null); }}>
                    <Text>Avbryt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitButton} onPress={handleAddScannedItems} disabled={isAddingItem || scannedItems.length === 0}>
                    {isAddingItem ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white' }}>Legg til alle</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 20, fontWeight: 'bold' },
  signOutText: { color: '#ef4444', fontSize: 14 },
  locationTabs: { flexDirection: 'row', padding: 12, gap: 8 },
  locationTab: { flex: 1, padding: 10, backgroundColor: 'white', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  locationTabActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  locationLabel: { fontSize: 12, color: '#6b7280' },
  locationLabelActive: { color: 'white' },
  buttonRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  addButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  scanButton: { backgroundColor: '#3b82f6' },
  manualButton: { backgroundColor: '#22c55e' },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  itemList: { flex: 1, padding: 12 },
  itemCard: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 16, fontWeight: '600' },
  itemQuantity: { fontSize: 14, color: '#6b7280' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  itemCategory: { fontSize: 12, color: '#6b7280' },
  expiryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  expiryText: { fontSize: 11, fontWeight: '500' },
  itemDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, fontSize: 16, marginBottom: 12 },
  optionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  optionButton: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, alignItems: 'center' },
  optionButtonActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  categoryScroll: { marginBottom: 12 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f3f4f6', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#22c55e' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, alignItems: 'center' },
  submitButton: { flex: 1, padding: 14, backgroundColor: '#22c55e', borderRadius: 8, alignItems: 'center' },
  previewImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 12, resizeMode: 'cover' },
  scanningContainer: { padding: 40, alignItems: 'center' },
  scannedItemsList: { maxHeight: 300 },
  scannedItem: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 8 },
  scannedItemRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  locationChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#e5e7eb', marginRight: 4 },
  locationChipActive: { backgroundColor: '#22c55e' },
  removeButton: { padding: 8 },
});
