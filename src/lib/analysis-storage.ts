/**
 * Analysis Storage Service
 * Handles persistence of game analysis data in the Supabase database
 */

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "./database";

export interface GameAnalysisData {
  gameId: string;
  gameUrl: string;
  playerColor: string;
  pgn?: string;
  accuracyScore?: number;
  opponentAccuracy?: number;
  engineDepth: number;
  moveAnalyses: MoveAnalysis[];
}

export interface MoveAnalysis {
  moveIndex: number;
  fen: string;
  moveSan: string;
  moveUci?: string;
  evalBefore?: number;
  evalAfter?: number;
  bestMove?: string;
  quality?: string;
  timeSpent?: number;
  engineDepth: number;
  principalVariation?: any;
}

/**
 * Save complete game analysis to the database
 * @param userId - User ID
 * @param analysisData - Complete game analysis data
 * @returns Success status and analysis ID
 */
export async function saveGameAnalysis(
  userId: string,
  analysisData: GameAnalysisData
): Promise<{ success: boolean; analysisId?: string; error?: string }> {
  const supabase = createClientComponentClient<Database>();
  
  try {
    // First, check if an analysis for this game already exists
    const { data: existingAnalysis, error: fetchError } = await supabase
      .from('game_analyses')
      .select('id')
      .eq('user_id', userId)
      .eq('game_id', analysisData.gameId)
      .maybeSingle();
    
    if (fetchError) {
      throw fetchError;
    }
    
    let analysisId: string;
    
    // If analysis exists, update it; otherwise, insert new one
    if (existingAnalysis) {
      analysisId = existingAnalysis.id;
      
      // Update the existing analysis
      const { error: updateError } = await supabase
        .from('game_analyses')
        .update({
          analysis_data: analysisData.moveAnalyses as unknown as Json,
          accuracy_score: analysisData.accuracyScore,
          opponent_accuracy: analysisData.opponentAccuracy,
          pgn: analysisData.pgn,
          status: 'completed',
          engine_depth: analysisData.engineDepth,
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId);
      
      if (updateError) {
        throw updateError;
      }
      
      // Delete previous move analyses to replace with new ones
      const { error: deleteError } = await supabase
        .from('move_analyses')
        .delete()
        .eq('game_analysis_id', analysisId);
      
      if (deleteError) {
        throw deleteError;
      }
    } else {
      // Insert new game analysis
      const { data: newAnalysis, error: insertError } = await supabase
        .from('game_analyses')
        .insert({
          user_id: userId,
          game_id: analysisData.gameId,
          game_url: analysisData.gameUrl,
          player_color: analysisData.playerColor,
          analysis_data: analysisData.moveAnalyses as Json,
          accuracy_score: analysisData.accuracyScore,
          opponent_accuracy: analysisData.opponentAccuracy,
          pgn: analysisData.pgn,
          status: 'completed',
          engine_depth: analysisData.engineDepth
        })
        .select('id')
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      analysisId = newAnalysis.id;
    }
    
    // Insert all move analyses
    const moveAnalysesInserts = analysisData.moveAnalyses.map(ma => ({
      game_analysis_id: analysisId,
      move_index: ma.moveIndex,
      fen: ma.fen,
      move_san: ma.moveSan,
      move_uci: ma.moveUci || '',
      eval_before: ma.evalBefore,
      eval_after: ma.evalAfter,
      best_move: ma.bestMove,
      quality: ma.quality,
      time_spent: ma.timeSpent,
      engine_depth: ma.engineDepth,
      principal_variation: ma.principalVariation
    }));
    
    // Batch insert all move analyses
    const { error: moveInsertError } = await supabase
      .from('move_analyses')
      .insert(moveAnalysesInserts);
    
    if (moveInsertError) {
      throw moveInsertError;
    }
    
    return { success: true, analysisId };
  } catch (error) {
    console.error("Error saving game analysis:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error saving analysis" 
    };
  }
}

/**
 * Start a new game analysis session
 * @param userId - User ID
 * @param gameId - Chess.com game ID
 * @param gameUrl - Game URL
 * @param playerColor - Player's color (white or black)
 * @param pgn - Optional PGN string
 * @returns Analysis ID
 */
export async function startGameAnalysis(
  userId: string,
  gameId: string,
  gameUrl: string,
  playerColor: string,
  pgn?: string
): Promise<string | null> {
  const supabase = createClientComponentClient<Database>();
  
  try {
    // Check if analysis exists
    const { data: existingAnalysis, error: fetchError } = await supabase
      .from('game_analyses')
      .select('id')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .maybeSingle();
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (existingAnalysis) {
      // Update status to in-progress
      await supabase
        .from('game_analyses')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAnalysis.id);
      
      return existingAnalysis.id;
    } else {
      // Create new analysis
      const { data, error } = await supabase
        .from('game_analyses')
        .insert({
          user_id: userId,
          game_id: gameId,
          game_url: gameUrl,
          player_color: playerColor,
          pgn,
          status: 'in_progress',
          engine_depth: 18 // Default depth
        })
        .select('id')
        .single();
      
      if (error) {
        throw error;
      }
      
      return data.id;
    }
  } catch (error) {
    console.error("Error starting game analysis:", error);
    return null;
  }
}

/**
 * Save an individual move analysis
 * @param analysisId - Game analysis ID
 * @param moveAnalysis - Move analysis data
 * @returns Success status
 */
