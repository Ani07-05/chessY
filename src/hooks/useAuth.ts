import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Create the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export function useAuth(redirectTo = '/login') {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Set up the session listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          if (redirectTo) {
            router.push(redirectTo);
          }
        }
      }
    );

    // Get initial session
    checkCurrentSession();

    // Cleanup
    return () => {
      subscription?.unsubscribe();
    };
  }, [router, redirectTo]);

  async function checkCurrentSession() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        if (redirectTo) {
          router.push(redirectTo);
        }
      }
    } catch (err) {
      console.error('Session check error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserProfile(userId: string) {
    try {
      console.log('Fetching profile for user:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId);
      
      if (error) {
        console.error('Profile fetch error:', error);
        throw error;
      }
      
      console.log('Profile data:', data);
      
      if (!data || data.length === 0) {
        console.log('No profile found, redirecting');
        setUser(null);
        if (redirectTo) {
          router.push(redirectTo);
        }
        return;
      }
      
      // Get the current session to combine auth and profile data
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          ...data[0]
        });
      }
    } catch (err) {
      console.error('Profile error:', err);
      setError(err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: any, password: any) {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: any, password: any, userData = {}) {
    try {
      setLoading(true);
      
      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (error) throw error;
      
      if (data?.user) {
        // Create profile in 'users' table
        const { error: profileError } = await supabase
          .from('users')
          .insert([{
            id: data.user.id,
            email: data.user.email,
            created_at: new Date().toISOString(),
            ...userData
          }]);
        
        if (profileError) throw profileError;
      }
      
      return data;
    } catch (err) {
      console.error('Sign up error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      if (redirectTo) {
        router.push(redirectTo);
      }
    } catch (err) {
      console.error('Sign out error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    checkSession: checkCurrentSession
  };
}