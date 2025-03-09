'use client';

import { useState, useEffect, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function StreamPage() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [dailyVisits, setDailyVisits] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''] });
  const [activePolls, setActivePolls] = useState<any[]>([]);
  const [pollError, setPollError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const supabase = createClientComponentClient();

  // Simple password check - no token/session verification
  const checkPassword = () => {
    if (password === 'ChessY@2025') {
      setIsAuthorized(true);
      // Store in localStorage to persist the login
      localStorage.setItem('stream_authorized', 'true');
    } else {
      setPollError('Incorrect password');
    }
  };

  // Check if already authorized from localStorage on page load
  useEffect(() => {
    if (localStorage.getItem('stream_authorized') === 'true') {
      setIsAuthorized(true);
    }
    fetchStats();
    fetchActivePolls();
  }, []);

  const fetchStats = async () => {
    try {
      // Get total users
      const { count: userCount, error: userError } = await supabase
        .from('users')
        .select('*', { count: 'exact' });
      
      if (!userError) {
        setTotalUsers(userCount || 0);
      }
      
      // Get today's visits
      const today = new Date().toISOString().split('T')[0];
      const { count: visitCount, error: visitError } = await supabase
        .from('visits')
        .select('*', { count: 'exact' })
        .gte('created_at', today);

      if (!visitError) {
        setDailyVisits(visitCount || 0);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleStreamToggle = () => {
    setIsStreaming(!isStreaming);
  };

  const handleAddOption = () => {
    setNewPoll(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const handleCreatePoll = async () => {
    try {
      setPollError('');
      
      // Simple validation
      if (!newPoll.question.trim()) {
        setPollError('Question is required');
        return;
      }

      const validOptions = newPoll.options.filter(opt => opt.trim() !== '');
      if (validOptions.length < 2) {
        setPollError('At least 2 valid options are required');
        return;
      }

      // Simple insert without auth checks
      const { error } = await supabase
        .from('polls')
        .insert([{
          question: newPoll.question.trim(),
          options: validOptions,
          active: true
        }]);

      if (error) {
        console.error('Poll creation error:', error);
        throw new Error('Failed to create poll');
      }

      // Clear form and refresh list
      setNewPoll({ question: '', options: ['', ''] });
      await fetchActivePolls();
      
    } catch (err: any) {
      console.error('Error creating poll:', err);
      setPollError(err.message || 'Failed to create poll');
    }
  };

  const fetchActivePolls = async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error) {
        setActivePolls(data || []);
      }
    } catch (err) {
      console.error('Error fetching polls:', err);
    }
  };

  // Simple login form if not authorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black p-8 flex items-center justify-center">
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-6">Stream Access</h1>
          {pollError && (
            <div className="text-red-400 text-sm mb-4 bg-red-900/20 p-2 rounded">
              {pollError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
                onKeyPress={(e) => e.key === 'Enter' && checkPassword()}
              />
            </div>
            <button
              onClick={checkPassword}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Access Stream
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Analytics Dashboard</h1>
        
        {/* Stats Grid */}
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

        {/* Stream Control */}
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800">
          <h2 className="text-2xl font-bold text-white mb-4">Stream Control</h2>
          <button
            onClick={handleStreamToggle}
            className={`${
              isStreaming
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            } text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors duration-200`}
          >
            {isStreaming ? 'Stop Stream' : 'Start Stream'}
          </button>
          {isStreaming && (
            <p className="text-green-400 mt-4">Stream is currently active</p>
          )}
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
            
            {newPoll.options.map((option, index) => (
              <input
                key={index}
                type="text"
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => {
                  const newOptions = [...newPoll.options];
                  newOptions[index] = e.target.value;
                  setNewPoll(prev => ({ ...prev, options: newOptions }));
                }}
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

        {/* Active Polls List */}
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 mt-8">
          <h2 className="text-2xl font-bold text-white mb-4">Active Polls</h2>
          <div className="space-y-4">
            {activePolls.map(poll => (
              <div key={poll.id} className="border border-gray-800 p-4 rounded">
                <h3 className="text-white text-xl">{poll.question}</h3>
                <div className="mt-2 space-y-2">
                  {poll.options.map((option: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined, index: number) => (
                    <div key={index} className="text-gray-400">
                      {index + 1}. {option}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}