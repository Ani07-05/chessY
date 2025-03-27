// Types for Chess.com API data and chess game review

// Type for game data from Chess.com API
export interface GameData {
    url: string;
    pgn: string;
    time_control: string;
    end_time: number;
    rated: boolean;
    accuracies?: {
      white: number;
      black: number;
    };
    fen: string;
    time_class: string;
    rules: string;
    white: {
      rating: number;
      result: string;
      username: string;
      uuid?: string;
      "@id"?: string;
    };
    black: {
      rating: number;
      result: string;
      username: string;
      uuid?: string;
      "@id"?: string;
    };
    eco?: string;
    tournament?: string;
    match?: string;
    // Additional fields for UI display
    playerColor?: string;
    opponentColor?: string;
    opponentUsername?: string;
    result?: string;
    resultText?: string;
    resultClass?: string;
    date?: string;
    time?: string;
  }
  
  // Type for player stats from Chess.com API
  export interface ChessStats {
    chess_rapid?: {
      last: { rating: number; date: number; rd: number };
      best?: { rating: number; date: number; game?: string };
      record: { win: number; loss: number; draw: number; time_per_move?: number; timeout_percent?: number };
      tournament?: { count: number; withdraw: number; points: number; highest_finish: number };
    };
    chess_blitz?: {
      last: { rating: number; date: number; rd: number };
      best?: { rating: number; date: number; game?: string };
      record: { win: number; loss: number; draw: number; time_per_move?: number; timeout_percent?: number };
      tournament?: { count: number; withdraw: number; points: number; highest_finish: number };
    };
    chess_bullet?: {
      last: { rating: number; date: number; rd: number };
      best?: { rating: number; date: number; game?: string };
      record: { win: number; loss: number; draw: number; time_per_move?: number; timeout_percent?: number };
      tournament?: { count: number; withdraw: number; points: number; highest_finish: number };
    };
    tactics?: {
      highest: { rating: number; date: number };
      lowest: { rating: number; date: number };
    };
    lessons?: {
      highest: { rating: number; date: number };
      lowest: { rating: number; date: number };
    };
    puzzle_rush?: {
      daily: { total_attempts: number; score: number };
      best: { total_attempts: number; score: number };
    };
  }
  
  // Types for move analysis
  
  export type MoveQuality = 
    | 'brilliant' 
    | 'best' 
    | 'great' 
    | 'good' 
    | 'book' 
    | 'inaccuracy' 
    | 'mistake' 
    | 'blunder';
  
  export interface MoveAnalysis {
    fen: string;
    move: string;
    evaluation: number;
    bestMove: string;
    bestEvaluation: number;
    moveQuality: MoveQuality;
    ply: number;
    playerColor: 'w' | 'b';
  }
  
  export interface MoveEvaluation {
    moveNumber: number;
    moveText: string;
    fen: string;
    evaluation: number;
    bestMove: string;
    bestEvaluation: number;
    evalDifference: number;
    quality: MoveQuality;
    playerColor: 'w' | 'b';
  }
  
  // Rating-based evaluation thresholds
  export interface RatingThresholds {
    brilliant: number;
    best: number;
    great: number;
    good: number;
    inaccuracy: number;
    mistake: number;
    // blunder is anything above mistake threshold
  }
  
  // Archives from Chess.com API
  export interface ArchivesResponse {
    archives: string[];
  }
  
  // Monthly archive of games
  export interface MonthlyArchive {
    games: GameData[];
  }