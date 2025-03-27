/**
 * Chess Game Service
 * Provides functionality for fetching and processing chess games from Chess.com
 */

export interface ChessGamePlayer {
    username: string;
    rating?: number;
    result: string;
  }
  
  export interface ChessGameData {
    url: string;
    pgn?: string;
    fen?: string;
    time_control: string;
    end_time: number;
    rated: boolean;
    white: ChessGamePlayer;
    black: ChessGamePlayer;
    time_class: string;
    rules: string;
  }
  
  export interface FormattedGameData {
    fen?: string;
    pgn?: string;
    playerColor: string;
    opponentColor: string;
    opponentUsername: string;
    result: string;
    resultText: string;
    resultClass: string;
    date: string;
    time: string;
    timeControl: string;
    url: string;
    white: ChessGamePlayer;
    black: ChessGamePlayer;
    end_time: number;
    gameId?: string;
  }
  
  /**
   * Fetches archives of games for a given username
   * @param username - Chess.com username
   * @returns Array of archive URLs
   */
  export async function fetchGameArchives(username: string): Promise<string[]> {
    try {
      const response = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
      if (!response.ok) {
        throw new Error(`Failed to fetch game archives: ${response.statusText}`);
      }
      const data = await response.json();
      return data.archives || [];
    } catch (error) {
      console.error("Error fetching game archives:", error);
      throw error;
    }
  }
  
  /**
   * Fetches games for a specific month
   * @param archiveUrl - URL to the monthly archive
   * @returns Array of game data objects
   */
  export async function fetchGamesForMonth(archiveUrl: string): Promise<ChessGameData[]> {
    try {
      const response = await fetch(archiveUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch monthly games: ${response.statusText}`);
      }
      const data = await response.json();
      return data.games || [];
    } catch (error) {
      console.error("Error fetching monthly games:", error);
      throw error;
    }
  }
  
  /**
   * Fetches a specific game by its unique ID by searching through recent monthly archives
   * @param gameId - Chess.com game ID (numeric or URL)
   * @param username - Chess.com username (optional, speeds up search)
   * @returns Game data object
   */
  export async function fetchGameById(gameId: string, username?: string): Promise<ChessGameData> {
    try {
      // Extract numeric ID if full URL was provided
      const numericId = gameId.includes('/') ? gameId.split('/').pop() : gameId;
      
      if (!numericId) {
        throw new Error("Invalid game ID");
      }
      
      // If username is provided, search through their archives
      if (username) {
        const archives = await fetchGameArchives(username);
        
        // Sort archives in descending order (most recent first)
        const sortedArchives = [...archives].sort((a, b) => b.localeCompare(a));
        
        // Look through the 3 most recent months (if available)
        const recentArchives = sortedArchives.slice(0, 3);
        
        for (const archive of recentArchives) {
          const games = await fetchGamesForMonth(archive);
          
          // Find the game with matching ID
          const game = games.find(g => {
            const gameUrlId = g.url.split('/').pop();
            return gameUrlId === numericId;
          });
          
          if (game) {
            console.log(`Found game in archive: ${archive}`);
            return game;
          }
        }
      }
      
      // Fallback: Try to fetch directly from the March 2025 archive as suggested
      // (use this for development/testing with known data)
      try {
        const specificArchive = `https://api.chess.com/pub/player/aggani007/games/2025/03`;
        const games = await fetchGamesForMonth(specificArchive);
        
        const game = games.find(g => {
          const gameUrlId = g.url.split('/').pop();
          return gameUrlId === numericId;
        });
        
        if (game) {
          console.log(`Found game in hardcoded archive`);
          return game;
        }
      } catch (fallbackError) {
        console.error("Fallback archive search failed:", fallbackError);
      }
      
      throw new Error(`Game with ID ${numericId} not found in recent archives`);
    } catch (error) {
      console.error("Error fetching game:", error);
      throw error;
    }
  }
  
  /**
   * Fetches the N most recent games for a user
   * @param username - Chess.com username
   * @param limit - Maximum number of games to fetch (default: 5)
   * @returns Array of formatted game data objects
   */
  export async function fetchRecentGames(username: string, limit: number = 5): Promise<FormattedGameData[]> {
    try {
      const archives = await fetchGameArchives(username);
      if (archives.length === 0) {
        return [];
      }
  
      // Get the most recent archive
      const latestArchiveUrl = archives[archives.length - 1];
      const games = await fetchGamesForMonth(latestArchiveUrl);
  
      // Sort by end time (most recent first) and take the N most recent games
      const sortedGames = games
        .sort((a, b) => b.end_time - a.end_time)
        .slice(0, limit);
  
      // Process games to add result information
      return sortedGames.map((game) => formatGameData(game, username));
    } catch (error) {
      console.error("Error fetching recent games:", error);
      throw error;
    }
  }
  
  /**
   * Transforms raw game data into a more usable format
   * @param game - Raw game data from Chess.com API
   * @param username - Chess.com username to identify the player
   * @returns Formatted game data
   */
  export function formatGameData(game: ChessGameData, username: string): FormattedGameData {
    const playerColor = game.white.username.toLowerCase() === username.toLowerCase() ? "white" : "black";
    const opponentColor = playerColor === "white" ? "black" : "white";
    const result = game[playerColor].result;
    const gameId = game.url.split('/').pop();
  
    return {
      ...game,
      gameId,
      playerColor,
      opponentColor,
      opponentUsername: game[opponentColor].username,
      result,
      resultText: result === "win" ? "Victory" : result === "draw" ? "Draw" : "Defeat",
      resultClass: result === "win" ? "text-green-500" : result === "draw" ? "text-yellow-500" : "text-red-500",
      date: new Date(game.end_time * 1000).toLocaleDateString(),
      time: new Date(game.end_time * 1000).toLocaleTimeString(),
      timeControl: game.time_control,
    };
  }
  
  /**
   * Calculates win rate based on game results
   * @param wins - Number of wins
   * @param losses - Number of losses
   * @param draws - Number of draws
   * @returns Win rate percentage
   */
  export function calculateWinRate(wins: number, losses: number, draws: number): number {
    const total = wins + losses + draws;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  }
  
  /**
   * Parse PGN string to extract moves
   * @param pgn - PGN string representation of a game
   * @returns Array of moves in SAN notation
   */
  export function parsePgnMoves(pgn: string): string[] {
    // This is a simplified PGN parser that extracts moves
    // Remove comments
    let cleanPgn = pgn.replace(/\{[^}]*\}/g, '');
    
    // Remove header tags
    cleanPgn = cleanPgn.replace(/\[\s*\w+\s*"[^"]*"\s*\]\s*/g, '');
    
    // Remove move numbers
    cleanPgn = cleanPgn.replace(/\d+\.\s*/g, '');
    
    // Remove result
    cleanPgn = cleanPgn.replace(/1-0|0-1|1\/2-1\/2|\*/g, '');
    
    // Split by whitespace and filter empty strings
    return cleanPgn.split(/\s+/).filter(move => move.trim().length > 0);
  }
  
  /**
   * Generates a unique task ID for Chess API requests
   * @returns Unique string ID
   */
  export function generateTaskId(): string {
    return Math.random().toString(36).substring(2, 12);
  }