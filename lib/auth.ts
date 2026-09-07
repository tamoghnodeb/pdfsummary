import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const APP_PASSWORD = process.env.APP_PASSWORD ?? "rag-demo-2024";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Password",
      credentials: {
        password: {
          label: "Access Password",
          type: "password",
          placeholder: "Enter access password",
        },
      },
      async authorize(credentials) {
        if (!credentials?.password) return null;

        // Simple password gate — compare against env var
        if (credentials.password === APP_PASSWORD) {
          return {
            id: "demo-user",
            name: "Demo User",
            email: "demo@rag-chatbot.app",
          };
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
