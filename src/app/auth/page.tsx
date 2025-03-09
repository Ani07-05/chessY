'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSearchParams, useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [chessUsername, setChessUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  // Direct superuser navigation - bypasses potential middleware checks
  const navigateAsSuperuser = () => {
    console.log('Navigating to stream page as superuser');
    // Store superuser status in both sessionStorage and cookies for redundancy
    sessionStorage.setItem('is_superuser', 'true');
    document.cookie = "is_superuser=true; path=/";
    // Force navigation with a full page reload to bypass any client-side routing
    window.location.href = '/stream';
  };
  
  // Check for superuser status on component mount
  useEffect(() => {
    const isSuperuserSession = sessionStorage.getItem('is_superuser') === 'true';
    const hasSuperuserCookie = document.cookie.split(';').some(item => item.trim().startsWith('is_superuser=true'));
    
    if (isSuperuserSession || hasSuperuserCookie) {
      const currentPath = window.location.pathname;
      if (currentPath === '/auth') {
        // We're on the auth page but we should be on the stream page
        console.log('Detected superuser session, redirecting to stream page');
        window.location.href = '/stream';
      }
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Handle superuser login completely separately
      if (isSuperuser) {
        console.log('Attempting superuser login with password:', password);
        if (password === 'ChessY@2025') {
          console.log('Superuser password correct, navigating to stream page');
          navigateAsSuperuser();
          return;
        } else {
          throw new Error('Invalid superuser password');
        }
      }

      // Regular auth flow
      if (isSignUp) {
        // Handle registration
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              chess_username: chessUsername,
              role: email === 'paathabot@gmail.com' ? 'superadmin' : 'user'
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          setSuccessMessage('Account created! Please check your email to confirm your registration.');
          // Don't redirect yet as they need to verify their email
        }
      } else {
        // Handle sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        if (data?.user) {
          // Check if user is superadmin
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single();
          
          if (userError) throw userError;
          
          // Superadmin should always go to admin page
          if (userData?.role === 'superadmin') {
            router.replace('/admin');
            return;
          }
          
          // For regular users, respect the redirect parameter
          const redirectPath = searchParams.get('redirect');
          router.replace(redirectPath ? decodeURIComponent(redirectPath) : '/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Auth error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="max-w-md w-full space-y-8 bg-gray-900 p-8 rounded-xl shadow-2xl border border-gray-800">
        <div>
          <h2 className="text-center text-4xl font-bold text-white mb-2">
            {isSuperuser ? 'Superuser Login' : isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <p className="text-center text-gray-400 text-sm">Welcome to Chess ERP</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-4 rounded-md">
            {!isSuperuser && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required={!isSuperuser}
                  className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all duration-200"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={isSuperuser ? 0 : 6}
              />
            </div>
            {isSignUp && (
              <div>
                <label htmlFor="chess-username" className="block text-sm font-medium text-gray-300 mb-1">
                  Chess.com Username
                </label>
                <input
                  id="chess-username"
                  name="chess-username"
                  type="text"
                  required={isSignUp}
                  className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all duration-200"
                  placeholder="Your Chess.com username"
                  value={chessUsername}
                  onChange={(e) => setChessUsername(e.target.value)}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">{error}</div>
          )}
          
          {successMessage && (
            <div className="text-green-400 text-sm text-center bg-green-900/20 p-2 rounded">{successMessage}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Processing...' : isSuperuser ? 'Access Stream' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </div>

          <div className="text-center space-y-2">
            {!isSuperuser && (
              <button
                type="button"
                className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
                onClick={toggleMode}
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            )}
            <button
              type="button"
              className="block w-full text-sm text-gray-400 hover:text-white transition-colors duration-200"
              onClick={() => {
                setIsSuperuser(!isSuperuser);
                setError('');
                setSuccessMessage('');
                setPassword('');
                setEmail('');
              }}
            >
              {isSuperuser ? 'Back to regular login' : 'Superuser login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}