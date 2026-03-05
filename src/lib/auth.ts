import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth as firebaseAuth } from './firebase';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        isRegister: { label: 'Is Register', type: 'boolean' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const isRegister = credentials.isRegister === 'true';

        try {
          let userCredential;
          if (isRegister) {
            userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
          } else {
            userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
          }

          const user = userCredential.user;

          return {
            id: user.uid,
            email: user.email,
            name: user.displayName || email.split('@')[0],
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
