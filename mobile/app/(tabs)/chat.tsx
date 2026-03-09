import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { generateText, createGateway } from 'ai';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../../firebase/config';
import { useStore } from '../../stores/useStore';
import OpenAI from 'openai';

const gateway = createGateway({
  apiKey: process.env.EXPO_PUBLIC_AI_GATEWAY_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
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
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const { user, items } = useStore();
  const router = useRouter();

  const pickImage = async () => {
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
      await analyzeImage(result.assets[0].base64);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    if (!user) return;
    
    setIsAnalyzingImage(true);
    
    try {
      const analysisPrompt = `Du er en AI som analyserer bilder av kjøleskap. Se på bildet og identifiser alle matvarer du kan se. 
      
Vennligst gi svaret ditt som en komma-separert liste av ingredienser på norsk. 
For eksempel: "melk, egg, smør, ost, brød, epler, gulrøtter, kylling"
Ikke legg til andre forklaringer eller tekst - bare ingrediensene separert med komma.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
              },
            ],
          },
        ],
      });

      const ingredientsText = response.choices[0]?.message?.content || '';
      const ingredients = ingredientsText.split(',').map(i => i.trim()).filter(i => i.length > 0);

      const systemMessage: Message = { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: `Jeg har analysert bildet ditt og funnet følgende ingredienser: ${ingredientsText}. La meg nå finne en oppskrift for deg!` 
      };
      setMessages(prev => [...prev, systemMessage]);

      const recipePrompt = `Brukeren har følgende ingredienser: ${ingredientsText}
      
Lag en enkel og praktisk oppskrift basert på disse ingrediensene. 

Svar på følgende format (kun JSON, uten markdown):
{
  "tittel": "Navn på retten",
  "ingredienser": ["ingrediens 1", "ingrediens 2"],
  "steg": ["steg 1", "steg 2", "steg 3"]
}

Velg en rett som bruker så mange av ingrediensene som mulig. Hvis noe mangler, kan du foreslå det som en ekstra.`;

      setIsLoading(true);
      try {
        const { text } = await generateText({
          model: gateway('anthropic/claude-sonnet-4-20250514'),
          system: 'Du er en norsk kokkeassistent. Svar ALLTID med kun gyldig JSON, uten markdown eller andre tegn før eller etter.',
          messages: [{ role: 'user', content: recipePrompt }],
        });

        let recipe;
        try {
          const cleanedText = text.trim();
          recipe = JSON.parse(cleanedText);
        } catch {
          recipe = { tittel: 'Kunne ikke parse oppskrift', ingredienser: [], steg: [text] };
        }

        const recipeMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `📸 *${recipe.tittel}*\n\n📋 Ingredienser:\n${recipe.ingredienser.map((i: string) => `• ${i}`).join('\n')}\n\n👨‍🍳 Steg:\n${recipe.steg.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`,
        };
        setMessages(prev => [...prev, recipeMessage]);

        await addDoc(collection(db, 'recipes'), {
          userId: user.uid,
          title: recipe.tittel,
          ingredients: recipe.ingredienser,
          steps: recipe.steg,
          createdAt: serverTimestamp(),
        });

      } catch (error) {
        console.error('Recipe generation error:', error);
        Alert.alert('Feil', 'Kunne ikke generere oppskrift. Sjekk at OpenAI-nøkkelen er riktig.');
      } finally {
        setIsAnalyzingImage(false);
        setIsLoading(false);
        setTimeout(() => scrollViewRef.current?.scrollToEnd(), 100);
      }
    } catch (error) {
      console.error('Image analysis error:', error);
      Alert.alert('Feil', 'Kunne ikke analysere bildet. Sjekk at OpenAI-nøkkelen er riktig.');
      setIsAnalyzingImage(false);
    }
  };

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
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={pickImage} disabled={isAnalyzingImage || isLoading}>
            <Text style={{ fontSize: 20, opacity: isAnalyzingImage || isLoading ? 0.5 : 1 }}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut}><Text style={styles.signOutText}>Logg ut</Text></TouchableOpacity>
        </View>
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
            <Text style={{ marginLeft: 8, color: '#666', fontSize: 14 }}>
              {isAnalyzingImage ? 'Analyserer bilde...' : 'Skriver...'}
            </Text>
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