export async function saveMoveAnalysis(
  analysisId: string,
  moveAnalysis: MoveAnalysis
): Promise<boolean> {
  const supabase = createClientComponentClient<Database>();
  
  try {
    // Check if this move already has an analysis
    const { data: existingMove, error: fetchError } = await supabase
      .from('move_analyses')
      .select('id')
      .eq('game_analysis_id', analysisId)
      .eq('move_index', moveAnalysis.moveIndex)
      .maybeSingle();
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (existingMove) {
      // Update existing move analysis
      const { error: updateError } = await supabase
        .from('move_analyses')
        .update({
          fen: moveAnalysis.fen,
          move_san: moveAnalysis.moveSan,
          move_uci: moveAnalysis.moveUci || '',
          eval_before: moveAnalysis.evalBefore,
          eval_after: moveAnalysis.evalAfter,
          best_move: moveAnalysis.bestMove,
          quality: moveAnalysis.quality,
          time_spent: moveAnalysis.timeSpent,
          engine_depth: moveAnalysis.engineDepth,
          principal_variation: moveAnalysis.principalVariation
        })
        .eq('id', existingMove.id);
      
      if (updateError) {
        throw updateError;
      }
    } else {
      // Insert new move analysis
      const { error: insertError } = await supabase
        .from('move_analyses')
        .insert({
          game_analysis_id: analysisId,
          move_index: moveAnalysis.moveIndex,
          fen: moveAnalysis.fen,
          move_san: moveAnalysis.moveSan,
          move_uci: moveAnalysis.moveUci || '',
          eval_before: moveAnalysis.evalBefore,
          eval_after: moveAnalysis.evalAfter,
          best_move: moveAnalysis.bestMove,
          quality: moveAnalysis.quality,
          time_spent: moveAnalysis.timeSpent,
          engine_depth: moveAnalysis.engineDepth,
          principal_variation: moveAnalysis.principalVariation
        });
      
      if (insertError) {
        throw insertError;
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error saving move analysis:", error);
    return false;
  }
}

/**
 * Retrieve a previously saved game analysis
 * @param userId - User ID
 * @param gameId - Chess.com game ID
 * @returns Complete game analysis data
 */
export async function getGameAnalysis(
  userId: string,
  gameId: string
): Promise<GameAnalysisData | null> {
  const supabase = createClientComponentClient<Database>();
  
  try {
    // Get the game analysis record
    const { data: gameAnalysis, error: gameError } = await supabase
      .from('game_analyses')
      .select('*')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .single();
    
    if (gameError) {
      throw gameError;
    }
    
    if (!gameAnalysis) {
      return null;
    }
    
    // Get all move analyses for this game
    const { data: moveAnalyses, error: moveError } = await supabase
      .from('move_analyses')
      .select('*')
      .eq('game_analysis_id', gameAnalysis.id)
      .order('move_index', { ascending: true });
    
    if (moveError) {
      throw moveError;
    }
    
    // Convert to the expected format
    const formattedMoveAnalyses: MoveAnalysis[] = moveAnalyses.map(ma => ({
      moveIndex: ma.move_index,
      fen: ma.fen,
      moveSan: ma.move_san,
      moveUci: ma.move_uci,
      evalBefore: ma.eval_before || undefined,
      evalAfter: ma.eval_after || undefined,
      bestMove: ma.best_move || undefined,
      quality: ma.quality || undefined,
      timeSpent: ma.time_spent || undefined,
      engineDepth: ma.engine_depth,
      principalVariation: ma.principal_variation
    }));
    
    return {
      gameId: gameAnalysis.game_id,
      gameUrl: gameAnalysis.game_url,
      playerColor: gameAnalysis.player_color,
      pgn: gameAnalysis.pgn || undefined,
      accuracyScore: gameAnalysis.accuracy_score || undefined,
      opponentAccuracy: gameAnalysis.opponent_accuracy || undefined,
      engineDepth: gameAnalysis.engine_depth,
      moveAnalyses: formattedMoveAnalyses
    };
  } catch (error) {
    console.error("Error retrieving game analysis:", error);
    return null;
  }
}

/**
 * Updates the accuracy scores for a game analysis
 * @param analysisId - Game analysis ID
 * @param playerAccuracy - Player's accuracy score
 * @param opponentAccuracy - Opponent's accuracy score
 * @returns Success status
 */
export async function updateAccuracyScores(
  analysisId: string,
  playerAccuracy: number,
  opponentAccuracy: number
): Promise<boolean> {
  const supabase = createClientComponentClient<Database>();
  
  try {
    const { error } = await supabase
      .from('game_analyses')
      .update({
        accuracy_score: playerAccuracy,
        opponent_accuracy: opponentAccuracy,
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Error updating accuracy scores:", error);
    return false;
  }
}

/**
 * Retrieves a list of recent analyses for a user
 * @param userId - User ID
 * @param limit - Maximum number of analyses to retrieve
 * @returns Array of game analyses with basic information
 */
export async function getRecentAnalyses(
  userId: string,
  limit: number = 5
): Promise<any[]> {
  const supabase = createClientComponentClient<Database>();
  
  try {
    const { data, error } = await supabase
      .from('game_analyses')
      .select(`
        id,
        game_id,
        game_url,
        player_color,
        accuracy_score,
        opponent_accuracy,
        created_at,
        status
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error retrieving recent analyses:", error);
    return [];
  }
}