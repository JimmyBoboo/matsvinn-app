'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      
      const result = await signIn('credentials', {
        email,
        password,
        isRegister: 'false',
        redirect: false,
      });

      if (result?.error) {
        toast.error('Feil e-post eller passord');
      } else {
        toast.success('Logget inn!');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Feil e-post eller passord');
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
          <CardTitle className="text-2xl">Logg inn</CardTitle>
          <CardDescription>
            Logg inn for å fortsette til MatSvinn Hjelper
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logger inn...' : 'Logg inn'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Har du ikke en konto?{' '}
            <Link href="/register" className="text-green-600 hover:underline">
              Registrer deg
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
