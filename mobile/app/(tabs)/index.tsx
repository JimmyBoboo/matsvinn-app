import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useStore } from '../../stores/useStore';
import type { StorageLocation, Category } from '../../types';

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

  const { user, items, isLoading, subscribeToInventory, addItem, removeItem } = useStore();
  const router = useRouter();

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

      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
        <Text style={styles.addButtonText}>+ Legg til vare</Text>
      </TouchableOpacity>

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
  addButton: { margin: 12, padding: 14, backgroundColor: '#22c55e', borderRadius: 8, alignItems: 'center' },
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
});
