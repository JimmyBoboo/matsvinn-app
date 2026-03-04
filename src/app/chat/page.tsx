'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Send, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

export default function ChatPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { items, chatHistory, isChatLoading, subscribeToChat, sendMessage, clearChat } = useStore();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      const unsubscribe = subscribeToChat(user.uid);
      return () => unsubscribe();
    }
  }, [user, subscribeToChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = async () => {
    if (!message.trim() || !user || isChatLoading) return;
    
    const userMessage = message;
    setMessage('');
    
    try {
      await sendMessage(user.uid, userMessage);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">AI Kokkeassistent</h1>
              <p className="text-sm text-gray-500">Spør om opskrifter</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm('Vil du slette chat-historikken?')) {
                clearChat();
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {chatHistory.length === 0 ? (
            <Card className="p-6 text-center">
              <div className="text-4xl mb-4">👨‍🍳</div>
              <h2 className="text-lg font-semibold mb-2">Hei! Jeg er din AI-kokk</h2>
              <p className="text-gray-600 mb-4">
                Jeg kan hjelpe deg med å finne oppskrifter basert på det du har i kjøleskapet.
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Prøv å spørre:</p>
                <p>• "Hva kan jeg lage til middag?"</p>
                <p>• "Har jeg nok til å lage pasta?"</p>
                <p>• "Hva bør jeg bruke opp snart?"</p>
              </div>
            </Card>
          ) : (
            <>
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-green-600 text-white'
                        : 'bg-white border shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.role === 'user' ? 'text-green-100' : 'text-gray-400'
                      }`}
                    >
                      {format(msg.createdAt, 'HH:mm', { locale: nb })}
                    </p>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border shadow-sm rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Skriver...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      <div className="border-t bg-white p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            placeholder="Skriv en melding..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isChatLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isChatLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isChatLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {items.length === 0 && (
          <p className="text-center text-xs text-gray-500 mt-2">
            Legg til varer i beholdningen din for bedre forslag!
          </p>
        )}
      </div>
    </div>
  );
}
