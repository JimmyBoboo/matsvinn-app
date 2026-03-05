import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createGateway } from 'ai';

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

interface ChatRequestBody {
  message: string;
  inventory: Array<{
    name: string;
    category: string;
    storageLocation: string;
    quantity?: number;
    unit?: string;
    expiresAt?: string | null;
  }>;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

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
Brukeren har følgende varer tilgjengelig (dette sendes med hver melding):

{INVENTORY}

Hvis brukeren spør om hva de kan lage, baseforslagene dine på beholdningen ovenfor.
Hvis brukeren spør om en spesifikk rett, si ifra om de mangler noen ingredienser.
Hvis brukeren spør om noe som ikke er i beholdningen, vær ærlig om det.`;

function formatInventory(inventory: ChatRequestBody['inventory']): string {
  if (inventory.length === 0) {
    return 'Brukeren har ingen varer registrert ennå.';
  }

  const byLocation = {
    fridge: inventory.filter((i) => i.storageLocation === 'fridge'),
    pantry: inventory.filter((i) => i.storageLocation === 'pantry'),
    freezer: inventory.filter((i) => i.storageLocation === 'freezer'),
  };

  const locationNames: Record<string, string> = {
    fridge: '🏠 Kjøleskap',
    pantry: '🗄️ Skap/skuff',
    freezer: '❄️ Fryser',
  };

  const parts: string[] = [];

  for (const [location, items] of Object.entries(byLocation)) {
    if (items.length > 0) {
      parts.push(`${locationNames[location]}:\n${items.map((i) => `  - ${i.name} (${i.category})${i.quantity ? ` - ${i.quantity} ${i.unit || 'stk'}` : ''}${i.expiresAt ? ` - utløper ${new Date(i.expiresAt).toLocaleDateString('nb-NO')}` : ''}`).join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequestBody = await req.json();
    const { message, inventory, history } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const formattedInventory = formatInventory(inventory);
    const systemPrompt = SYSTEM_PROMPT.replace('{INVENTORY}', formattedInventory);

    const messages = [
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    const { text } = await generateText({
      model: gateway('anthropic/claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages,
      maxTokens: 1024,
    });

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to get response from AI' },
      { status: 500 }
    );
  }
}
