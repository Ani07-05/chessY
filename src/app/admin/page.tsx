'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Analytics {
  totalUsers: number;
  activeStreams: number;
  recentLogins: Array<{ last_sign_in_at: string }>;
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streamActive, setStreamActive] = useState(false);
  const [channelId, setChannelId] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/analytics');
        if (!response.ok) throw new Error('Failed to fetch analytics');
        const data = await response.json();
        setAnalytics(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const startStream = async () => {
    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId })
      });

      if (!response.ok) throw new Error('Failed to start stream');
      setStreamActive(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white text-xl">Loading...</div></div>;
  if (error) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-red-500 text-xl">{error}</div></div>;
  if (!analytics) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white text-xl">No data available</div></div>;

  const loginData = {
    labels: analytics.recentLogins.map(login => 
      new Date(login.last_sign_in_at).toLocaleDateString()
    ),
    datasets: [
      {
        label: 'Recent Logins',
        data: analytics.recentLogins.map((_, index) => index + 1),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-white mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-purple-500 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] transition-all">
            <h2 className="text-xl font-semibold text-white mb-4">Total Users</h2>
            <p className="text-4xl font-bold text-white">{analytics.totalUsers}</p>
          </div>
          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all">
            <h2 className="text-xl font-semibold text-white mb-4">Active Streams</h2>
            <p className="text-4xl font-bold text-white">{analytics.activeStreams}</p>
          </div>
          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-green-500 hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all">
            <h2 className="text-xl font-semibold text-white mb-4">Recent Logins</h2>
            <p className="text-4xl font-bold text-white">{analytics.recentLogins.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800">
            <h2 className="text-2xl font-semibold text-white mb-6">Login Activity</h2>
            <Line
              data={loginData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    labels: { color: 'white' }
                  }
                },
                scales: {
                  y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: 'white' }
                  },
                  x: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: 'white' }
                  }
                }
              }}
            />
          </div>

          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-purple-500">
            <h2 className="text-2xl font-semibold text-white mb-6">Stream Control</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="channel-id" className="block text-sm font-medium text-gray-300 mb-2">
                  YouTube Channel ID
                </label>
                <input
                  type="text"
                  id="channel-id"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-2"
                  placeholder="Enter your YouTube channel ID"
                />
              </div>
              <button
                onClick={startStream}
                disabled={streamActive}
                className={`w-full py-2 px-4 rounded-lg font-medium ${streamActive
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-purple-500 hover:bg-purple-600'} text-white transition-colors`}
              >
                {streamActive ? 'Stream Active' : 'Start Stream'}
              </button>
              {streamActive && (
                <p className="text-green-400 text-sm mt-2">
                  Stream is active! Users will be notified automatically.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}