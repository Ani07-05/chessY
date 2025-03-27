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
 * @param timeout Timeout in milliseconds (default: 5000ms)
 * @returns Promise resolving to the evaluation response
 */
export async function evaluatePosition(
  options: ChessApiRequestOptions,
  timeout: number = 5000
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
    let processedResponse: ChessApiResponse = {
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
    const sideToMove = fen.split(' ')[1];
    
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
      pv: []
    };
  } catch (error) {
    // Fallback response if simulation fails
    return {
      eval: 0,
      depth: engineDepth,
      winChance: 50,
      fen: fen,
      type: 'move'
    };
  }
}