'use client';

import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { ReactNode, useEffect } from 'react';
import { useStore } from '@/lib/store';
import type { User } from '@/types';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      <AuthContext>{children}</AuthContext>
    </SessionProvider>
  );
}

function AuthContext({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const { setUser } = useStore();

  useEffect(() => {
    if (session?.user) {
      const user: User = {
        uid: session.user.id || session.user.email || '',
        email: session.user.email || null,
        displayName: session.user.name || null,
        createdAt: new Date(),
      };
      setUser(user);
    } else if (status !== 'loading') {
      setUser(null);
    }
  }, [session, status, setUser]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return children;
}

export const useAuth = () => {
  const { data: session, status } = useSession();
  
  const signOut = async () => {
    await nextAuthSignOut();
  };

  return {
    user: session?.user ? {
      uid: session.user.id || session.user.email || '',
      email: session.user.email || null,
      displayName: session.user.name || null,
      createdAt: new Date(),
    } : null,
    isLoading: status === 'loading',
    signOut,
  };
};
