import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export interface RatingHistory {
  id: string;
  userId: string;
  gameType: 'rapid' | 'blitz' | 'bullet';
  rating: number;
  timestamp: Date;
}

export interface LevelProgress {
  currentLevel: number;
  ratingGain: number;
  puzzlesSolved: number;
  gamesWon: number;
  streakWins: number;
}

export async function trackRating(userId: string, gameType: string, rating: number): Promise<void> {
  try {
    await supabase.from('rating_history').insert({
      user_id: userId,
      game_type: gameType,
      rating: rating
    });
  } catch (error) {
    console.error('Error tracking rating:', error);
    throw error;
  }
}

export async function getRatingProgress(userId: string, gameType: string): Promise<number> {
  try {
    const { data: initialRating } = await supabase
      .from('rating_history')
      .select('rating')
      .eq('user_id', userId)
      .eq('game_type', gameType)
      .order('timestamp', { ascending: true })
      .limit(1)
      .single();

    const { data: currentRating } = await supabase
      .from('rating_history')
      .select('rating')
      .eq('user_id', userId)
      .eq('game_type', gameType)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (!initialRating || !currentRating) return 0;
    return currentRating.rating - initialRating.rating;
  } catch (error) {
    console.error('Error getting rating progress:', error);
    return 0;
  }
}

export async function checkLevelUp(userId: string): Promise<LevelProgress> {
  try {
    // Get user's chess.com username
    const { data: userData } = await supabase
      .from('users')
      .select('chess_username')
      .eq('id', userId)
      .single();

    if (!userData?.chess_username) {
      throw new Error('Chess.com username not found');
    }

    // Fetch chess.com stats
    const response = await fetch(`https://api.chess.com/pub/player/${userData.chess_username}/stats`);
    if (!response.ok) throw new Error('Failed to fetch chess.com stats');
    const chessComStats = await response.json();

    // Calculate current level based on rating
    const ratings = [
      chessComStats.chess_rapid?.last.rating || 0,
      chessComStats.chess_blitz?.last.rating || 0,
      chessComStats.chess_bullet?.last.rating || 0
    ];
    const maxRating = Math.max(...ratings);
    const currentLevel = Math.floor(maxRating / 100);

    // Calculate rating gain from initial rating
    const initialRating = await getRatingProgress(userId, 'rapid');
    const ratingGain = Math.max(0, maxRating - initialRating);

    // Get puzzles solved from chess.com API and database
    const { count: puzzlesSolved } = await supabase
      .from('achievements')
      .select('count', { count: 'exact' })
      .eq('user_id', userId)
      .eq('achievement_type', 'puzzle_solved');

    // Calculate total games won across all formats
    const gamesWon = (
      (chessComStats.chess_rapid?.record.win || 0) +
      (chessComStats.chess_blitz?.record.win || 0) +
      (chessComStats.chess_bullet?.record.win || 0)
    );

    // Calculate current win streak from recent games
    const { data: recentGames } = await supabase
      .from('game_records')
      .select('result')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(5);

    let streakWins = 0;
    for (const game of recentGames || []) {
      if (game.result === 'win') streakWins++;
      else break;
    }

    return {
      currentLevel,
      ratingGain,
      puzzlesSolved: puzzlesSolved || 0,
      gamesWon: gamesWon || 0,
      streakWins
    };
  } catch (error) {
    console.error('Error checking level progress:', error);
    return {
      currentLevel: 0,
      ratingGain: 0,
      puzzlesSolved: 0,
      gamesWon: 0,
      streakWins: 0
    };
  }
}