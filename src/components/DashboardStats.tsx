'use client';

import { useEffect, useState } from 'react';
// import { Line } from 'react-chartjs-2';
import { checkLevelUp, LevelProgress } from '../services/ratings';

interface DashboardStatsProps {
  userId: string;
  chessUsername: string;
  onUsernameUpdate: (newUsername: string) => void;
}

export default function DashboardStats({ userId, chessUsername, onUsernameUpdate }: DashboardStatsProps) {
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(chessUsername);

  useEffect(() => {
    const fetchLevelProgress = async () => {
      const progress = await checkLevelUp(userId);
      setLevelProgress(progress);
    };

    fetchLevelProgress();
  }, [userId]);

  const handleUsernameUpdate = async () => {
    try {
      onUsernameUpdate(newUsername);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating username:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      {/* Level Progress Card */}
      <div className="bg-gray-900 p-6 rounded-xl border border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all hover:shadow-[0_0_20px_rgba(147,51,234,0.5)]">
        <h2 className="text-2xl font-bold text-white mb-4">Level Progress</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Current Level</span>
            <span className="text-white font-bold text-xl">{levelProgress?.currentLevel || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Rating Gain</span>
            <span className="text-green-400 font-bold">+{levelProgress?.ratingGain || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Puzzles Solved</span>
            <span className="text-blue-400 font-bold">{levelProgress?.puzzlesSolved || 0}/30</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Games Won</span>
            <span className="text-yellow-400 font-bold">{levelProgress?.gamesWon || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Win Streak</span>
            <span className="text-red-400 font-bold">{levelProgress?.streakWins || 0}/5</span>
          </div>
        </div>
      </div>

      {/* Chess.com Username Card */}
      <div className="bg-gray-900 p-6 rounded-xl border border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
        <h2 className="text-2xl font-bold text-white mb-4">Chess.com Profile</h2>
        {isEditing ? (
          <div className="space-y-4">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full bg-gray-800 text-white border border-blue-500 rounded-lg p-2"
            />
            <div className="flex space-x-4">
              <button
                onClick={handleUsernameUpdate}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Username</span>
            <div className="flex items-center space-x-4">
              <span className="text-white font-bold">{chessUsername}</span>
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}