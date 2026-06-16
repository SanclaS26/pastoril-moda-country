import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  adminError: string | null;
};

export function useAuth(): AuthContextType {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const verifySession = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setIsAuthenticated(false);
          return;
        }

        const session = sessionData?.session;
        const user = session?.user;
        if (!user || !user.email) {
          setIsAuthenticated(false);
          return;
        }

        const { data: adminUser, error: adminErrorQuery } = await supabase
          .from('admin_users')
          .select('id, ativo, email, user_id')
          .or(`email.eq.${user.email},user_id.eq.${user.id}`)
          .limit(1)
          .single();

        if (adminErrorQuery || !adminUser || !adminUser.ativo) {
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setAdminError('Usuário sem permissão administrativa');
          return;
        }

        if (mounted) {
          setIsAuthenticated(true);
          setAdminError(null);
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false);
          setAdminError(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    verifySession();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      verifySession();
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return { isAuthenticated, isLoading, adminError };
}

export function useProtectedRoute() {
  const router = useRouter();
  const { isAuthenticated, isLoading, adminError } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const target = adminError ? `/admin/login?error=${encodeURIComponent(adminError)}` : '/admin/login';
      router.push(target);
    }
  }, [adminError, isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading, adminError };
}

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.user) {
    return {
      error: error?.message || 'E-mail ou senha inválidos.',
    };
  }

  const user = data.user;
  const userEmail = user.email || '';

  const { data: adminUser, error: adminErrorQuery } = await supabase
    .from('admin_users')
    .select('id, ativo, email, user_id')
    .or(`email.eq.${userEmail},user_id.eq.${user.id}`)
    .limit(1)
    .single();

  if (adminErrorQuery || !adminUser || !adminUser.ativo) {
    await supabase.auth.signOut();
    return {
      error: 'Usuário sem permissão administrativa',
    };
  }

  return { error: null };
}

export async function logout() {
  await supabase.auth.signOut();
}
