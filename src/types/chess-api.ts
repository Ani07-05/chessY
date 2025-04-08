/**
 * Chess API client for interacting with the chess-api.com service
 * Provides position evaluation and analysis
 */

export interface ChessApiRequestOptions {
  fen: string;
  depth?: number;
  variants?: number;
  maxThinkingTime?: number;
  searchmoves?: string;
  taskId?: string;
}

export interface ChessApiResponse {
  text?: string;
  eval: number;
  move?: string;
  san?: string;
  fen: string;
  depth: number;
  winChance?: number;
  continuationArr?: string[];
  mate?: number | null;
  centipawns?: string;
  turn?: string;
  color?: string;
  piece?: string;
  flags?: string;
  isCapture?: boolean;
  isCastling?: boolean;
  isPromotion?: boolean;
  from?: string;
  to?: string;
  fromNumeric?: string;
  toNumeric?: string;
  taskId?: string;
  time?: number;
  type?: string;
  pv?: PrincipalVariation[];
}

export interface PrincipalVariation {
  move: string;
  san: string;
  evaluation: number;
  continuation: string[];
}

export interface GameAnalysis {
  accuracy: number;
  bestMoves: number;
  mistakes: number;
  evaluations: ChessApiResponse[];
  summary: {
    opening: string;
    middlegame: string;
    endgame: string;
  };
}

export interface GameData {
  url: string;
  pgn: string;
  end_time: number;
  time_control: string;
  white: { 
    username: string; 
    rating: number;
    result?: string;
  };
  black: { 
    username: string; 
    rating: number;
    result?: string;
  };
  time_class: string;
  result?: string;
  playerColor?: 'white' | 'black';
  opponentUsername?: string;
  resultText?: string;
  resultClass?: string;
  date?: string;
  time?: string;
}

/**
 * Evaluates a chess position using the chess-api.com service
 * 
 * @param options Request options including FEN and analysis parameters
 * @param timeout Timeout in milliseconds (default: 15000ms)
 * @returns Promise resolving to the evaluation response
 */
export async function evaluatePosition(
  options: ChessApiRequestOptions,
  timeout: number = 15000
): Promise<ChessApiResponse> {
  // Generate a request ID for correlation if not provided
  const requestId = options.taskId || Math.random().toString(36).substring(2, 10);
  
  // Set up default options
  const requestBody = {
    fen: options.fen,
    depth: options.depth || 12,
    variants: options.variants || 1,
    maxThinkingTime: options.maxThinkingTime || 50,
    searchmoves: options.searchmoves || '',
    taskId: requestId
  };
  
  // Create a timeout promise to handle API timeouts
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`API request timed out after ${timeout}ms`)), timeout);
  });
  
  try {
    // Make the actual API call to Chess-API.com with timeout
    const responsePromise = fetch("https://chess-api.com/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    
    // Race the fetch against the timeout
    const response = await Promise.race([responsePromise, timeoutPromise]) as Response;
    
    if (!response.ok) {
      console.error(`API request failed with status ${response.status}: ${response.statusText}`);
      // Fall back to the simulated response if the API call fails
      return simulateEngineResponse(options.fen, options.depth);
    }
    
    const apiResponse = await response.json();
    
    // Validate the response
    if (!apiResponse || typeof apiResponse.eval === 'undefined') {
      console.error('Invalid API response format, falling back to simulated response');
      // Fall back to simulated response on invalid response format
      return simulateEngineResponse(options.fen, options.depth);
    }
    
    // Process principal variations if available
    const processedResponse: ChessApiResponse = {
      ...apiResponse,
      fen: options.fen,
      depth: apiResponse.depth || options.depth || 12,
      eval: typeof apiResponse.eval === 'number' ? apiResponse.eval : 0,
      pv: []
    };
    
    // Process principal variations if available
    if (Array.isArray(apiResponse.pv)) {
      processedResponse.pv = apiResponse.pv;
    } else if (apiResponse.continuationArr && apiResponse.san) {
      // Create PV from main line if PV not directly provided
      processedResponse.pv = [{
        move: apiResponse.move || '',
        san: apiResponse.san || '',
        evaluation: apiResponse.eval || 0,
        continuation: apiResponse.continuationArr || []
      }];
    }
    
    return processedResponse;
  } catch (error) {
    console.error('Error in position evaluation:', error);
    // Fall back to the simulated response on any error
    return simulateEngineResponse(options.fen, options.depth);
  }
}

/**
 * Alternative WebSocket connection for streaming position evaluation
 * 
 * @param options Request options including FEN
 * @param onMessage Callback for incoming messages
 * @returns WebSocket instance
 */
