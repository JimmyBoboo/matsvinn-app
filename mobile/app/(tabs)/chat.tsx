import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { generateText, createGateway } from 'ai';
import { auth } from '../../firebase/config';
import { useStore } from '../../stores/useStore';

const gateway = createGateway({
  apiKey: process.env.EXPO_PUBLIC_AI_GATEWAY_API_KEY,
});

const SYSTEM_PROMPT = `Du er en hjelpsom norsk kokkeassistent som heter "MatSvinn Hjelper". Din oppgave er å hjelpe brukere med å lage mat basert på matvarene de har tilgjengelig.

RETNINGSLINJER:
1. Svar alltid på norsk
2. Vær konkret og praktisk i forslagene dine
3. Foreslå retter basert på det brukeren faktisk har
4. Gi steg-for-steg instruksjoner når bruker ber om det
5. Vær oppmerksom på utløpsdatoer og varer som snart må brukes
6. Hvis noe mangler for en rett, foreslå enkle erstatninger eller hva som kan kjøpes
7. Hold svarene korte og konsise (maks 2-3 avsnitt for vanlige svar)
8. Bruk emojier for å gjøre svarene mer engasjerende

BRUKERENS BEHOLDNING:
Brukeren har følgende varer tilgjengelig:

{INVENTORY}

Hvis brukeren spør om hva de kan lage, baseforslagene dine på beholdningen ovenfor.
Hvis brukeren spør om en spesifikk rett, si ifra om de mangler noen ingredienser.
Hvis brukeren spør om noe som ikke er i beholdningen, vær ærlig om det.`;

function formatInventory(inventory: any[]): string {
  if (inventory.length === 0) {
    return 'Brukeren har ingen varer registrert ennå.';
  }

  const byLocation = {
    fridge: inventory.filter((i) => i.storageLocation === 'fridge'),
    pantry: inventory.filter((i) => i.storageLocation === 'pantry'),
    freezer: inventory.filter((i) => i.storageLocation === 'freezer'),
  };

  const locationNames: Record<string, string> = {
    fridge: 'Kjøleskap',
    pantry: 'Skap',
    freezer: 'Fryser',
  };

  const parts: string[] = [];

  for (const [location, items] of Object.entries(byLocation)) {
    if (items.length > 0) {
      parts.push(`${locationNames[location]}:\n${items.map((i: any) => `  - ${i.name} (${i.category})${i.quantity ? ` - ${i.quantity} ${i.unit || 'stk'}` : ''}`).join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatScreen() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const { user, items } = useStore();
  const router = useRouter();

  const handleSend = async () => {
    if (!message.trim() || !user || isLoading) return;
    
    const userMessage = message;
    setMessage('');
    setIsLoading(true);

    const newUserMessage: Message = { id: Date.now().toString(), role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    
    try {
      const formattedInventory = formatInventory(items);
      const systemPrompt = SYSTEM_PROMPT.replace('{INVENTORY}', formattedInventory);

      const { text } = await generateText({
        model: gateway('anthropic/claude-sonnet-4-20250514'),
        system: systemPrompt,
        messages: [
          ...messages.map((h) => ({ role: h.role, content: h.content })),
          { role: 'user' as const, content: userMessage },
        ],
      });

      const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: text };
      setMessages(prev => [...prev, assistantMessage]);
      
      setTimeout(() => scrollViewRef.current?.scrollToEnd(), 100);
    } catch (error) {
      console.error('Error:', error);
      alert('Kunne ikke sende melding');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Kokk</Text>
        <TouchableOpacity onPress={handleSignOut}><Text style={styles.signOutText}>Logg ut</Text></TouchableOpacity>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.chatList} contentContainerStyle={styles.chatContent}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👨‍🍳</Text>
            <Text style={styles.emptyText}>Hei! Jeg er MatSvinn Hjelper.</Text>
            <Text style={styles.emptySubtext}>Spør meg om oppskrifter basert på varene du har!</Text>
          </View>
        ) : (
          messages.map((msg) => (
            <View key={msg.id} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.messageText, msg.role === 'user' && styles.userText]}>
                {msg.content}
              </Text>
            </View>
          ))
        )}
        {isLoading && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator size="small" color="#22c55e" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Spør om oppskrift..."
          value={message}
          onChangeText={setMessage}
          multiline
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={[styles.sendButton, (!message.trim() || isLoading) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!message.trim() || isLoading}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 20, fontWeight: 'bold' },
  signOutText: { color: '#ef4444', fontSize: 14 },
  chatList: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#666', textAlign: 'center' },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#22c55e' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb' },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: 'white' },
  loadingBubble: { alignSelf: 'flex-start', padding: 12 },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 8 },
  input: { flex: 1, padding: 12, backgroundColor: '#f3f4f6', borderRadius: 20, fontSize: 15, maxHeight: 100 },
  sendButton: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#22c55e', borderRadius: 20, justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: 'white', fontWeight: '600' },
});
