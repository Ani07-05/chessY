export interface Achievement {
  id: string;
  type: string;
  progress: number;
  completed: boolean;
  completedAt?: Date;
}

export interface GameStreak {
  count: number;
  gameType: 'rapid' | 'blitz' | 'bullet';
}

export const ACHIEVEMENTS = {
  WINNING_STREAK_3: 'winning_streak_3',
  WINNING_STREAK_5: 'winning_streak_5',
  RATING_MILESTONE_1000: 'rating_1000',
  RATING_MILESTONE_1500: 'rating_1500',
  RATING_MILESTONE_2000: 'rating_2000'
};

export async function checkWinningStreak(userId: string, gameType: string): Promise<Achievement | null> {
  // This would connect to your Supabase instance to check recent games
  // and return appropriate achievements based on streaks
  return null;
}

export async function checkRatingMilestones(userId: string, rating: number): Promise<Achievement | null> {
  // This would check if the user has reached rating milestones
  // and create/update achievements accordingly
  return null;
}

export async function updateAchievement(userId: string, achievementType: string, progress: number): Promise<void> {
  // This would update the achievement progress in Supabase
  // and mark as completed if necessary
}