export function createEvaluationStream(
  options: ChessApiRequestOptions,
  onMessage: (data: ChessApiResponse) => void
): WebSocket {
  const ws = new WebSocket('wss://chess-api.com/v1');
  
  ws.onopen = () => {
    ws.send(JSON.stringify({
      fen: options.fen,
      depth: options.depth || 12,
      variants: options.variants || 1,
      maxThinkingTime: options.maxThinkingTime || 50,
      searchmoves: options.searchmoves || '',
      taskId: options.taskId || Math.random().toString(36).substring(2, 10)
    }));
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && typeof data.eval === 'number') {
        onMessage({
          ...data,
          fen: options.fen,
          depth: data.depth || options.depth || 12
        });
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  };
  
  return ws;
}

/**
 * Simulates a chess engine response when the API fails
 * 
 * @param fen FEN string representing the position
 * @param engineDepth Desired analysis depth
 * @returns Simulated chess engine response
 */
export function simulateEngineResponse(fen: string, engineDepth: number = 12): ChessApiResponse {
  try {
    // Very simple material count evaluation
    let evaluation = 0;
    const position = fen.split(' ')[0];
    // We don't need to use sideToMove in this implementation, so commenting it out
    // const sideToMove = fen.split(' ')[1];
    
    // Count material
    for (const piece of position) {
      if (piece === 'P') evaluation += 1.0;
      else if (piece === 'p') evaluation -= 1.0;
      else if (piece === 'N' || piece === 'B') evaluation += 3.0;
      else if (piece === 'n' || piece === 'b') evaluation -= 3.0;
      else if (piece === 'R') evaluation += 5.0;
      else if (piece === 'r') evaluation -= 5.0;
      else if (piece === 'Q') evaluation += 9.0;
      else if (piece === 'q') evaluation -= 9.0;
    }
    
    // Add small randomness for realism
    const randomFactor = (Math.random() - 0.5) * 0.1;
    evaluation += randomFactor;
    
    // Calculate win probability using logistic function
    const clampedEval = Math.max(-10, Math.min(10, evaluation));
    const winChance = 50 + 50 * (2 / (1 + Math.exp(-0.5 * clampedEval)) - 1);
    
    // Create a simulated response
    return {
      eval: evaluation,
      depth: engineDepth,
      winChance: winChance,
      fen: fen,
      type: 'move',
      pv: [],
      text: "",
      move: ""
    };
  } catch (e) {
    // Fallback response if simulation fails
    console.error('Error in simulation engine:', e);
    return {
      eval: 0,
      depth: engineDepth,
      winChance: 50,
      fen: fen,
      type: 'move',
      text: "",
      move: ""
    };
  }
}

// --- Additions for stockfish.online API ---

export interface StockfishOnlineResponse {
  success: boolean;
  evaluation: number | null; // Evaluation in pawns (null if mate)
  mate: number | null; // Moves to mate (null if no mate)
  bestmove: string | null; // Best move in UCI format (e.g., "e2e4") + ponder
  continuation: string | null; // Engine line
  // Optional: Add 'data' field for error information if success is false
  data?: string; 
}

/**
 * Fetches evaluation from the stockfish.online API.
 * 
 * @param fen The FEN string of the position to evaluate.
 * @param depth The search depth for the engine (max 15 recommended by API docs).
 * @param timeout Timeout in milliseconds (default: 10000ms).
 * @returns Promise resolving to the Stockfish API response.
 */
export async function getStockfishOnlineEvaluation(
  fen: string,
  depth: number = 13, // Default depth
  timeout: number = 10000 
): Promise<StockfishOnlineResponse> {
  const apiUrl = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=${depth}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId); // Clear timeout if fetch completes

    if (!response.ok) {
      console.error(`Stockfish API request failed: ${response.status} ${response.statusText}`);
      return { success: false, evaluation: 0, mate: null, bestmove: null, continuation: null, data: `HTTP error ${response.status}` };
    }

    const data: StockfishOnlineResponse = await response.json();

    if (!data.success) {
        console.warn(`Stockfish API returned success: false for FEN ${fen}`, data.data);
        // Return a default failure state but include any data provided
        return { ...data, evaluation: data.evaluation ?? 0, mate: data.mate ?? null, bestmove: data.bestmove ?? null, continuation: data.continuation ?? null };
    }
    
    // Ensure evaluation is a number, default to 0 if null and no mate
    if (data.evaluation === null && data.mate === null) {
        data.evaluation = 0;
    }

    return data;

  } catch (error: unknown) {
    clearTimeout(timeoutId); // Clear timeout if fetch fails
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Stockfish API request timed out after ${timeout}ms for FEN: ${fen}`);
      return { success: false, evaluation: 0, mate: null, bestmove: null, continuation: null, data: 'Request timed out' };
    } else {
      console.error('Error fetching Stockfish evaluation:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, evaluation: 0, mate: null, bestmove: null, continuation: null, data: errorMessage };
    }
  }
}

// --- End of additions ---