'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

// **Interfaces**
interface Poll {
  id: number;
  question: string;
  options: Record<string, string>;
  active: boolean;
  created_at: string;
  votes: Record<string, number>;
}

interface NewPoll {
  question: string;
  options: Record<string, string>;
}

// **Component Definition**
export default function StreamPage() {
  // **State Variables**
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [dailyVisits, setDailyVisits] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [newPoll, setNewPoll] = useState<NewPoll>({ question: '', options: { '0': '', '1': '' } });
  const [activePolls, setActivePolls] = useState<Poll[]>([]);
  const [pollError, setPollError] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [fetchError, setFetchError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tableExists, setTableExists] = useState<boolean>(false);
  const [authType, setAuthType] = useState<'admin' | 'user'>('user');
  const [email, setEmail] = useState('');
  const [chessUsername, setChessUsername] = useState('');
  const supabase = createClientComponentClient<Database>();

  // **Initialization with useEffect**
  useEffect(() => {
    if (localStorage.getItem('stream_authorized') === 'true') {
      setIsAuthorized(true);
    }
    const initializeApp = async () => {
      await fetchStats();
      const tableExists = await checkAndCreatePollsTable();
      if (tableExists) {
        await fetchActivePolls();
      } else {
        console.log('Table does not exist, skipping poll fetch');
      }
    };
    initializeApp();
  }, []);

  // **Database Functions**
  const checkAndCreatePollsTable = async () => {
    try {
      setPollError('');
      const { data: tableCheckData, error: tableCheckError } = await supabase
        .from('polls')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        console.log('Table check error:', tableCheckError.message, tableCheckError.code);
        if (tableCheckError.code === '42P01') {
          setPollError('Polls table does not exist. Please create it in the Supabase dashboard.');
        } else {
          setPollError(`Database error: ${tableCheckError.message}`);
        }
        setTableExists(false);
        return false;
      } else {
        console.log('Polls table exists, data:', tableCheckData);
        setTableExists(true);
        return true;
      }
    } catch (err) {
      console.error('Error checking polls table:', err);
      setPollError('Unexpected database error. Please ensure you have the correct permissions.');
      setTableExists(false);
      return false;
    }
  };

  const fetchStats = async () => {
    try {
      // Get total users from users table
      const { count: userCount, error: userError } = await supabase
        .from('users')
        .select('*', { count: 'exact' });
      
      if (!userError) {
        setTotalUsers(userCount || 0);
      } else {
        console.error('Error fetching user count:', userError);
      }
      
      // Get today's visits
      const today = new Date().toISOString().split('T')[0];
      const { count: visitCount, error: visitError } = await supabase
        .from('visits')
        .select('*', { count: 'exact' })
        .gte('created_at', today);

      if (!visitError) {
        setDailyVisits(visitCount || 0);
      } else {
        console.error('Error fetching visit count:', visitError);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchActivePolls = async (retryCount = 0): Promise<void> => {
    try {
      setIsLoading(true);
      setFetchError('');

      if (!tableExists && retryCount === 0) {
        const created = await checkAndCreatePollsTable();
        if (!created) {
          setFetchError('Polls table is not available');
          setActivePolls([]);
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('polls')
        .select('id, question, options, active, created_at, votes')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        if (error.code === '42P01' && retryCount === 0) {
          const created = await checkAndCreatePollsTable();
          if (created) {
            return fetchActivePolls(1);
          } else {
            throw new Error(`Unable to create polls table: ${error.message}`);
          }
        } else {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      setActivePolls(data || []);
    } catch (err: any) {
      console.error('Error details:', err);
      setFetchError(err.message || 'Failed to fetch polls');
      setActivePolls([]);
    } finally {
      setIsLoading(false);
    }
  };

  // **Stream Control Function**
  const handleStreamToggle = () => {
    setIsStreaming(!isStreaming);
  };

  // **Poll Creation Functions**
  const handleAddOption = () => {
    setNewPoll(prev => ({
      ...prev,
      options: {
        ...prev.options,
        [Object.keys(prev.options).length.toString()]: ''
      }
    }));
  };

  const handleCreatePoll = async () => {
    try {
      setPollError('');

      if (!newPoll.question.trim()) {
        setPollError('Question is required');
        return;
      }

      const validOptions = Object.fromEntries(
        Object.entries(newPoll.options).filter(([_, value]) => value.trim() !== '')
      );

      if (Object.keys(validOptions).length < 2) {
        setPollError('At least 2 valid options are required');
        return;
      }

      if (!tableExists) {
        const created = await checkAndCreatePollsTable();
        if (!created) {
          setPollError('Unable to create poll: Database table not available');
          return;
        }
      }

      const { data, error } = await supabase
        .from('polls')
        .insert([{
          question: newPoll.question.trim(),
          options: validOptions,
          active: true,
          votes: Object.fromEntries(Object.keys(validOptions).map(key => [key, 0]))
        }])
        .select();

      if (error) {
        console.error('Poll creation error:', error);
        setPollError(error.message || 'Failed to create poll');
        return;
      }

      setNewPoll({ question: '', options: { '0': '', '1': '' } });
      await fetchActivePolls();
    } catch (err: any) {
      console.error('Error creating poll:', err);
      setPollError(err.message || 'Failed to create poll');
    }
  };

  // **Authentication Functions**
  const handleUpdateChessUsername = async () => {
    try {
      setPollError('');
      if (!chessUsername.trim()) {
        setPollError('Chess.com username is required');
        return;
      }

      const { data, error } = await supabase
        .from('users')  // Changed from 'auth' to 'users'
        .update({ chess_username: chessUsername.trim() })
        .eq('email', email)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        setPollError(error.message);
        return;
      }

      localStorage.setItem('user_auth', JSON.stringify(data));
      setPollError('Username updated successfully!');
    } catch (err: any) {
      console.error('Chess.com username update error:', err);
      setPollError(err.message);
    }
  };

  const handleAuth = async () => {
    if (authType === 'admin') {
      if (password === 'ChessY@2025') {
        setIsAuthorized(true);
        localStorage.setItem('stream_authorized', 'true');
      } else {
        setPollError('Incorrect admin password');
      }
    } else {
      try {
        setPollError(''); // Clear any existing errors
        
        if (!email || !password || !chessUsername) {
          setPollError('All fields are required');
          return;
        }

        // First check if user exists
        const { data: existingUser, error: checkError } = await supabase
          .from('users')  // Changed from 'auth' to 'users'
          .select('*') // Select all fields
          .eq('email', email.toLowerCase().trim())
          .maybeSingle(); // Use maybeSingle to avoid errors if no user found

        if (checkError) {
          console.error('Error checking user:', checkError);
          setPollError('Error checking user account');
          return;
        }

        if (existingUser) {
          // Existing user login
          if (existingUser.password === password) {
            setIsAuthorized(true);
            localStorage.setItem('user_auth', JSON.stringify(existingUser));
            
            // Update chess username if different
            if (existingUser.chess_username !== chessUsername) {
              await handleUpdateChessUsername();
            }
          } else {
            setPollError('Incorrect password');
          }
        } else {
          // New user registration
          const { data: newUser, error: insertError } = await supabase
            .from('users')  // Changed from 'auth' to 'users'
            .insert([{
              email: email.toLowerCase().trim(),
              password,
              chess_username: chessUsername.trim()
            }])
            .select()
            .single();

          if (insertError) {
            console.error('Error creating user:', insertError);
            setPollError(insertError.message);
            return;
          }

          setIsAuthorized(true);
          localStorage.setItem('user_auth', JSON.stringify(newUser));
        }
      } catch (err: any) {
        console.error('Auth error:', err);
        setPollError(err.message || 'An error occurred during authentication');
      }
    }
  };

  // **UI Rendering**
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black p-8 flex items-center justify-center">
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-6">
            {authType === 'admin' ? 'Admin Access' : 'User Login'}
          </h1>
          <button
            onClick={() => setAuthType(authType === 'admin' ? 'user' : 'admin')}
            className="text-blue-400 mb-4 text-sm"
          >
            Switch to {authType === 'admin' ? 'User Login' : 'Admin Access'}
          </button>
          {pollError && (
            <div className="text-red-400 text-sm mb-4 bg-red-900/20 p-2 rounded">
              {pollError}
            </div>
          )}
          <div className="space-y-4">
            {authType === 'user' && (
              <>
                <div>
                  <label className="block text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Chess.com Username</label>
                  <input
                    type="text"
                    value={chessUsername}
                    onChange={(e) => setChessUsername(e.target.value)}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
              />
            </div>
            <button
              onClick={handleAuth}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {authType === 'admin' ? 'Access Stream' : 'Login'}
            </button>
            {authType === 'user' && isAuthorized && (
              <div>
                <button
                  onClick={handleUpdateChessUsername}
                  className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  Update Chess.com Username
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Analytics Dashboard</h1>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-gray-400 text-sm font-medium">Total Users</h3>
            <p className="text-white text-3xl font-bold mt-2">{totalUsers}</p>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-gray-400 text-sm font-medium">Today's Visits</h3>
            <p className="text-white text-3xl font-bold mt-2">{dailyVisits}</p>
          </div>
        </div>

        {/* Stream Control Section */}
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800">
          <h2 className="text-2xl font-bold text-white mb-4">Stream Control</h2>
          <button
            onClick={handleStreamToggle}
            className={`${
              isStreaming ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            } text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors duration-200`}
          >
            {isStreaming ? 'Stop Stream' : 'Start Stream'}
          </button>
          {isStreaming && <p className="text-green-400 mt-4">Stream is currently active</p>}
        </div>

        {/* Poll Creation Section */}
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 mt-8">
          <h2 className="text-2xl font-bold text-white mb-4">Create New Poll</h2>
          {pollError && (
            <div className="text-red-400 text-sm mb-4 bg-red-900/20 p-2 rounded">
              {pollError}
            </div>
          )}
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter poll question"
              value={newPoll.question}
              onChange={(e) => setNewPoll(prev => ({ ...prev, question: e.target.value }))}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
            />
            {Object.entries(newPoll.options).map(([key, value]) => (
              <input
                key={key}
                type="text"
                placeholder={`Option ${parseInt(key) + 1}`}
                value={value}
                onChange={(e) =>
                  setNewPoll(prev => ({
                    ...prev,
                    options: { ...prev.options, [key]: e.target.value }
                  }))
                }
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
              />
            ))}
          <div className="space-x-4">
              <button
                onClick={handleAddOption}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Add Option
              </button>
              <button
                onClick={handleCreatePoll}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Create Poll
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}