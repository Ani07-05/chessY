// Define the type for game result
type GameResult = "win" | "loss" | "draw"

// Define the player info type
interface PlayerInfo {
  username: string
  rating?: number
  result: GameResult
}

// Define the Chess.com API game data type
interface ChessGameData {
  url: string
  pgn: string
  time_control: string
  end_time: number
  white: PlayerInfo
  black: PlayerInfo
  // Add other properties as needed
}

// Archive data from Chess.com API
interface ArchiveData {
  games: ChessGameData[]
}

/**
 * Fetches a specific chess game by ID from Chess.com archives
 * @param gameId The ID of the game to fetch
 * @param username Optional username to search in specific user archives
 * @returns The game data
 */
export async function fetchGameById(gameId: string, username?: string): Promise<ChessGameData> {
  if (!gameId) {
    throw new Error("Game ID is required");
  }
  
  // If username is provided, use it, otherwise try recent archives
  const targetUsername = username || "aggani007"; // Default username if none provided

  try {
    // Try to fetch the archives list for the user
    const archivesResponse = await fetch(`https://api.chess.com/pub/player/${targetUsername}/games/archives`);
    
    if (!archivesResponse.ok) {
      throw new Error(`Failed to fetch archives: ${archivesResponse.statusText}`);
    }
    
    const archivesData = await archivesResponse.json();
    
    if (!archivesData.archives || archivesData.archives.length === 0) {
      throw new Error(`No archives found for ${targetUsername}`);
    }
    
    // Sort archives in descending order (newest first)
    const sortedArchives = [...archivesData.archives].sort().reverse();
    
    // Search for the game in the archives, starting with the most recent
    for (const archiveUrl of sortedArchives) {
      try {
        const gameData = await searchGameInArchive(archiveUrl, gameId);
        if (gameData) {
          return gameData;
        }
      } catch (error) {
        console.warn(`Error searching archive ${archiveUrl}:`, error);
        // Continue to the next archive
      }
    }
    
    // If we've searched all archives and haven't found the game, try the most recent month specifically
    // This is a fallback mechanism since sometimes games might not appear in the archives list immediately
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const formattedMonth = month < 10 ? `0${month}` : `${month}`;
    
    const currentMonthArchiveUrl = `https://api.chess.com/pub/player/${targetUsername}/games/${year}/${formattedMonth}`;
    
    try {
      const gameData = await searchGameInArchive(currentMonthArchiveUrl, gameId);
      if (gameData) {
        return gameData;
      }
    } catch (error) {
      console.error(`Error searching current month archive:`, error);
    }
    
    // If we've exhausted all options, try the March 2025 archive specifically as mentioned in the original code
    try {
      const hardcodedArchiveUrl = `https://api.chess.com/pub/player/${targetUsername}/games/2025/03`;
      const gameData = await searchGameInArchive(hardcodedArchiveUrl, gameId);
      if (gameData) {
        return gameData;
      }
    } catch (error) {
      console.error(`Error searching hardcoded archive:`, error);
    }

    throw new Error(`Game with ID ${gameId} not found in any archive`);
  } catch (error) {
    console.error("Error fetching game by ID:", error);
    throw error;
  }
}

/**
 * Search for a specific game in an archive
 * @param archiveUrl The URL of the archive to search
 * @param gameId The ID of the game to find
 * @returns The game data or null if not found
 */
async function searchGameInArchive(archiveUrl: string, gameId: string): Promise<ChessGameData | null> {
  const response = await fetch(archiveUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch archive ${archiveUrl}: ${response.statusText}`);
  }
  
  const archiveData: ArchiveData = await response.json();
  
  if (!archiveData.games || archiveData.games.length === 0) {
    return null;
  }
  
  // Search for the game with matching ID
  const game = archiveData.games.find((g) => {
    const gameUrlId = g.url.split("/").pop();
    return gameUrlId === gameId;
  });
  
  return game || null;
}

/**
 * Fetches recent games for a user from Chess.com
 * @param username The username to fetch games for
 * @param limit The maximum number of games to return
 * @returns An array of recent games
 */
export async function fetchRecentGames(username: string, limit = 10): Promise<ChessGameData[]> {
  if (!username) {
    throw new Error("Username is required");
  }
  
  try {
    // Fetch the archives list
    const archivesResponse = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
    
    if (!archivesResponse.ok) {
      throw new Error(`Failed to fetch archives: ${archivesResponse.statusText}`);
    }
    
    const archivesData = await archivesResponse.json();
    
    if (!archivesData.archives || archivesData.archives.length === 0) {
      return [];
    }
    
    // Sort archives in descending order (newest first)
    const sortedArchives = [...archivesData.archives].sort().reverse();
    
    // Get games from the most recent archives until we have enough
    const allGames: ChessGameData[] = [];
    
    for (const archiveUrl of sortedArchives) {
      if (allGames.length >= limit) {
        break;
      }
      
      try {
        const response = await fetch(archiveUrl);
        
        if (!response.ok) {
          console.warn(`Failed to fetch archive ${archiveUrl}: ${response.statusText}`);
          continue;
        }
        
        const archiveData: ArchiveData = await response.json();
        
        if (archiveData.games && archiveData.games.length > 0) {
          // Sort games by end_time in descending order (newest first)
          const sortedGames = [...archiveData.games].sort((a, b) => b.end_time - a.end_time);
          
          allGames.push(...sortedGames.slice(0, limit - allGames.length));
        }
      } catch (error) {
        console.warn(`Error fetching archive ${archiveUrl}:`, error);
      }
    }
    
    return allGames.slice(0, limit);
  } catch (error) {
    console.error("Error fetching recent games:", error);
    throw error;
  }
}