'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passordene er ikke like');
      return;
    }

    if (password.length < 6) {
      toast.error('Passordet må være minst 6 tegn');
      return;
    }

    setIsLoading(true);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      
      const result = await signIn('credentials', {
        email,
        password,
        isRegister: 'true',
        redirect: false,
      });

      if (result?.error) {
        toast.error('Kunne ikke opprette konto. E-post kan allerede være i bruk.');
      } else {
        toast.success('Konto opprettet!');
        router.push('/dashboard');
        router.push }
    } catch (error) {
      console.error('Register error:', error);
      toast.error('Kunne ikke opprette konto. E-post kan allerede være i bruk.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-3xl">🥦</span>
          </div>
          <CardTitle className="text-2xl">Registrer deg</CardTitle>
          <CardDescription>
            Opprett en konto for å komme i gang
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">E-post</label>
              <Input
                id="email"
                type="email"
                placeholder="din@epost.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Passord</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">Bekreft passord</label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Oppretter konto...' : 'Registrer deg'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Har du allerede en konto?{' '}
            <Link href="/login" className="text-green-600 hover:underline">
              Logg inn
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
