'use client';

import { useState, useEffect } from 'react';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import DashboardStats from '@/components/DashboardStats';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ChessStats {
  chess_rapid?: {
    last: { rating: number };
    record: { win: number; loss: number; draw: number };
  };
  chess_blitz?: {
    last: { rating: number };
    record: { win: number; loss: number; draw: number };
  };
  chess_bullet?: {
    last: { rating: number };
    record: { win: number; loss: number; draw: number };
  };
}

interface ClassProgress {
  gamesPlayed: number;
  gamesWon: number;
  gamesDrawn: number;
  levelProgress: number;
  lastClassDate: Date;
  nextClassDate: Date;
}

export default function Dashboard() {
  const [stats, setStats] = useState<ChessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('magnuscarlsen');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [classProgress, setClassProgress] = useState<ClassProgress | null>(null);

  const FIRST_CLASS_DATE = new Date('2025-03-03');
  const CLASS_INTERVAL = 7; // days

  const getNextClassDate = (fromDate: Date = new Date()): Date => {
    const nextDate = new Date(FIRST_CLASS_DATE);
    while (nextDate <= fromDate) {
      nextDate.setDate(nextDate.getDate() + CLASS_INTERVAL);
    }
    return nextDate;
  };

  const getLastClassDate = (fromDate: Date = new Date()): Date => {
    const lastDate = getNextClassDate(fromDate);
    lastDate.setDate(lastDate.getDate() - CLASS_INTERVAL);
    return lastDate;
  };

  const fetchGameArchives = async (username: string): Promise<string[]> => {
    const response = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
    if (!response.ok) throw new Error('Failed to fetch game archives');
    const data = await response.json();
    return data.archives;
  };

  const fetchGamesForMonth = async (archiveUrl: string): Promise<any[]> => {
    const response = await fetch(archiveUrl);
    if (!response.ok) throw new Error('Failed to fetch monthly games');
    const data = await response.json();
    return data.games || [];
  };

  const fetchClassProgress = async () => {
    try {
      const lastClass = getLastClassDate();
      const nextClass = getNextClassDate();
      
      const archives = await fetchGameArchives(username);
      let gamesPlayed = 0;
      let gamesWon = 0;
      let gamesDrawn = 0;

      for (const archiveUrl of archives) {
        const games = await fetchGamesForMonth(archiveUrl);
        
        for (const game of games) {
          const gameEndTime = new Date(game.end_time * 1000);
          if (gameEndTime > lastClass && gameEndTime <= nextClass) {
            gamesPlayed++;
            const playerColor = game.white.username.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
            const result = game[playerColor].result;
            
            if (result === 'win') gamesWon++;
            else if (result === 'draw' || result === 'stalemate') gamesDrawn++;
          }
        }
      }

      // Calculate level progress (example formula)
      const levelProgress = Math.min(100, (gamesWon * 20 + gamesDrawn * 10));

      setClassProgress({
        gamesPlayed,
        gamesWon,
        gamesDrawn,
        levelProgress,
        lastClassDate: lastClass,
        nextClassDate: nextClass
      });
    } catch (err) {
      console.error('Error fetching class progress:', err);
    }
  };

  useEffect(() => {
    // Check if user is superadmin
    const checkSuperAdmin = async () => {
      try {
        const response = await fetch('/api/check-superadmin');
        const data = await response.json();
        setIsSuperAdmin(data.isSuperAdmin);
      } catch (err) {
        console.error('Error checking superadmin status:', err);
      }
    };

    checkSuperAdmin();
  }, []);

  useEffect(() => {
    // Check if user is superadmin
    const checkSuperAdmin = async () => {
      try {
        const response = await fetch('/api/check-superadmin');
        const data = await response.json();
        setIsSuperAdmin(data.isSuperAdmin);
      } catch (err) {
        console.error('Error checking superadmin status:', err);
      }
    };

    checkSuperAdmin();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data);
        await fetchClassProgress(); // Fetch class progress after stats
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Set up timer to check progress 10 minutes before next class
    const nextClass = getNextClassDate();
    const checkTime = new Date(nextClass.getTime() - 10 * 60 * 1000); // 10 minutes before
    const now = new Date();
    const timeUntilCheck = checkTime.getTime() - now.getTime();
    
    if (timeUntilCheck > 0) {
      const timer = setTimeout(fetchClassProgress, timeUntilCheck);
      return () => clearTimeout(timer);
    }
  }, [username]);

  const handleUsernameUpdate = (newUsername: string) => {
    setUsername(newUsername);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white text-xl">Loading...</div></div>;
  if (error) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-red-500 text-xl">{error}</div></div>;
  if (!stats) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white text-xl">No stats available</div></div>;

  const ratingsData = {
    labels: ['Rapid', 'Blitz', 'Bullet'],
    datasets: [
      {
        label: 'Ratings',
        data: [
          stats.chess_rapid?.last.rating || 0,
          stats.chess_blitz?.last.rating || 0,
          stats.chess_bullet?.last.rating || 0
        ],
        borderColor: 'rgb(255, 255, 255)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }
    ]
  };

  const getWinRateData = (type: 'chess_rapid' | 'chess_blitz' | 'chess_bullet') => {
    const record = stats[type]?.record;
    if (!record) return { labels: [], data: [] };

    return {
      labels: ['Wins', 'Losses', 'Draws'],
      datasets: [
        {
          data: [record.win, record.loss, record.draw],
          backgroundColor: [
            'rgba(255, 255, 255, 0.9)',
            'rgba(239, 68, 68, 0.9)',
            'rgba(234, 179, 8, 0.9)'
          ],
          borderColor: [
            'rgba(255, 255, 255, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(234, 179, 8, 1)'
          ],
          borderWidth: 2
        }
      ]
    };
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <DashboardStats userId="123" chessUsername={username} onUsernameUpdate={handleUsernameUpdate} />

        {classProgress && (
          <div className="mb-12 bg-gray-900 p-6 rounded-2xl shadow-xl border border-purple-500 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] transition-all">
            <h2 className="text-2xl font-semibold text-white mb-6">Class Progress Report</h2>
            <div className="space-y-4 text-white">
              <p className="text-lg">Since last class ({classProgress.lastClassDate.toLocaleDateString()}), you have:</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>Played <span className="font-bold text-blue-400">{classProgress.gamesPlayed}</span> games</li>
                <li>Won <span className="font-bold text-green-400">{classProgress.gamesWon}</span> games</li>
                <li>Drew <span className="font-bold text-yellow-400">{classProgress.gamesDrawn}</span> games</li>
              </ul>
              <div className="mt-6">
                <p className="text-lg mb-2">Current Level Progress:</p>
                <div className="w-full bg-gray-700 rounded-full h-4">
                  <div 
                    className="bg-purple-500 rounded-full h-4 transition-all duration-1000"
                    style={{ width: `${classProgress.levelProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-400 mt-2">Next class: {classProgress.nextClassDate.toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800 transform hover:scale-105 transition-transform duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            <h3 className="text-xl font-semibold text-white mb-4">Rapid Rating</h3>
            <p className="text-4xl font-bold text-white">{stats.chess_rapid?.last.rating || 'N/A'}</p>
          </div>
          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800 transform hover:scale-105 transition-transform duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            <h3 className="text-xl font-semibold text-white mb-4">Blitz Rating</h3>
            <p className="text-4xl font-bold text-white">{stats.chess_blitz?.last.rating || 'N/A'}</p>
          </div>
          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800 transform hover:scale-105 transition-transform duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            <h3 className="text-xl font-semibold text-white mb-4">Bullet Rating</h3>
            <p className="text-4xl font-bold text-white">{stats.chess_bullet?.last.rating || 'N/A'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all">
            <h2 className="text-2xl font-semibold text-white mb-6">Rating Progression</h2>
            <Line
              data={ratingsData}
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

          <div className="grid grid-cols-1 gap-8">
            <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all">
              <h2 className="text-2xl font-semibold text-white mb-6">Game Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Rapid Games</h3>
                  <Pie
                    data={getWinRateData('chess_rapid')}
                    options={{
                      plugins: {
                        legend: {
                          labels: { color: 'white' }
                        }
                      }
                    }}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Blitz Games</h3>
                  <Pie
                    data={getWinRateData('chess_blitz')}
                    options={{
                      plugins: {
                        legend: {
                          labels: { color: 'white' }
                        }
                      }
                    }}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Bullet Games</h3>
                  <Pie
                    data={getWinRateData('chess_bullet')}
                    options={{
                      plugins: {
                        legend: {
                          labels: { color: 'white' }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="mt-8">
            <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-purple-500 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] transition-all">
              <h2 className="text-2xl font-semibold text-white mb-6">Live Stream</h2>
              <div className="aspect-video w-full">
                <iframe
                  className="w-full h-full rounded-lg"
                  src="https://www.youtube.com/embed/live_stream?channel=YOUR_CHANNEL_ID"
                  frameBorder="0"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}