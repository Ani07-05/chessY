"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Play, Pause, RefreshCw, SkipBack, SkipForward, ExternalLink } from "lucide-react"
import { Chessboard } from "react-chessboard"
import { Chart as ChartJS } from "chart.js/auto"
import { Line } from "react-chartjs-2"
import { toast } from "sonner"
import { Chess } from "chess.js"
import { calculateAccuracy, classifyMoveQuality, estimatePlayerRating, detectGamePhase } from "@/lib/accuracy-calculator"

// Dynamically import the GameReviewPanel component
const GameReviewPanel = dynamic(() => import('@/components/game-review').then(mod => mod.GameReviewPanel), {
  ssr: false,
  loading: () => <div className="h-24 flex items-center justify-center">Loading review panel...</div>
});

interface PrincipalVariation {
  move: string;
  san: string;
  evaluation: number;
  continuation: string[];
}

interface ChessGameData {
  white: { username: string; result: string };
  black: { username: string; result: string };
  [key: string]: { username: string; result: string } | string | number;
}

interface GameData {
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
  white: { username: string; result: string };
  black: { username: string; result: string };
  end_time: number;
}

export default function ReviewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClientComponentClient()
  
  // Game state
  const [reviewGame, setReviewGame] = useState<GameData | null>(null)
  const [reviewMoveIndex, setReviewMoveIndex] = useState(0)
  const [reviewChess, setReviewChess] = useState<Chess | null>(null)
  const [reviewEval, setReviewEval] = useState<any>(null)
  const [reviewGameHistory, setReviewGameHistory] = useState<string[]>([])
  
  // Analysis state
  const [moveAnalysis, setMoveAnalysis] = useState<any[]>([])
  const [currentMoveQuality, setCurrentMoveQuality] = useState<string>("")
  const [isPlayingThrough, setIsPlayingThrough] = useState(false)
  const [evalHistory, setEvalHistory] = useState<number[]>([])
  const [apiRequestLogs, setApiRequestLogs] = useState<any[]>([])
  const [capturedPieces, setCapturedPieces] = useState<{white: string[], black: string[]}>({white: [], black: []})
  const [positionStrength, setPositionStrength] = useState<'advantage' | 'equal' | 'disadvantage' | null>(null)
  const [accuracyScore, setAccuracyScore] = useState<{white: number, black: number}>({white: 0, black: 0})
  
  // Engine settings
  const [engineDepth, setEngineDepth] = useState(18)
  const [showEngineLines, setShowEngineLines] = useState(true)
  const [showRequestLogs, setShowRequestLogs] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1500)
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [chessStats, setChessStats] = useState<any>(null)
  const [movesLineChart, setMovesLineChart] = useState<any>(null)

  //helper functions
  const getMoveQualityClass = (quality: string): string => {
    switch (quality) {
      case "Brilliant": return "text-purple-600";
      case "Great": return "text-indigo-600";
      case "Best": return "text-green-600";
      case "Good": return "text-blue-600";
      case "Book": return "text-blue-600";
      case "Inaccuracy": return "text-yellow-600";
      case "Mistake": return "text-orange-600";
      case "Blunder": return "text-red-600";
      default: return "text-gray-600";
    }
  };
  
  const getMoveQualityIcon = (quality: string): string => {
    switch (quality) {
      case "Brilliant": return "💎";
      case "Great": return "★";
      case "Best": return "✓✓";
      case "Good": return "✓";
      case "Book": return "📖";
      case "Inaccuracy": return "?";
      case "Mistake": return "?!";
      case "Blunder": return "??";
      default: return "○";
    }
  };

  // Fetch game data from URL parameters
  useEffect(() => {
    const fetchGameData = async () => {
      setLoading(true)
      try {
        // Get game ID and player color from URL parameters
        const gameIdParam = searchParams.get('gameId')
        const playerColor = searchParams.get('playerColor') || 'white'
        const username = searchParams.get('username')
        
        if (!gameIdParam) {
          toast.error("No game ID provided")
          return
        }
        
        // Extract the game ID from the Chess.com URL if necessary
        const gameId = gameIdParam.includes('/') 
          ? gameIdParam.split('/').pop() 
          : gameIdParam
        
        if (!gameId) {
          toast.error("Invalid game ID format")
          return
        }
        
        console.log(`Fetching game with ID: ${gameId}, username: ${username || 'not provided'}`)
        
        // Import game service dynamically to avoid circular dependencies
        const { fetchGameById } = await import('@/lib/chess-game-services')
        
        try {
          // Fetch the game using our improved service that searches in monthly archives
          const gameData = await fetchGameById(gameId, username || undefined)
          
          // Format the game data
          const formattedGame: GameData = {
            playerColor,
            opponentColor: playerColor === 'white' ? 'black' : 'white',
            opponentUsername: gameData[playerColor === 'white' ? 'black' : 'white'].username,
            result: gameData[playerColor].result,
            resultText: gameData[playerColor].result === "win" ? "Victory" : 
                       gameData[playerColor].result === "draw" ? "Draw" : "Defeat",
            resultClass: gameData[playerColor].result === "win" ? "text-green-500" : 
                        gameData[playerColor].result === "draw" ? "text-yellow-500" : "text-red-500",
            date: new Date(gameData.end_time * 1000).toLocaleDateString(),
            time: new Date(gameData.end_time * 1000).toLocaleTimeString(),
            url: gameData.url,
            pgn: gameData.pgn,
            white: gameData.white,
            black: gameData.black,
            end_time: gameData.end_time,
            timeControl: gameData.time_control || "Standard"
          }
          
          console.log("Game data loaded successfully:", formattedGame)
          setReviewGame(formattedGame)
          await prepareGameReview(formattedGame)
          
          // Fetch user profile after game is loaded
          await fetchUserProfile()
          
        } catch (gameError) {
          console.error("Error fetching game from Chess.com API:", gameError)
          
          // Fallback: Direct fetch from March 2025 archive
          console.log("Attempting fallback fetch from hardcoded archive...")
          
          const response = await fetch(`https://api.chess.com/pub/player/aggani007/games/2025/03`)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch archive: ${response.statusText}`)
          }
          
          const archiveData = await response.json()
          const games = archiveData.games || []
          
          // Find the game with matching ID
          const game = games.find((g: any) => {
            const gameUrlId = g.url.split('/').pop()
            return gameUrlId === gameId
          })
          
          if (!game) {
            throw new Error(`Game with ID ${gameId} not found in archive`)
          }
          
          // Format the game data from direct archive
          const formattedGame: GameData = {
            playerColor,
            opponentColor: playerColor === 'white' ? 'black' : 'white',
            opponentUsername: game[playerColor === 'white' ? 'black' : 'white'].username,
            result: game[playerColor].result,
            resultText: game[playerColor].result === "win" ? "Victory" : 
                      game[playerColor].result === "draw" ? "Draw" : "Defeat",
            resultClass: game[playerColor].result === "win" ? "text-green-500" : 
                        game[playerColor].result === "draw" ? "text-yellow-500" : "text-red-500",
            date: new Date(game.end_time * 1000).toLocaleDateString(),
            time: new Date(game.end_time * 1000).toLocaleTimeString(),
            url: game.url,
            pgn: game.pgn,
            white: game.white,
            black: game.black,
            end_time: game.end_time,
            timeControl: game.time_control || "Standard"
          }
          
          console.log("Game data loaded via fallback method:", formattedGame)
          setReviewGame(formattedGame)
          await prepareGameReview(formattedGame)
          
          // Fetch user profile after game is loaded
          await fetchUserProfile()
        }
      } catch (error) {
        console.error("All game fetching methods failed:", error)
        toast.error("Error loading game data. The game could not be found.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchGameData()
  }, [searchParams])
  
  // Fetch user profile from Supabase
  const fetchUserProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log("No authenticated session found")
        return
      }
      
      const { data: profile, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single()
      
      if (error) {
        console.error("Error fetching profile:", error)
        return
      }
      
      if (profile) {
        setUserProfile(profile)
        
        // Fetch chess stats if we have a chess username
        if (profile.chess_username) {
          try {
            const response = await fetch(`https://api.chess.com/pub/player/${profile.chess_username}/stats`)
            if (response.ok) {
              const stats = await response.json()
              setChessStats(stats)
            }
          } catch (err) {
            console.error("Error fetching chess stats:", err)
          }
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err)
    }
  }
  
  // Function to prepare game review state with improved error handling
  const prepareGameReview = async (game: GameData) => {
    // Reset all analysis state
    setMoveAnalysis([])
    setCurrentMoveQuality("")
    setIsPlayingThrough(false)
    setEvalHistory([])
    setApiRequestLogs([])
    setCapturedPieces({white: [], black: []})
    setPositionStrength(null)
    setAccuracyScore({white: 0, black: 0})
    
    try {
      console.log("Preparing game review with data:", { 
        hasGameObject: !!game,
        hasPgn: !!game?.pgn,
        hasFen: !!game?.fen,
        playerColor: game?.playerColor
      })
      
      // Create a fresh chess instance
      const chessInstance = new Chess()
      let movesLoaded = false
      
      // Load game data - try PGN first, then FEN, then default position
      const pgn = game.pgn || ""
      
      if (pgn && pgn.trim()) {
        try {
          console.log("Attempting to load PGN:", pgn.substring(0, 100) + "...")
          chessInstance.loadPgn(pgn)
          console.log("PGN loaded successfully")
          movesLoaded = true
        } catch (e) {
          console.error("Error loading PGN:", e)
          
          // Try a more permissive PGN parsing approach for malformed PGNs
          try {
            console.log("Attempting alternative PGN parsing...")
            
            // Clean the PGN of any non-standard content
            const cleanPgn = pgn
              .replace(/\{[^}]*\}/g, '') // Remove comments
              .replace(/\([^)]*\)/g, '') // Remove variations
              .replace(/\$\d+/g, '')     // Remove NAG annotations
              
            // Extract moves using regex
            const movePattern = /\d+\.+\s+(\S+)(?:\s+(\S+))?/g
            let moves = []
            let match
            
            while ((match = movePattern.exec(cleanPgn)) !== null) {
              if (match[1]) moves.push(match[1])
              if (match[2]) moves.push(match[2])
            }
            
            // Apply moves one by one
            chessInstance.reset()
            for (const move of moves) {
              try {
                chessInstance.move(move)
              } catch (moveErr) {
                console.warn(`Skipping invalid move: ${move}`)
              }
            }
            
            console.log("Alternative PGN parsing successful")
            movesLoaded = true
          } catch (altErr) {
            console.error("Alternative PGN parsing also failed:", altErr)
            toast.error("Could not load game PGN. Using starting position.")
            chessInstance.reset()
          }
        }
      } else if (game.fen && typeof game.fen === 'string') {
        try {
          console.log("Attempting to load FEN:", game.fen)
          chessInstance.load(game.fen)
          console.log("FEN loaded successfully")
          movesLoaded = true
        } catch (e) {
          console.error("Error loading FEN:", e)
          toast.error("Could not load game position. Using starting position.")
          chessInstance.reset()
        }
      } else {
        // Use default starting position
        chessInstance.reset()
        console.log("No PGN or FEN provided. Using starting position.")
      }
      
      // Get the full history of moves
      const history = chessInstance.history()
      console.log(`Game has ${history.length} moves:`, history)
      setReviewGameHistory(history)
      
      // Reset to the beginning position
      chessInstance.reset()
      
      setReviewChess(chessInstance)
      setReviewMoveIndex(0)
      
      // Evaluate starting position
      try {
        console.log("Evaluating initial position...")
        await evaluatePosition(chessInstance.fen(), 0)
        console.log("Initial position evaluated.")
      } catch (evalError) {
        console.error("Error evaluating initial position:", evalError)
        toast.warning("Position analysis may be limited - engine initialization failed.")
      }
      
      if (movesLoaded) {
        toast.success("Game loaded for review")
      } else {
        toast.warning("Using default starting position - PGN/FEN not available")
      }
      
      return true
    } catch (err) {
      console.error("Critical error setting up game review:", err)
      toast.error("Could not load game for review")
      return false
    }
  }
  
  // CAPS2-like accuracy calculation for Chess.com-like results
  const calculateAccuracyScore = useCallback((evaluations: number[], playerColor: string = 'white'): number => {
    if (evaluations.length < 2) return 70; // Default baseline for minimal data
    
    let totalLoss = 0;
    let maxPossibleLoss = 0;
    
    for (let i = 0; i < evaluations.length - 1; i++) {
      // Calculate loss based on evaluation difference
      const prevEval = evaluations[i];
      const currEval = evaluations[i+1];
      
      // Calculate the eval difference from the player's perspective
      const evalDiff = playerColor === 'white' 
        ? prevEval - currEval
        : currEval - prevEval;
        
      // Only count losing moves as penalties
      const loss = Math.max(0, evalDiff);
      
      // Convert loss to a normalized penalty using sigmoid function
      // This makes small mistakes less costly and big blunders have diminishing returns
      const normalizedLoss = 2 / (1 + Math.exp(-loss * 0.5));
      
      totalLoss += normalizedLoss;
      maxPossibleLoss += 2; // Maximum possible loss for perfect comparison
    }
    
    // Convert to a 0-100 scale with appropriate scaling to match CAPS2 range
    const perfectionRatio = 1 - (totalLoss / maxPossibleLoss);
    
    // Scale to desired range (50-95) for typical scores
    // Uses an exponential curve to reward excellence but be forgiving of mistakes
    const scaledAccuracy = 50 + (Math.pow(perfectionRatio, 0.8) * 45);
    
    // Round to one decimal place
    return Math.round(scaledAccuracy * 10) / 10;
  }, []);
  
  // Position evaluation with proper error handling
  const evaluatePosition = async (fen: string, moveIndex: number) => {
    try {
      setCurrentMoveQuality("");
      
      // Generate a request ID for correlation
      const requestId = Math.random().toString(36).substring(2, 10);
      
      console.log(`[${requestId}] Evaluating position ${moveIndex}:`, {
        fen,
        engineDepth
      });
      
      // Add to request logs
      setApiRequestLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        type: 'request',
        moveIndex,
        fen,
        requestId,
        body: {
          fen,
          depth: engineDepth,
          variants: 3,
          maxThinkingTime: 50,
          taskId: requestId
        }
      }]);
      
      // Import chess-api functions
      const { evaluatePosition, simulateEngineResponse } = await import('@/types/chess-api');
      
      try {
        // Make the API request with proper error handling
        const apiResponse = await evaluatePosition({
          fen,
          depth: engineDepth,
          variants: 3,
          maxThinkingTime: 50,
          taskId: requestId
        }, 5000); // 5-second timeout
        
        // Log the API response for debugging
        console.log(`[${requestId}] Evaluation response for move ${moveIndex}:`, apiResponse);
        
        // Add to request logs
        setApiRequestLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          type: 'response',
          moveIndex,
          requestId,
          response: apiResponse
        }]);
        
        const processedResponse = {
          eval: apiResponse.eval || 0,
          depth: apiResponse.depth || engineDepth,
          winChance: apiResponse.winChance || 50,
          pv: apiResponse.pv || [],
          bestMove: apiResponse.move || '',
          bestMoveSan: apiResponse.san || '',
          fen: fen,
          moveIndex: moveIndex,
          timestamp: new Date().toISOString(),
          requestId
        };
        
        setReviewEval(processedResponse);
        
        // Process response and update state
        processEvaluationResponse(processedResponse, moveIndex, fen);
        
      } catch (apiError) {
        console.error("Error evaluating position:", apiError);
        
        // Add error to request logs
        setApiRequestLogs(prev => {
          if (!prev.some(log => log.moveIndex === moveIndex && log.type === 'error')) {
            return [...prev, {
              timestamp: new Date().toISOString(),
              type: 'error',
              moveIndex,
              error: apiError instanceof Error ? apiError.message : String(apiError)
            }];
          }
          return prev;
        });
        
        // Don't show error toast for each position - only show it once at the beginning
        if (moveIndex === 0) {
          toast.warning("Using simplified engine analysis due to API limitations.");
        }
        
        // Use fallback simulation instead
        console.log(`Using fallback engine simulation for move ${moveIndex} due to API error`);
        const simulatedResponse = simulateEngineResponse(fen, engineDepth);
        
        const fallbackResponse = {
          eval: simulatedResponse.eval,
          depth: simulatedResponse.depth,
          winChance: simulatedResponse.winChance,
          pv: simulatedResponse.pv || [],
          bestMove: simulatedResponse.move || '',
          bestMoveSan: simulatedResponse.san || '',
          fen: fen,
          moveIndex: moveIndex,
          timestamp: new Date().toISOString(),
          requestId: 'fallback-' + requestId
        };
        
        setReviewEval(fallbackResponse);
        
        // Process the fallback response
        processEvaluationResponse(fallbackResponse, moveIndex, fen);
      }
    } catch (err) {
      console.error("Critical error in evaluation:", err);
      toast.error("Analysis engine error. Using fallback analysis.");
      
      // Create minimal fallback response in case of critical error
      const minimalResponse = {
        eval: 0,
        depth: engineDepth,
        winChance: 50,
        pv: [],
        bestMove: '',
        bestMoveSan: '',
        fen: fen,
        moveIndex: moveIndex,
        timestamp: new Date().toISOString(),
        requestId: 'error-fallback'
      };
      
      setReviewEval(minimalResponse);
      
      // Still need to update the basic state
      updateCapturedPieces(fen);
      updateEvaluationChart();
    }
  };

  // Helper function to process evaluation responses (both API and fallback)
  const processEvaluationResponse = async (response: any, moveIndex: number, fen: string) => {
    // Track evaluation history for the chart
    const normalizedEval = Math.max(-10, Math.min(10, response.eval || 0));
    setEvalHistory(prev => {
      const newHistory = [...prev];
      newHistory[moveIndex] = normalizedEval;
      return newHistory;
    });
    
    // Calculate move quality based on current position
    if (moveIndex > 0 && moveIndex <= reviewGameHistory.length) {
      const playerColor = (moveIndex % 2 === 0) ? 'black' : 'white';
      const isPlayerMove = playerColor === reviewGame?.playerColor;
      
      // Update position strength indicator
      if (response.eval > 1.5) {
        setPositionStrength('advantage');
      } else if (response.eval < -1.5) {
        setPositionStrength('disadvantage');
      } else {
        setPositionStrength('equal');
      }
      
      // Get previous position's evaluation
      const prevEval = evalHistory[moveIndex - 1] || 0;
      const currentEval = normalizedEval;
      
      // Calculate the eval difference from the player's perspective
      const evalDifference = playerColor === 'white' 
        ? prevEval - currentEval
        : currentEval - prevEval;
      
      // Determine move quality (import from accuracy calculator)
      const { classifyMoveQuality } = await import('@/lib/accuracy-calculator');
      
      // The move that led to this position
      const playerMove = reviewGameHistory[moveIndex - 1]; 
      
      // Use the enhanced move quality classification
      const moveQuality = classifyMoveQuality(
        prevEval,
        currentEval,
        playerColor,
        moveIndex, 
        response.pv[0]?.san || response.bestMoveSan,
        playerMove,
        0.5 // Default complexity value
      );
      
      if (isPlayerMove) {
        setCurrentMoveQuality(moveQuality);
      }
      
      // Calculate overall accuracy scores
      if (moveIndex > 1) {
        const whiteEvals = evalHistory.filter((_, i) => i % 2 === 1); // White moves end at odd indices
        const blackEvals = evalHistory.filter((_, i) => i % 2 === 0 && i > 0); // Black moves end at even indices > 0
        
        setAccuracyScore({
          white: calculateAccuracyScore(whiteEvals, 'white'),
          black: calculateAccuracyScore(blackEvals, 'black')
        });
      }
      
      // Store the analysis
      const newAnalysis = {
        moveNumber: Math.floor(moveIndex / 2) + (moveIndex % 2 === 0 ? 0 : 1),
        moveText: `${Math.floor((moveIndex-1) / 2) + 1}${(moveIndex-1) % 2 === 0 ? '.' : '...'}${playerMove}`,
        move: playerMove,
        playerColor,
        prevEval: prevEval,
        evaluation: currentEval,
        evalDifference: evalDifference,
        bestMove: response.bestMove,
        bestMoveSan: response.pv[0]?.san || response.bestMoveSan,
        alternativeMoves: response.pv.slice(1).map((p: any) => p.san).join(', '),
        quality: moveQuality,
        fen: fen,
        lines: response.pv,
        timestamp: new Date().toISOString()
      };
      
      setMoveAnalysis(prev => {
        const updated = [...prev];
        updated[moveIndex - 1] = newAnalysis;
        return updated;
      });
    }
    
    // Update captured pieces
    updateCapturedPieces(fen);
    
    // Update the evaluation chart
    updateEvaluationChart();
  };
  
  // Helper function to update captured pieces
  const updateCapturedPieces = (fen: string) => {
    if (!reviewChess) return;
    
    try {
      const whiteCaptured: string[] = [];
      const blackCaptured: string[] = [];
      
      // Calculate captured pieces by comparing the position with starting position
      const currentPieces = getFenPieces(fen);
      const startingPieces = {
        'p': 8, 'n': 2, 'b': 2, 'r': 2, 'q': 1, 'k': 1,
        'P': 8, 'N': 2, 'B': 2, 'R': 2, 'Q': 1, 'K': 1
      };
      
      for (const piece in startingPieces) {
        const count = startingPieces[piece as keyof typeof startingPieces] - (currentPieces[piece] || 0);
        if (count > 0) {
          const pieceSymbol = getPieceSymbol(piece);
          const target = piece.toUpperCase() === piece ? blackCaptured : whiteCaptured;
          for (let i = 0; i < count; i++) {
            target.push(pieceSymbol);
          }
        }
      }
      
      setCapturedPieces({
        white: whiteCaptured,
        black: blackCaptured
      });
    } catch (error) {
      console.error("Error updating captured pieces:", error);
    }
  };
  
  // Helper function to simulate a chess engine API response with improved evaluation
  const simulateChessEngineResponse = (fen: string, moveIndex: number) => {
    // Parse FEN to understand position
    const fenParts = fen.split(' ');
    const position = fenParts[0];
    const sideToMove = fenParts[1];
    
    try {
      // Create a chess instance for move generation
      const chess = new Chess(fen);
      const legalMoves = chess.moves({verbose: true});
      
      if (!legalMoves || legalMoves.length === 0) {
        // Handle mate or stalemate - return a high evaluation value
        const isCheck = chess.inCheck();
        
        if (isCheck) {
          // Checkmate - return a very high evaluation for the winning side
          return {
            eval: sideToMove === 'w' ? -99 : 99, // Black wins if white is in mate, white wins if black is in mate
            mate: sideToMove === 'w' ? -0 : 0, // Indicate mate in 0 (current position)
            depth: engineDepth,
            winChance: sideToMove === 'w' ? 0 : 100,
            pv: [],
            bestMove: null,
            bestMoveSan: null,
            fen: fen,
            moveIndex: moveIndex,
            timestamp: new Date().toISOString()
          };
        } else {
          // Stalemate - return a draw evaluation
          return {
            eval: 0,
            depth: engineDepth,
            winChance: 50,
            pv: [],
            bestMove: null,
            bestMoveSan: null,
            fen: fen,
            moveIndex: moveIndex,
            timestamp: new Date().toISOString()
          };
        }
      }
      
      // Enhanced evaluation algorithm
      let evaluation = 0;
      const pieces = position.split('');
      for (const piece of pieces) {
        if (piece === 'P') evaluation += 1.0;
        else if (piece === 'p') evaluation -= 1.0;
        else if (piece === 'N' || piece === 'B') evaluation += 3.0;
        else if (piece === 'n' || piece === 'b') evaluation -= 3.0;
        else if (piece === 'R') evaluation += 5.0;
        else if (piece === 'r') evaluation -= 5.0;
        else if (piece === 'Q') evaluation += 9.0;
        else if (piece === 'q') evaluation -= 9.0;
      }
      
      // Add a small bonus for mobility
      if (sideToMove === 'w') {
        evaluation += legalMoves.length * 0.05; // Each legal move is worth a tiny bit
      } else {
        evaluation -= legalMoves.length * 0.05;
      }
      
      // Evaluate pawn structure - count doubled pawns (slightly negative)
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      for (const file of files) {
        const whitePawnsInFile = position.match(new RegExp(`${file}[1-8]P`, 'g'))?.length || 0;
        const blackPawnsInFile = position.match(new RegExp(`${file}[1-8]p`, 'g'))?.length || 0;
        
        if (whitePawnsInFile > 1) evaluation -= 0.2 * (whitePawnsInFile - 1);
        if (blackPawnsInFile > 1) evaluation += 0.2 * (blackPawnsInFile - 1);
      }
      
      // Add small randomness for realism (avoid identical evaluations)
      const randomFactor = (Math.random() - 0.5) * 0.1;
      evaluation += randomFactor;
      
      // Sort moves by estimated value
      const sortedMoves = [...legalMoves].sort((a: any, b: any) => {
        // Simple move scoring system
        const scoreMove = (move: any) => {
          let score = 0;
          
          // Captures are valuable
          if (move.captured) {
            const pieceValues: Record<string, number> = {
              'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
            };
            score += pieceValues[move.captured] * 10; // Heavily weight captures
          }
          
          // Promotion is valuable
          if (move.promotion) {
            const promotionValues: Record<string, number> = {
              'q': 9, 'r': 5, 'n': 3, 'b': 3
            };
            score += promotionValues[move.promotion];
          }
          
          // Check is good
          if (move.san.includes('+')) {
            score += 0.5;
          }
          
          // Checkmate is best
          if (move.san.includes('#')) {
            score += 100;
          }
          
          return score;
        };
        
        return scoreMove(b) - scoreMove(a);
      });
      
      // Create PV lines - make up to 3 lines
      const numLines = Math.min(3, sortedMoves.length);
      const variations = [];
      
      for (let i = 0; i < numLines; i++) {
        const move = sortedMoves[i];
        // Each alternative is progressively worse
        const evalAdjustment = i === 0 ? 0 : (i * -0.3 - Math.random() * 0.2); 
        
        // Make the move to continue the variation
        chess.move(move);
        
        // Get some reasonable continuations
        const continuationMoves = [move.san];
        let depthLeft = 3; // How many more moves to generate
        let currentPosition = chess.fen();
        let currentChess = new Chess(currentPosition);
        
        while (depthLeft > 0 && !currentChess.isGameOver()) {
          const moves = currentChess.moves({verbose: true});
          if (!moves || moves.length === 0) break;
          
          // Find the highest value capture, or any central move
          moves.sort((a: any, b: any) => {
            const pieceValues: Record<string, number> = {
              'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
            };
            
            const scoreA = a.captured ? pieceValues[a.captured] * 10 : 0;
            const scoreB = b.captured ? pieceValues[b.captured] * 10 : 0;
            
            return scoreB - scoreA;
          });
          
          const nextMove = moves[0];
          currentChess.move(nextMove);
          continuationMoves.push(nextMove.san);
          depthLeft--;
        }
        
        // Reset to the original position
        chess.load(fen);
        
        variations.push({
          move: move.san,
          san: move.san,
          evaluation: evaluation + evalAdjustment,
          continuation: continuationMoves.slice(1) // Skip the first move as it's the main line move
        });
      }
      
      // Calculate win probability using logistic function
      const clampedEval = Math.max(-10, Math.min(10, evaluation));
      const winChance = 50 + 50 * (2 / (1 + Math.exp(-0.5 * clampedEval)) - 1);
      
      return {
        eval: evaluation,
        depth: engineDepth,
        winChance: winChance,
        pv: variations,
        bestMove: variations[0]?.move || sortedMoves[0]?.san,
        bestMoveSan: variations[0]?.san || sortedMoves[0]?.san,
        fen: fen,
        moveIndex: moveIndex,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error in simulation engine:", error);
      
      // Return a fallback minimal response if anything fails
      return {
        eval: 0,
        depth: engineDepth,
        winChance: 50,
        pv: [],
        bestMove: null,
        bestMoveSan: null,
        fen: fen,
        moveIndex: moveIndex,
        timestamp: new Date().toISOString()
      };
    }
  };
  
  // Helper to get pieces from FEN
  const getFenPieces = (fen: string) => {
    const pieces: Record<string, number> = {};
    const position = fen.split(' ')[0];
    
    for (const char of position) {
      if (/[pnbrqkPNBRQK]/.test(char)) {
        pieces[char] = (pieces[char] || 0) + 1;
      }
    }
    
    return pieces;
  };
  
  // Helper to get HTML/Unicode piece symbols
  const getPieceSymbol = (piece: string): string => {
    const symbols: Record<string, string> = {
      'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
      'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
    };
    return symbols[piece] || piece;
  };
  
  // Update the evaluation chart
  const updateEvaluationChart = () => {
    if (evalHistory.length < 2) return;
    
    // Cap evaluations for better visualization
    const cappedEvals = evalHistory.map(evaluation => Math.max(-5, Math.min(5, evaluation)));
    
    const data = {
      labels: cappedEvals.map((_, i) => i),
      datasets: [{
        label: 'Evaluation',
        data: cappedEvals,
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        pointHitRadius: 10,
        borderWidth: 2
      }]
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.y;
              return value > 0 ? `+${value.toFixed(2)}` : `${value.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          min: -5,
          max: 5,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(200, 200, 200, 0.15)' }
        },
        x: {
          ticks: { maxTicksLimit: 10 },
          grid: { display: false }
        }
      }
    };
    
    setMovesLineChart({ data, options });
  };
  
  // Move navigation handlers
  const handleNextMove = useCallback(async () => {
    if (!reviewChess || !reviewGameHistory.length || reviewMoveIndex >= reviewGameHistory.length) {
      if (isPlayingThrough) {
        setIsPlayingThrough(false);
      }
      return;
    }
    
    try {
      const move = reviewGameHistory[reviewMoveIndex];
      
      // Try to make the move
      const moveResult = reviewChess.move(move);
      
      if (!moveResult) {
        throw new Error(`Invalid move: ${move}`);
      }
      
      const newIndex = reviewMoveIndex + 1;
      setReviewMoveIndex(newIndex);
      
      // Evaluate the new position
      await evaluatePosition(reviewChess.fen(), newIndex);
      
      // If in play-through mode, continue to next move after a delay
      if (isPlayingThrough && newIndex < reviewGameHistory.length) {
        setTimeout(() => {
          handleNextMove();
        }, playbackSpeed);
      } else if (isPlayingThrough && newIndex >= reviewGameHistory.length) {
        setIsPlayingThrough(false);
      }
    } catch (err) {
      console.error("Error playing move:", err);
      setIsPlayingThrough(false);
      toast.error("Error playing move. Playback stopped.");
    }
  }, [reviewChess, reviewGameHistory, reviewMoveIndex, isPlayingThrough, playbackSpeed]);
  
  const handlePrevMove = useCallback(() => {
    if (!reviewChess || reviewMoveIndex <= 0) return;
    
    try {
      // Go back one move
      reviewChess.undo();
      
      const newIndex = reviewMoveIndex - 1;
      setReviewMoveIndex(newIndex);
      
      // Evaluate the position
      evaluatePosition(reviewChess.fen(), newIndex);
    } catch (err) {
      console.error("Error going to previous move:", err);
      toast.error("Error navigating to previous move.");
    }
  }, [reviewChess, reviewMoveIndex]);
  
  const handleFirstMove = useCallback(() => {
    if (!reviewChess) return;
    
    try {
      // Reset the board to starting position
      reviewChess.reset();
      setReviewMoveIndex(0);
      evaluatePosition(reviewChess.fen(), 0);
    } catch (err) {
      console.error("Error resetting game:", err);
      toast.error("Error resetting game.");
    }
  }, [reviewChess]);
  
  const handleLastMove = useCallback(() => {
    if (!reviewChess || !reviewGameHistory.length) return;
    
    try {
      // Reset and replay all moves
      reviewChess.reset();
      
      // Apply all moves
      reviewGameHistory.forEach(move => {
        try {
          reviewChess.move(move);
        } catch (e) {
          console.error(`Error applying move ${move}:`, e);
        }
      });
      
      setReviewMoveIndex(reviewGameHistory.length);
      evaluatePosition(reviewChess.fen(), reviewGameHistory.length);
    } catch (err) {
      console.error("Error going to last move:", err);
      toast.error("Error navigating to last move.");
    }
  }, [reviewChess, reviewGameHistory]);
  
  const handlePlayThrough = useCallback(() => {
    setIsPlayingThrough(true);
    handleNextMove();
  }, [handleNextMove]);

  const handleStopPlayThrough = useCallback(() => {
    setIsPlayingThrough(false);
  }, []);

  // Navigate to a specific move
  const navigateToMove = (index: number) => {
    if (!reviewChess) return;
    
    try {
      reviewChess.reset();
      
      // Apply moves up to the target index
      for (let i = 0; i < index; i++) {
        if (i < reviewGameHistory.length) {
          reviewChess.move(reviewGameHistory[i]);
        }
      }
      
      setReviewMoveIndex(index);
      evaluatePosition(reviewChess.fen(), index);
    } catch (err) {
      console.error("Error navigating to move:", err);
      toast.error("Error navigating to specific move.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin">
            <RefreshCw className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading game data...</p>
        </div>
      </div>
    );
  }

  if (!reviewGame || !reviewChess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-destructive">
            <p className="text-xl font-bold">Game not found</p>
            <p className="text-muted-foreground mt-2">Unable to load the requested game.</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard')}
            className="mt-4"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Game Review</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowRequestLogs(!showRequestLogs)}>
              {showRequestLogs ? "Hide Debug Logs" : "Show Debug Logs"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
        
        <div className="mb-4">
          <GameReviewPanel
            gameData={reviewGame}
            evaluation={reviewEval}
            moveHistory={reviewGameHistory}
            moveIndex={reviewMoveIndex}
            evalHistory={evalHistory}
            moveAnalyses={moveAnalysis}
            onFirstMove={handleFirstMove}
            onPrevMove={handlePrevMove}
            onNextMove={handleNextMove}
            onLastMove={handleLastMove}
            onPlayThrough={handlePlayThrough}
            onStopPlayThrough={handleStopPlayThrough}
            isPlaying={isPlayingThrough}
            currentFen={reviewChess?.fen() || ''}
            engineDepth={engineDepth}
            onEngineDepthChange={setEngineDepth}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            capturedPieces={capturedPieces}
          />
        </div>
        
        <Tabs defaultValue="board">
          <TabsList>
            <TabsTrigger value="board">Chessboard</TabsTrigger>
            <TabsTrigger value="analysis">Move Analysis</TabsTrigger>
            <TabsTrigger value="movelist">Move List</TabsTrigger>
            {showRequestLogs && <TabsTrigger value="logs">Debug Logs</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="board" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/2">
                <div className="mb-2 relative">
                  <Chessboard 
                    position={reviewChess.fen()} 
                    boardWidth={400}
                    arePiecesDraggable={false}
                    boardOrientation={reviewGame.playerColor === 'black' ? 'black' : 'white'}
                  />
                  {positionStrength && (
                    <div 
                      className={`absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-semibold ${
                        positionStrength === 'advantage' 
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                          : positionStrength === 'disadvantage' 
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                            : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {positionStrength === 'advantage' 
                        ? 'Winning Position' 
                        : positionStrength === 'disadvantage' 
                          ? 'Losing Position'
                          : 'Equal Position'}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-full md:w-1/2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Position Analysis</CardTitle>
                    <CardDescription>
                      Computer evaluation at depth {reviewEval?.depth || engineDepth}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reviewEval ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-lg">
                            {reviewEval.eval > 0 ? "+" : ""}
                            {typeof reviewEval.eval === 'number' ? reviewEval.eval.toFixed(2) : reviewEval.eval}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Win chance: {Math.round(reviewEval.winChance)}%
                          </span>
                        </div>
                        
                        <div className="relative h-6 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="absolute inset-0 flex"
                          >
                            <div
                              className="h-full bg-white transition-all duration-500"
                              style={{ width: `${reviewEval.winChance}%` }}
                            ></div>
                            <div
                              className="h-full bg-black transition-all duration-500"
                              style={{ width: `${100 - reviewEval.winChance}%` }}
                            ></div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-medium mix-blend-difference text-white">
                              {reviewEval.eval > 0 ? "White" : "Black"} is {Math.abs(reviewEval.eval) > 3 ? "winning" : Math.abs(reviewEval.eval) > 1.5 ? "clearly better" : Math.abs(reviewEval.eval) > 0.5 ? "slightly better" : "equal"}
                            </span>
                          </div>
                        </div>
                        
                        {showEngineLines && reviewEval.pv && reviewEval.pv.length > 0 && (
                          <>
                            <Separator className="my-2" />
                            
                            <div className="space-y-2">
                              {reviewEval.pv.map((line: PrincipalVariation, i: number) => (
                                <div key={i} className="text-sm">
                                  <div className="flex justify-between items-center">
                                    <span className={`font-medium ${i === 0 ? 'text-primary' : ''}`}>
                                      {i+1}. {line.san}
                                    </span>
                                    <span className="text-muted-foreground text-xs font-mono">
                                      {line.evaluation > 0 ? "+" : ""}
                                      {typeof line.evaluation === 'number' ? line.evaluation.toFixed(2) : line.evaluation}
                                    </span>
                                  </div>
                                  {line.continuation && line.continuation.length > 0 && (
                                    <div className="text-xs text-muted-foreground font-mono pl-4 mt-1">
                                      {line.continuation.join(' ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        
                        <Separator className="my-3" />
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium mb-1">Position Info</div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">FEN:</span>
                                <span className="font-mono truncate max-w-[150px]" title={reviewEval.fen}>
                                  {reviewEval.fen.split(' ')[0]}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Move:</span>
                                <span>{reviewMoveIndex}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium mb-1">Engine Info</div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Depth:</span>
                                <span>{reviewEval.depth}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Best move:</span>
                                <span className="font-medium text-primary">{reviewEval.bestMoveSan || reviewEval.bestMove}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                        <span>Loading evaluation...</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="movelist">
            <Card>
              <CardHeader>
                <CardTitle>Game Moves</CardTitle>
                <CardDescription>
                  Click on any move to jump to that position
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1">
                  {reviewGameHistory.map((move, index) => {
                    const moveNumber = Math.floor(index / 2) + 1;
                    const isWhiteMove = index % 2 === 0;
                    return (
                      <Button
                        key={index}
                        variant={index === reviewMoveIndex - 1 ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => navigateToMove(index + 1)}
                      >
                        {moveNumber}{isWhiteMove ? '.' : '...'} {move}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analysis">
            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Game Analysis Summary</CardTitle>
                  <CardDescription>
                    Detailed breakdown of {moveAnalysis.length} moves
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">Key Moments</h3>
                      {moveAnalysis.filter(m => m?.quality === 'Brilliant Move' || m?.quality === 'Blunder').length > 0 ? (
                        <div className="space-y-3">
                          {moveAnalysis
                            .map((analysis, index) => ({ analysis, index }))
                            .filter(({ analysis }) => analysis?.quality === 'Brilliant Move' || analysis?.quality === 'Blunder')
                            .sort((a, b) => Math.abs(b.analysis.evalDifference) - Math.abs(a.analysis.evalDifference))
                            .slice(0, 3)
                            .map(({ analysis, index }) => (
                              <div key={index} className="p-3 rounded-md border">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-medium">{analysis.moveText}</span>
                                  <div className={getMoveQualityClass(analysis.quality)}>
                                    {analysis.quality}
                                  </div>
                                </div>
                                <div className="text-sm flex justify-between text-muted-foreground">
                                  <span>Before: {analysis.prevEval > 0 ? "+" : ""}{analysis.prevEval.toFixed(2)}</span>
                                  <span>After: {analysis.evaluation > 0 ? "+" : ""}{analysis.evaluation.toFixed(2)}</span>
                                </div>
                                <div className="mt-1 text-xs">
                                  Best move was: <span className="font-mono">{analysis.bestMoveSan}</span>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="mt-2 w-full"
                                  onClick={() => navigateToMove(index + 1)}
                                >
                                  Jump to this position
                                </Button>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-center py-10">
                          Play through the game to identify key moments
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium mb-3">Performance Metrics</h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Accuracy</span>
                            <span className="font-medium">
                              {reviewGame.playerColor === 'white' ? accuracyScore.white : accuracyScore.black}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Best Moves</span>
                            <span className="font-medium">
                              {moveAnalysis.filter(m => m?.quality === 'Best Move').length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Good Moves</span>
                            <span className="font-medium">
                              {moveAnalysis.filter(m => 
                                m?.quality === 'Good Move' || 
                                m?.quality === 'Excellent Move'
                              ).length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Mistakes</span>
                            <span className="font-medium text-yellow-500">
                              {moveAnalysis.filter(m => 
                                m?.quality === 'Mistake' || 
                                m?.quality === 'Inaccuracy'
                              ).length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Blunders</span>
                            <span className="font-medium text-red-500">
                              {moveAnalysis.filter(m => m?.quality === 'Blunder').length}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-6">
                          <div className="text-sm font-medium mb-2">Rating Estimate</div>
                          <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold">
                              {moveAnalysis.length > 0 
                                ? Math.round(moveAnalysis.reduce((sum, m) => sum + (m?.estimatedRating || 0), 0) / 
                                  moveAnalysis.filter(m => m?.estimatedRating).length)
                                : "?"}
                            </span>
                            <span className="text-sm text-muted-foreground mb-1">Based on move quality</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Move-by-Move Analysis</CardTitle>
                  <CardDescription>
                    Detailed analysis of all moves in this game
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">Move</th>
                          <th className="text-left py-2 px-3">Player</th>
                          <th className="text-left py-2 px-3">Prev Eval</th>
                          <th className="text-left py-2 px-3">New Eval</th>
                          <th className="text-left py-2 px-3">Diff</th>
                          <th className="text-left py-2 px-3">Quality</th>
                          <th className="text-left py-2 px-3">Best Move</th>
                        </tr>
                      </thead>
                      <tbody>
                        {moveAnalysis.map((analysis, index) => 
                          analysis ? (
                            <tr 
                              key={index} 
                              className="border-b hover:bg-muted/50 cursor-pointer"
                              onClick={() => navigateToMove(index + 1)}
                            >
                              <td className="py-2 px-3">{analysis.moveNumber}</td>
                              <td className="py-2 px-3 font-medium">{analysis.moveText}</td>
                              <td className="py-2 px-3">
                                {analysis.playerColor === 'white' ? 'White' : 'Black'}
                              </td>
                              <td className="py-2 px-3 font-mono">
                                {analysis.prevEval > 0 ? '+' : ''}
                                {analysis.prevEval.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 font-mono">
                                {analysis.evaluation > 0 ? '+' : ''}
                                {analysis.evaluation.toFixed(2)}
                              </td>
                              <td className={`py-2 px-3 font-mono ${
                                analysis.evalDifference > 0.2 ? 'text-red-500' : 
                                analysis.evalDifference < -0.2 ? 'text-green-500' : ''
                              }`}>
                                {analysis.evalDifference > 0 ? '+' : ''}
                                {analysis.evalDifference.toFixed(2)}
                              </td>
                              <td className={`py-2 px-3 ${getMoveQualityClass(analysis.quality)}`}>
                                {analysis.quality}
                              </td>
                              <td className="py-2 px-3 font-mono">
                                {analysis.bestMoveSan}
                              </td>
                            </tr>
                          ) : null
                        )}
                        
                        {moveAnalysis.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-muted-foreground">
                              Analysis will appear as you play through the game
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {showRequestLogs && (
            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <CardTitle>API Request & Response Logs</CardTitle>
                  <CardDescription>
                    Debug information for engine analysis requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="space-y-4">
                      {apiRequestLogs.map((log, index) => (
                        <div key={index} className="p-3 border rounded-md space-y-2">
                          <div className="flex justify-between">
                            <Badge variant={log.type === 'request' ? "outline" : "default"}>
                              {log.type === 'request' ? 'Request' : 'Response'} - Move {log.moveIndex}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                          </div>
                          <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
                            {JSON.stringify(log.type === 'request' ? log.body : log.response, null, 2)}
                          </pre>
                        </div>
                      ))}
                      
                      {apiRequestLogs.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground">
                          No API requests logged yet. Play through the game to see logs.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}