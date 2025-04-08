"use client"

import { useState, useEffect, useCallback } from "react";
import { Chess, Move} from "chess.js";
import { Chessboard } from "react-chessboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RefreshCw,
  Download,
} from "lucide-react";
import ChessPlayerStats from "./ChessPlayerStats";
import ChessEvaluationBar from "./ChessEvaluationBar";
import ChessMoveList from "./ChessMoveList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
// Import the new API function
import { getStockfishOnlineEvaluation, StockfishOnlineResponse } from "@/types/chess-api";


// Define helper outside component or ensure it's defined before use
const getFenPieces = (fen: string) => {
  const pieces: Record<string, number> = {};
  const position = fen.split(" ")[0];

  for (const char of position) {
    if (/[pnbrqkPNBRQK]/.test(char)) {
      pieces[char] = (pieces[char] || 0) + 1;
    }
  }

  return pieces;
};

// Define helper outside component or ensure it's defined before use
const getPieceSymbol = (piece: string): string => {
  const symbols: Record<string, string> = {
    p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
    P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  };
  return symbols[piece] || piece;
};

// Define helper outside component or ensure it's defined before use
const deriveMoveQualityCounts = (analysis: (MoveAnalysis | null)[]) => {
  // Use lowercase keys to match ChessPlayerStats expected props
  const counts = {
    white: { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0, total: 0 },
    black: { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0, total: 0 },
  };

  analysis.forEach(item => {
    if (item) {
      const player = item.playerColor;
      // Map the quality string (e.g., "Brilliant") to the lowercase key (e.g., "brilliant")
      const qualityKey = item.quality.toLowerCase() as keyof typeof counts.white;
      if (counts[player] && qualityKey in counts[player]) {
        counts[player][qualityKey]++;
        counts[player].total++;
      }
    }
  });
  return counts;
};



interface GameData {
  pgn?: string;
  fen?: string;
  playerColor: string;
  white: { username: string; rating?: number; result: string };
  black: { username: string; rating?: number; result: string };
  date?: string;
  time?: string;
  timeControl?: string;
  result?: string;
  resultText?: string;
  resultClass?: string;
}

// Move the interface definition outside the component
export interface MoveAnalysis {
  moveNumber: number;
  moveText: string;
  move: string; // SAN notation
  playerColor: 'white' | 'black';
  prevEval: number; // Eval before this move
  evaluation: number; // Eval after this move
  bestEval: number; // Eval if the best move was played instead
  cpl: number; // Centipawn Loss for this move
  quality: string; // Classification (e.g., Best, Blunder) - Renamed from moveQuality
  estimatedRatingAfterMove: number; // Add back: Running estimated rating after this move
}

interface GameReviewProps {
  game: GameData;
  username: string;
  isOpen?: boolean;
}

// Define a constant for the engine depth
const ENGINE_DEPTH = 13; // Adjust as needed (max 15 for stockfish.online)
const API_DELAY_MS = 150; // Delay between API calls to avoid rate limits

const GameReview = ({ game, username, isOpen = true }: GameReviewProps) => {
  const [chess, setChess] = useState<Chess | null>(null);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [evaluation, setEvaluation] = useState(0); // Eval of the current board position
  const [loading, setLoading] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState(0); // Progress for engine analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false); // Separate state for analysis phase
  // Store detailed analysis for each move
  const [moveAnalysis, setMoveAnalysis] = useState<(MoveAnalysis | null)[]>([]);
  // Store final calculated accuracies and performance ratings
  const [accuracies, setAccuracies] = useState({ white: 0, black: 0 });
  const [overallEstimatedRatings, setOverallEstimatedRatings] = useState({
    white: game?.white?.rating ?? 1500, // Initialize with actual or default rating
    black: game?.black?.rating ?? 1500
  });
  const [isPlayingThrough, setIsPlayingThrough] = useState(false);
  const [playbackSpeed, ] = useState(1500);
  const [capturedPieces, setCapturedPieces] = useState<{ white: string[]; black: string[] }>({ white: [], black: [] });
  const [isNavigating, setIsNavigating] = useState(false);
  const [lastActionTimestamp, setLastActionTimestamp] = useState(0);
  // Add missing state declarations
  const [evaluationsAfterMove, setEvaluationsAfterMove] = useState<number[]>([]);
  const [evaluationsBestMove, setEvaluationsBestMove] = useState<number[]>([]);


  // Function to update captured pieces based on FEN
  const updateCapturedPieces = useCallback((fen: string) => {
    const initialPieces: Record<string, number> = {
      P: 8, N: 2, B: 2, R: 2, Q: 1, K: 1,
      p: 8, n: 2, b: 2, r: 2, q: 1, k: 1,
    };
    const currentPieces = getFenPieces(fen); // Now defined above
    const captured: { white: string[]; black: string[] } = { white: [], black: [] };

    for (const piece in initialPieces) {
      const initialCount = initialPieces[piece];
      const currentCount = currentPieces[piece] || 0;
      const diff = initialCount - currentCount;

      if (diff > 0) {
        const pieceSymbol = getPieceSymbol(piece); // Now defined above
        const isWhitePiece = piece === piece.toUpperCase();
        const capturedBy = isWhitePiece ? 'black' : 'white'; // If white piece missing, black captured it
        for (let i = 0; i < diff; i++) {
          captured[capturedBy].push(pieceSymbol);
        }
      }
    }
    // Sort captured pieces for consistent display (optional)
    captured.white.sort();
    captured.black.sort();
    setCapturedPieces(captured);
  }, []); // Removed getFenPieces and getPieceSymbol as they are stable external functions


  // Function to convert API eval/mate to a single number (pawns)
  const getEvaluationValue = (apiResponse: StockfishOnlineResponse): number => {
    if (apiResponse.mate !== null) {
        // Assign large score for mate, sign indicates who is mating
        // Positive for white mating, negative for black mating
        const mateScore = 10000; // Use a large number outside normal eval range
        // Adjust sign based on moves to mate if needed, but API seems to handle it
        return apiResponse.mate > 0 ? mateScore - apiResponse.mate : -mateScore - apiResponse.mate;
    }
    // Use evaluation, default to 0 if null
    return apiResponse.evaluation ?? 0;
  };

  // Function to parse best move from API response (e.g., "e2e4 ponder e7e5" -> "e2e4")
  const parseBestMove = (bestmoveString: string | null): string | null => {
    if (!bestmoveString || bestmoveString.trim() === "") {
        return null;
    }

    const parts = bestmoveString.trim().split(' ');
    let potentialMove: string | undefined;

    // Check if the response starts with "bestmove" and has at least one more part
    if (parts[0].toLowerCase() === 'bestmove' && parts.length > 1) {
        potentialMove = parts[1]; // The actual move should be the second part
    } else if (parts.length > 0) {
        // Otherwise, assume the first part is the move (or potential garbage)
        potentialMove = parts[0];
    } else {
        // Should not happen if trim() was effective, but safe check
        return null;
    }

    if (!potentialMove) {
        console.warn('Could not determine potential move from bestmove string:', bestmoveString);
        return null;
    }

    // Check if the extracted potential move looks like a UCI move
    const uciPattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
    if (!uciPattern.test(potentialMove)) {
      console.warn(`Invalid UCI move format extracted: '${potentialMove}' from string: '${bestmoveString}'`);
      return null;
    }

    return potentialMove; // Return the validated UCI move
  };

  // NEW function to fetch evaluations from the Stockfish API
  const fetchEngineEvaluations = useCallback(async (chessInstance: Chess) => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    const history = chessInstance.history({ verbose: true });
    const evalsAfter: number[] = [0]; // Eval before first move
    const evalsBest: number[] = [0]; // Eval if best move was played (before first move)

    const tempChessEval = new Chess(); // For getting FEN after actual move
    const tempChessBest = new Chess(); // For applying best move and getting FEN

    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const fenBeforeMove = tempChessEval.fen(); // FEN before the current move 'i'

      // Apply the actual move to get the FEN after the move
      const actualMoveResult = tempChessEval.move(move);
      if (!actualMoveResult) {
          console.error(`Failed to apply actual move ${i}: ${move.san}`);
          // Handle error: maybe push previous eval or a default?
          evalsAfter.push(evalsAfter[evalsAfter.length - 1] ?? 0);
          evalsBest.push(evalsBest[evalsBest.length - 1] ?? 0);
          continue; // Skip to next move
      }
      const fenAfterActualMove = tempChessEval.fen();

      // --- Evaluation AFTER the actual move played ---
      let evalAfterActual = evalsAfter[evalsAfter.length - 1] ?? 0; // Default to previous
      try {
          await new Promise(resolve => setTimeout(resolve, API_DELAY_MS)); // Rate limit delay
          const apiResponseActual = await getStockfishOnlineEvaluation(fenAfterActualMove, ENGINE_DEPTH);
          if (apiResponseActual.success) {
              evalAfterActual = getEvaluationValue(apiResponseActual);
          } else {
              console.warn(`API failed for FEN (after actual): ${fenAfterActualMove}. Using previous eval.`);
          }
      } catch (e) {
          console.error(`Error fetching eval for FEN (after actual): ${fenAfterActualMove}`, e);
      }
      evalsAfter.push(evalAfterActual);


      // --- Evaluation IF the BEST move was played instead ---
      let evalAfterBest = evalAfterActual; // Default to actual eval if best move fails
      try {
          await new Promise(resolve => setTimeout(resolve, API_DELAY_MS)); // Rate limit delay
          const apiResponseBefore = await getStockfishOnlineEvaluation(fenBeforeMove, ENGINE_DEPTH);

          // Add logging here to inspect the response
          console.log(`API response for FEN ${fenBeforeMove}:`, apiResponseBefore);

          if (apiResponseBefore.success) {
              const bestMoveUCI = parseBestMove(apiResponseBefore.bestmove);
              if (bestMoveUCI) {
                  tempChessBest.load(fenBeforeMove); // Load state before the move
                  // Convert UCI string to move object
                  let moveObject = null;
                  try {
                      const from = bestMoveUCI.substring(0, 2);
                      const to = bestMoveUCI.substring(2, 4);
                      const promotion = bestMoveUCI.length === 5 ? bestMoveUCI.substring(4) : undefined;
                      moveObject = { from, to, promotion };
                  } catch (parseError) {
                      console.error(`Error parsing UCI move: ${bestMoveUCI}`, parseError);
                  }
                  // Apply the parsed move
                  const bestMoveResult = moveObject ? tempChessBest.move(moveObject) : null;
                  if (bestMoveResult) {
                      const fenAfterBestMove = tempChessBest.fen();
                      await new Promise(resolve => setTimeout(resolve, API_DELAY_MS)); // Rate limit delay
                      const apiResponseBest = await getStockfishOnlineEvaluation(fenAfterBestMove, ENGINE_DEPTH);
                      if (apiResponseBest.success) {
                          evalAfterBest = getEvaluationValue(apiResponseBest);
                      } else {
                          console.warn(`API failed for FEN (after best): ${fenAfterBestMove}. Using actual eval.`);
                      }
                  } else {
                      console.warn(`Failed to apply best move from UCI: ${bestMoveUCI}. Using actual eval.`);
                  }
              } else {
                  console.warn(`No valid best move parsed from API response. Using actual eval.`);
              }
          } else {
              console.warn(`API failed for FEN (before move): ${fenBeforeMove}. Using actual eval for best.`);
          }
      } catch (e) {
          console.error(`Error fetching/processing best move for FEN: ${fenBeforeMove}`, e);
      }
      evalsBest.push(evalAfterBest);


      // Update progress
      setAnalysisProgress(Math.round(((i + 1) / history.length) * 100));
    }

    setEvaluationsAfterMove(evalsAfter);
    setEvaluationsBestMove(evalsBest);
    setIsAnalyzing(false);
    setAnalysisProgress(100);
    toast.success("Engine analysis complete!");

  // Add dependencies for useCallback
  }, [setEvaluationsAfterMove, setEvaluationsBestMove, setIsAnalyzing, setAnalysisProgress]);


  useEffect(() => {
    if (isOpen && game) {
      setLoading(true); // Ensure loading state is set
      try {
        const chessInstance = new Chess();
        // ... PGN/FEN loading logic ...
        // (Ensure error handling remains as is)
        if (game.pgn) {
          try {
            chessInstance.loadPgn(game.pgn);
          } catch (pgnError) {
            console.error("Error loading PGN:", pgnError);
            toast.error("Failed to load PGN.");
            setLoading(false);
            setChess(null);
            return;
          }
        } else if (game.fen) {
          try {
            chessInstance.load(game.fen);
          } catch (fenError) {
            console.error("Error loading FEN:", game.fen, fenError);
            toast.error("Failed to load FEN.");
            setLoading(false);
            setChess(null);
            return;
          }
        } else {
           toast.error("No PGN or FEN provided for game review.");
           setLoading(false);
           setChess(null);
           return;
        }

        setChess(chessInstance);
        const history = chessInstance.history({ verbose: true });
        setMoveHistory(history);

        // Generate evaluations (placeholder or real)
        fetchEngineEvaluations(chessInstance);

        // Reset state for new game
        setCurrentMoveIndex(-1);
        setEvaluation(0);
        setMoveAnalysis([]); // Clear previous analysis
        setAccuracies({ white: 0, black: 0 });
        setOverallEstimatedRatings({ white: game.white?.rating ?? 1500, black: game.black?.rating ?? 1500 });
        updateCapturedPieces(chessInstance.fen()); // Call updateCapturedPieces here
        setLoading(false);
      } catch (error) {
        console.error("Error loading chess game:", error);
        setLoading(false);
        setChess(null);
        toast.error("Error loading chess game");
      }
    } else {
      // Reset or clear state if component is not open or no game data
      setChess(null);
      setMoveHistory([]);
      setCurrentMoveIndex(-1);
      setLoading(false); // Ensure loading is false if not open/no game
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, isOpen, fetchEngineEvaluations, updateCapturedPieces]); // Add updateCapturedPieces dependency


  // Function to map CPL to an estimated rating for a single move
  const mapCPLToRating = (cpl: number): number => {
    // Revised curve: Less generous at the top, more granular lower down.
    // Calibrate based on observation: ~10 CPL -> ~2000+, ~30 CPL -> ~1600, ~70 CPL -> ~1200 etc.
    // This is still a rough estimate and needs real data calibration.
    if (cpl < 5) return 2200; // Very low CPL -> Strong Expert/Low Master
    if (cpl < 10) return 2000 + (10 - cpl) * 40; // 2000-2200
    if (cpl < 20) return 1800 + (20 - cpl) * 20; // 1800-2000
    if (cpl < 35) return 1600 + (35 - cpl) * 13.3; // 1600-1800
    if (cpl < 55) return 1400 + (55 - cpl) * 10; // 1400-1600
    if (cpl < 80) return 1200 + (80 - cpl) * 8; // 1200-1400
    if (cpl < 120) return 1000 + (120 - cpl) * 5; // 1000-1200
    if (cpl < 180) return 800 + (180 - cpl) * 3.33; // 800-1000
    return 700; // High CPL -> Beginner range
  };

  // Function to classify move quality based on CPL and context
  const classifyMoveByCPL = (
    cpl: number,
    moveIndex: number,
    prevEval: number, // Add prevEval
    evaluation: number, // Add evaluation (eval after the move)
    playerColor: 'white' | 'black' // Add playerColor
  ): string => {
    // Book move check (simple version)
    if (moveIndex < 10 && cpl < 25) return "Book";

    // Brilliant Move Criteria:
    // 1. Very low CPL (close to best move)
    // 2. Significantly improves the position from a non-winning state
    const evalGain = playerColor === 'white' ? evaluation - prevEval : prevEval - evaluation;
    const wasWinning = playerColor === 'white' ? prevEval > 1.5 : prevEval < -1.5;

    if (cpl <= 5 && evalGain >= 1.0 && !wasWinning) {
      // Add more checks later if needed (e.g., is it a sacrifice?)
      return "Brilliant";
    }

    // Other classifications based on CPL thresholds
    if (cpl <= 8) return "Best";
    if (cpl <= 20) return "Excellent";
    if (cpl <= 40) return "Good";
    if (cpl <= 80) return "Inaccuracy";
    if (cpl <= 150) return "Mistake";
    return "Blunder";
  };

  // Calculate accuracy percentage from average CPL
  const calculateAccuracyFromAvgCPL = (avgCPL: number): number => {
    // Using the formula: Accuracy = 103.1668 * exp(-0.04354 * AvgCPL) - 3.1668
    // Ensure avgCPL is non-negative
    const safeAvgCPL = Math.max(0, avgCPL);
    const accuracy = 103.1668 * Math.exp(-0.04354 * safeAvgCPL) - 3.1668;
    // Clamp accuracy between 0 and 100
    return Math.max(0, Math.min(100, Math.round(accuracy * 10) / 10));
  };



  // This effect calculates analysis results AFTER engine evaluations are ready
  useEffect(() => {
    // Ensure all required data is present and valid
    // Check lengths carefully: evals should be history.length + 1
    if (!chess || moveHistory.length === 0 || evaluationsAfterMove.length !== moveHistory.length + 1 || evaluationsBestMove.length !== moveHistory.length + 1) {
      return;
    }

    // console.log("Running analysis calculation..."); // Debug log

    const analysisResults: (MoveAnalysis | null)[] = [];
    // Use optional chaining and provide default ratings from the game prop
    let currentWhiteRating = game?.white?.rating ?? 1500;
    let currentBlackRating = game?.black?.rating ?? 1500;
    const alpha = 0.1;

    let whiteCPLSum = 0;
    let whiteMoveCount = 0;
    let blackCPLSum = 0;
    let blackMoveCount = 0;

    for (let i = 0; i < moveHistory.length; i++) {
      const move = moveHistory[i];
      if (!move || !move.color || !move.san) {
         console.warn(`Skipping invalid move object at index ${i}:`, move);
         analysisResults.push(null);
         continue;
      }

      const playerColor = move.color === 'w' ? 'white' : 'black';
      const moveNumber = Math.floor(i / 2) + 1;
      const moveText = `${moveNumber}${playerColor === 'white' ? '.' : '...'}${move.san}`;

      // Indices for eval arrays are i (before move) and i+1 (after move)
      const prevEval = evaluationsAfterMove[i];
      const evaluation = evaluationsAfterMove[i + 1];
      const bestEval = evaluationsBestMove[i + 1];

      if (typeof prevEval !== 'number' || typeof evaluation !== 'number' || typeof bestEval !== 'number') {
        console.warn(`Invalid evaluation data for move ${i + 1}:`, { prevEval, evaluation, bestEval });
        analysisResults.push(null);
        continue;
      }

      let cpl = 0;
      if (playerColor === 'white') {
        // White wants higher eval, CPL = best_possible - actual
        cpl = Math.max(0, bestEval - evaluation);
      } else {
        // Black wants lower eval (more negative), CPL = actual - best_possible (which is more negative)
        cpl = Math.max(0, evaluation - bestEval);
      }

      // Update the call to pass the required arguments
      const quality = classifyMoveByCPL(cpl, i, prevEval, evaluation, playerColor);
      let estimatedRatingAfterMove: number;

      // Update running rating estimate for non-book moves
      if (quality !== "Book") {
        const moveRating = mapCPLToRating(cpl); // Estimate rating for this specific move
        if (playerColor === 'white') {
          // Apply weighted moving average
          currentWhiteRating = alpha * moveRating + (1 - alpha) * currentWhiteRating;
          estimatedRatingAfterMove = Math.round(currentWhiteRating);
          whiteCPLSum += cpl;
          whiteMoveCount++;
        } else {
          // Apply weighted moving average
          currentBlackRating = alpha * moveRating + (1 - alpha) * currentBlackRating;
          estimatedRatingAfterMove = Math.round(currentBlackRating);
          blackCPLSum += cpl;
          blackMoveCount++;
        }
      } else {
        // For book moves, the running estimate doesn't change
        estimatedRatingAfterMove = Math.round(playerColor === 'white' ? currentWhiteRating : currentBlackRating);
      }

      analysisResults.push({
        moveNumber,
        moveText,
        move: move.san,
        playerColor,
        prevEval,
        evaluation,
        bestEval,
        cpl,
        quality,
        estimatedRatingAfterMove, // Store the running estimate
      });
    }

    setMoveAnalysis(analysisResults);

    const finalWhiteAvgCPL = whiteMoveCount > 0 ? whiteCPLSum / whiteMoveCount : 0;
    const finalBlackAvgCPL = blackMoveCount > 0 ? blackCPLSum / blackMoveCount : 0;

    setAccuracies({
      white: calculateAccuracyFromAvgCPL(finalWhiteAvgCPL),
      black: calculateAccuracyFromAvgCPL(finalBlackAvgCPL),
    });

    // Set overall estimated ratings to the FINAL running estimate after all moves
    setOverallEstimatedRatings({
      white: Math.round(currentWhiteRating),
      black: Math.round(currentBlackRating),
    });

  }, [
      chess,
      moveHistory,
      evaluationsAfterMove,
      evaluationsBestMove,
      game?.white?.rating,
      game?.black?.rating,
    ]); // Refined dependencies


  // goToMove needs to update the displayed evaluation based on the move index
  const goToMove = useCallback((moveIndex: number) => {
    if (!chess || currentMoveIndex === moveIndex || isNavigating) {
      return;
    }
    setIsNavigating(true);
    try {
      const newChess = new Chess();
      for (let i = 0; i <= moveIndex && i < moveHistory.length; i++) {
        const move = moveHistory[i];
        if (!move) throw new Error(`Invalid move history at index ${i}`);
        const result = newChess.move({ from: move.from, to: move.to, promotion: move.promotion });
        if (!result) throw new Error(`Failed to apply move ${i}`);
      }
      setChess(newChess);
      setCurrentMoveIndex(moveIndex);
      const displayEval = evaluationsAfterMove[moveIndex + 1] ?? evaluationsAfterMove[0] ?? 0;
      setEvaluation(displayEval);
      updateCapturedPieces(newChess.fen()); // Call the memoized callback
    } catch (error) {
      console.error("Error navigating to move:", error);
      toast.error("Error navigating to this position");
    } finally {
      setTimeout(() => setIsNavigating(false), 0);
    }
  }, [chess, moveHistory, currentMoveIndex, isNavigating, evaluationsAfterMove, updateCapturedPieces]); // Correct dependencies

  // Handle moving to next move - simplified for single step
  const handleNextMove = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimestamp < 100) { // Slightly reduced throttle for responsiveness
      // console.log("Throttling navigation - too soon after last action");
      return;
    }

    if (!chess || !moveHistory.length || currentMoveIndex >= moveHistory.length - 1 || isNavigating) {
      // If called during playback and at the end, stop playback
      if (isPlayingThrough) {
          setIsPlayingThrough(false);
      }
      return;
    }

    setLastActionTimestamp(now);
    const nextMoveIndex = currentMoveIndex + 1;
    // console.log(`Manual/Step forward from ${currentMoveIndex} to ${nextMoveIndex}`);
    goToMove(nextMoveIndex);

  }, [chess, moveHistory, currentMoveIndex, isNavigating, lastActionTimestamp, goToMove, isPlayingThrough]); // Added isPlayingThrough

  // useEffect hook to handle auto-play timer
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    if (isPlayingThrough && !isNavigating && currentMoveIndex < moveHistory.length - 1) {
      // console.log(`Scheduling next auto-move from index ${currentMoveIndex}`);
      timerId = setTimeout(() => {
        // Check again if still playing before moving
        if (isPlayingThrough) {
          handleNextMove();
        }
      }, playbackSpeed);
    } else if (isPlayingThrough) {
      // Stop playing if end is reached or navigation is happening
      // console.log("Auto-play stopping: end reached or navigating.");
      setIsPlayingThrough(false);
    }

    // Cleanup function to clear the timeout
    return () => {
      if (timerId) {
        // console.log("Clearing auto-play timer.");
        clearTimeout(timerId);
      }
    };
  }, [isPlayingThrough, isNavigating, currentMoveIndex, moveHistory.length, playbackSpeed, handleNextMove]);


  // Handle moving to previous move with logging
  const handlePrevMove = useCallback(() => {
    // Throttling to prevent rapid clicks
    const now = Date.now();
    if (now - lastActionTimestamp < 100) { // Slightly reduced throttle
      return;
    }

    if (!chess || currentMoveIndex <= -1 || isNavigating) return;

    // Stop playback if user navigates manually
    if (isPlayingThrough) setIsPlayingThrough(false);

    setLastActionTimestamp(now);

    // Minimal logging
    // console.log(`Moving backward from ${currentMoveIndex} to ${currentMoveIndex - 1}`);

    goToMove(currentMoveIndex - 1);
  }, [chess, currentMoveIndex, goToMove, isNavigating, lastActionTimestamp, isPlayingThrough]); // Added isPlayingThrough

  // Handle moving to first move
  const handleFirstMove = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimestamp < 100 || !chess || isNavigating) return;

    if (isPlayingThrough) setIsPlayingThrough(false); // Stop playback

    setLastActionTimestamp(now);
    goToMove(-1);
  }, [chess, goToMove, isNavigating, lastActionTimestamp, isPlayingThrough]); // Added isPlayingThrough

  // Handle moving to last move
  const handleLastMove = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimestamp < 100 || !chess || !moveHistory.length || isNavigating) return;

    if (isPlayingThrough) setIsPlayingThrough(false); // Stop playback

    setLastActionTimestamp(now);
    goToMove(moveHistory.length - 1);
  }, [chess, moveHistory, goToMove, isNavigating, lastActionTimestamp, isPlayingThrough]); // Added isPlayingThrough

  // Handle play-through mode
  const handlePlayThrough = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimestamp < 100 || isNavigating || isPlayingThrough) return; // Prevent starting if already playing

    setLastActionTimestamp(now);
    // console.log("Starting play through");
    setIsPlayingThrough(true);
    // The useEffect hook will now trigger the first handleNextMove
  }, [isNavigating, lastActionTimestamp, isPlayingThrough]); // Added isPlayingThrough

  // Handle stopping play-through mode
  const handleStopPlayThrough = useCallback(() => {
    // console.log("Stopping play through");
    setIsPlayingThrough(false);
  }, []);


  // ...existing code...


  const downloadPGN = useCallback(() => {
    if (!game || !chess || !moveAnalysis || moveAnalysis.length === 0) { // Check analysis existence
      toast.error("No game data or analysis available");
      return;
    }
    try {
      const pgnHeader = chess.header(); // Get headers as object
      const headerString = Object.entries(pgnHeader)
        .map(([key, value]) => `[${key} "${value}"]`)
        .join('\n');

      let pgnMovesSection = "";
      const tempChessForPgn = new Chess();

      moveAnalysis.forEach((analysis, index) => {
         if (!analysis || !moveHistory[index]) return; // Skip null analysis or missing history

         // Attempt to make the move from history on the temp board
         const moveDetail = moveHistory[index];
         let moveResult;
         try {
            moveResult = tempChessForPgn.move({ from: moveDetail.from, to: moveDetail.to, promotion: moveDetail.promotion });
            if (!moveResult) {
                console.warn(`PGN Download: Failed to apply move ${index + 1} (${moveDetail.san}) to temp board.`);
                return; // Skip this move if it fails
            }
         } catch (e) {
            console.warn(`PGN Download: Error applying move ${index + 1} (${moveDetail.san}) to temp board:`, e);
            return; // Skip this move on error
         }


         if (analysis.playerColor === 'white') {
           pgnMovesSection += `${analysis.moveNumber}. `;
         } else if (index === 0 || analysis.moveNumber !== moveAnalysis[index-1]?.moveNumber) { // Handle starting with black or new move number
           pgnMovesSection += `${analysis.moveNumber}... `;
         }
         pgnMovesSection += `${moveResult.san} `; // Use SAN from successful move application
         // Use analysis.quality here
         const comment = `{[%csl G${moveResult.to},Y${moveResult.from}][%cal G${moveResult.to}] Quality: ${analysis.quality}; CPL: ${analysis.cpl.toFixed(2)}; EstRating: ${analysis.estimatedRatingAfterMove}} `; // Removed non-existent EstRating
         pgnMovesSection += comment;
         if (analysis.playerColor === 'black' || index === moveAnalysis.length - 1) { // Add newline after black's move or at the end
           pgnMovesSection += '\n';
         }
      });

      const gameResult = pgnHeader.Result || "*";
      const enhancedPGN = `${headerString}\n\n${pgnMovesSection.trim()} ${gameResult}`;

      const blob = new Blob([enhancedPGN], { type: "application/x-chess-pgn" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analysis_${game?.white?.username ?? 'white'}_vs_${game?.black?.username ?? 'black'}.pgn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Analysis PGN downloaded successfully");

    } catch (err) {
      console.error("Error downloading PGN:", err);
      toast.error("Error creating download");
    }
  }, [chess, game, moveHistory, moveAnalysis]); // Correct dependencies


  // Function to get move quality CSS class (remains the same)
  const getMoveQualityClass = (quality: string): string => {
    switch (quality) { // Expects "Brilliant", "Best", etc.
      case "Brilliant": return "text-purple-400";
      case "Great": return "text-indigo-400"; // Added Great for variety
      case "Best": return "text-green-400";
      case "Excellent": return "text-blue-400"; // Renamed Good to Excellent
      case "Good": return "text-sky-400"; // Added Good
      case "Book": return "text-gray-400"; // Changed Book color
      case "Inaccuracy": return "text-yellow-400";
      case "Mistake": return "text-orange-400";
      case "Blunder": return "text-red-400";
      default: return "text-gray-500"; // Default fallback
    }
  };

  // ... (loading/error states remain the same) ...

  if (loading) {
     return (
       <div className="flex justify-center items-center h-64">
         <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
         <span className="ml-2">Loading game...</span>
       </div>
     );
   }

   if (isAnalyzing) {
     return (
       <div className="flex flex-col justify-center items-center h-64">
         <RefreshCw className="h-8 w-8 animate-spin text-green-500" />
         <span className="ml-2 mt-2">Analyzing game with engine... ({analysisProgress}%)</span>
         <Progress value={analysisProgress} className="w-1/2 mt-2 h-2" />
         <span className="text-xs text-gray-500 mt-1">This may take a moment...</span>
       </div>
     );
   }


   if (!chess) {
     return (
       <div className="flex justify-center items-center h-64">
         <p className="text-red-500">Could not load game.</p>
       </div>
     );
   }

  const isWhite = game?.white?.username.toLowerCase() === username.toLowerCase();
  const boardOrientation = isWhite ? 'white' : 'black';
  const moveQualityCounts = deriveMoveQualityCounts(moveAnalysis);


  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Chessboard and Controls Column */}
        <div className="md:col-span-3">
          <Card>
            {/* ... CardHeader with game info ... */}
             <CardHeader className="pb-2">
               <div className="flex justify-between items-center">
                 <CardTitle className="text-lg">
                   {game?.white?.username ?? 'White'} vs {game?.black?.username ?? 'Black'}
                   {game?.timeControl && (
                     <Badge variant="outline" className="ml-2 text-xs">
                       {game.timeControl}
                     </Badge>
                   )}
                 </CardTitle>
                 {game?.resultText && (
                   <div className={`text-lg font-bold ${game.resultClass}`}>
                     {game.resultText}
                   </div>
                 )}
               </div>
             </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-stretch">
                {/* Evaluation Bar */}
                <ChessEvaluationBar evaluation={evaluation} />
                {/* Chessboard */}
                <div className="flex-1">
                  <Chessboard
                    id="ReviewBoard"
                    position={chess.fen()}
                    boardOrientation={boardOrientation}
                    arePiecesDraggable={false}
                    // Add custom squares, arrows if needed based on analysis
                  />
                </div>
              </div>

              {/* Move Navigation and Download */}
              <div className="mt-4 border-t pt-4">
                <div className="flex justify-between items-center">
                   {/* Navigation Buttons */}
                   <div className="flex items-center space-x-1">
                     <Button variant="outline" size="sm" onClick={handleFirstMove} disabled={currentMoveIndex === -1 || isNavigating}>
                       <SkipBack className="h-4 w-4" />
                     </Button>
                     <Button variant="outline" size="sm" onClick={handlePrevMove} disabled={currentMoveIndex === -1 || isNavigating}>
                       <SkipBack className="h-4 w-4" /> {/* Icon might need changing */}
                     </Button>
                     {isPlayingThrough ? (
                       <Button variant="outline" size="sm" onClick={handleStopPlayThrough}>
                         <Pause className="h-4 w-4" />
                       </Button>
                     ) : (
                       <Button variant="outline" size="sm" onClick={handlePlayThrough} disabled={currentMoveIndex === moveHistory.length - 1 || isNavigating}>
                         <Play className="h-4 w-4" />
                       </Button>
                     )}
                     <Button variant="outline" size="sm" onClick={handleNextMove} disabled={currentMoveIndex === moveHistory.length - 1 || isNavigating}>
                       <SkipForward className="h-4 w-4" />
                     </Button>
                     <Button variant="outline" size="sm" onClick={handleLastMove} disabled={currentMoveIndex === moveHistory.length - 1 || isNavigating}>
                       <SkipForward className="h-4 w-4" /> {/* Icon might need changing */}
                     </Button>
                   </div>
                   {/* Download Button */}
                   <Button variant="outline" size="sm" onClick={downloadPGN}>
                     <Download className="h-4 w-4 mr-2" />
                     Download Analysis
                   </Button>
                 </div>
                {/* Progress Bar and Player Info */}
                 <div className="mt-2">
                   <div className="text-sm text-gray-500">
                     Move {currentMoveIndex + 1} of {moveHistory.length}
                   </div>
                   <Progress
                     value={moveHistory.length > 0 ? ((currentMoveIndex + 1) / moveHistory.length) * 100 : 0}
                     className="h-1 mt-1"
                   />
                 </div>
                 <div className="mt-4 flex justify-between">
                   {/* White Player Info */}
                   <div className="flex items-center gap-2">
                     <div className="bg-white w-3 h-3 rounded-full border border-gray-300"></div>
                     <span>{game?.white?.username ?? 'White'}</span>
                     <span className="text-sm text-gray-500">
                       {accuracies.white > 0 ? `${accuracies.white.toFixed(1)}%` : ""}
                     </span>
                   </div>
                   {/* Black Player Info */}
                   <div className="flex items-center gap-2">
                     <span className="text-sm text-gray-500">
                       {accuracies.black > 0 ? `${accuracies.black.toFixed(1)}%` : ""}
                     </span>
                     <span>{game?.black?.username ?? 'Black'}</span>
                     <div className="bg-black w-3 h-3 rounded-full border border-gray-600"></div>
                   </div>
                 </div>
                 {/* Captured Pieces */}
                 <div className="mt-2 flex justify-between">
                   <div className="flex gap-1">
                     {capturedPieces.black.map((piece, i) => (
                       <span key={i} className="text-lg text-gray-600"> {/* Adjusted color */}
                         {piece}
                       </span>
                     ))}
                   </div>
                   <div className="flex gap-1">
                     {capturedPieces.white.map((piece, i) => (
                       <span key={i} className="text-lg text-gray-600"> {/* Adjusted color */}
                         {piece}
                       </span>
                     ))}
                   </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats and Move List Column */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Player Stats Component */}
          <ChessPlayerStats
            whiteUsername={game?.white?.username ?? 'White'}
            blackUsername={game?.black?.username ?? 'Black'}
            whiteRating={game?.white?.rating}
            blackRating={game?.black?.rating}
            whiteAccuracy={accuracies.white} // Pass final accuracy
            blackAccuracy={accuracies.black} // Pass final accuracy
            moveQuality={moveQualityCounts} // Pass move quality counts (uncommented)
            estimatedPerformance={overallEstimatedRatings} // Pass final estimated ratings
          />

          {/* Move List Component */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Move List</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ChessMoveList
                moves={moveHistory}
                currentMoveIndex={currentMoveIndex}
                onSelectMove={goToMove} // Use the updated goToMove
                isNavigating={isNavigating}
                // Pass moveAnalysis to enable quality styling in the list
                moveAnalysis={moveAnalysis}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analysis Tabs */}
      <div className="mt-6">
        <Tabs defaultValue="analysis">
          <TabsList>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {/* Move-by-Move Analysis Tab */}
          <TabsContent value="analysis">
            <Card>
              <CardHeader>
                <CardTitle>Move-by-Move Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">Move</th>
                        <th className="text-left p-2">Eval</th>
                        <th className="text-left p-2">CPL</th>
                        <th className="text-left p-2">Quality</th>
                        {/* Add Est. Rating column header back */}
                        <th className="text-left p-2">Est. Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moveAnalysis.filter((analysis): analysis is MoveAnalysis => analysis !== null).map((analysis) => {
                         const originalIndex = moveAnalysis.findIndex(a => a === analysis);
                         if (originalIndex === -1) return null;

                         return (
                           <tr
                             key={`${originalIndex}-${analysis.move}`}
                             className={`border-b hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${currentMoveIndex === originalIndex ? 'bg-blue-100 dark:bg-blue-900' : ''} ${analysis.playerColor === 'black' ? 'bg-gray-50 dark:bg-gray-700/30' : ''}`}
                             onClick={() => goToMove(originalIndex)}
                           >
                             <td className="p-2">{analysis.moveNumber}{analysis.playerColor === 'white' ? '.' : '...'}</td>
                             <td className="p-2 font-medium">{analysis.move}</td>
                             <td className="p-2 font-mono"> {analysis.evaluation > 0 ? '+' : ''} {analysis.evaluation.toFixed(2)} </td>
                             <td className={`p-2 font-mono ${analysis.cpl > 70 ? 'text-red-500' : analysis.cpl > 30 ? 'text-yellow-500' : ''}`}> {analysis.cpl.toFixed(2)} </td>
                             <td className={`p-2 ${getMoveQualityClass(analysis.quality)}`}> {analysis.quality} </td>
                             {/* Add Est. Rating cell back */}
                             <td className="p-2 font-mono"> {analysis.estimatedRatingAfterMove} </td>
                           </tr>
                         );
                       })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights">
             <Card>
               <CardHeader>
                 <CardTitle>Game Insights</CardTitle>
               </CardHeader>
               <CardContent>
                 {/* Add insights based on the new analysis data */}
                 <p>Summary of move quality and key moments.</p>
                 {/* Example: Find critical moments (Blunders/Mistakes) */}
                 <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 className="font-bold mb-2">White ({game?.white?.username})</h3>
                        {moveQualityCounts.white.total > 0 ? ( // Use lowercase total
                            <ul>
                                {Object.entries(moveQualityCounts.white)
                                    // Use lowercase key and check value > 0
                                    .filter(([key, value]) => key !== 'total' && value > 0)
                                    .map(([key, value]) => (
                                    // Use getMoveQualityClass with capitalized key for styling
                                    <li key={`w-${key}`} className={`${getMoveQualityClass(key.charAt(0).toUpperCase() + key.slice(1))}`}>
                                        {/* Display capitalized key */}
                                        {key.charAt(0).toUpperCase() + key.slice(1)}: {value} ({(value / moveQualityCounts.white.total * 100).toFixed(1)}%)
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-gray-500">No moves analyzed.</p>}
                    </div>
                    <div>
                        <h3 className="font-bold mb-2">Black ({game?.black?.username})</h3>
                         {moveQualityCounts.black.total > 0 ? ( // Use lowercase total
                            <ul>
                                {Object.entries(moveQualityCounts.black)
                                    // Use lowercase key and check value > 0
                                    .filter(([key, value]) => key !== 'total' && value > 0)
                                    .map(([key, value]) => (
                                     // Use getMoveQualityClass with capitalized key for styling
                                    <li key={`b-${key}`} className={`${getMoveQualityClass(key.charAt(0).toUpperCase() + key.slice(1))}`}>
                                        {/* Display capitalized key */}
                                        {key.charAt(0).toUpperCase() + key.slice(1)}: {value} ({(value / moveQualityCounts.black.total * 100).toFixed(1)}%)
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-gray-500">No moves analyzed.</p>}
                    </div>
                 </div>
                 <div className="mt-4">
                   <h3 className="font-bold mb-2">Critical Moves</h3>
                   {/* Filter using analysis.quality */}
                   {moveAnalysis.filter(m => m?.quality === 'Blunder' || m?.quality === 'Mistake').length > 0 ? (
                     <ul className="space-y-1">
                       {/* Filter using analysis.quality */}
                       {moveAnalysis.filter((m): m is MoveAnalysis => !!m && (m.quality === 'Blunder' || m.quality === 'Mistake')).map((m) => {
                         const originalIndex = moveAnalysis.findIndex(ma => ma === m);
                         return (
                           <li key={originalIndex} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded flex justify-between items-center" onClick={() => goToMove(originalIndex)}>
                             <span>{m.moveText} ({m.playerColor})</span>
                             {/* Use analysis.quality */}
                             <span className={`${getMoveQualityClass(m.quality)} font-semibold`}>{m.quality} (CPL: {m.cpl.toFixed(2)})</span>
                           </li>
                         );
                       })}
                     </ul>
                   ) : <p className="text-gray-500">No significant mistakes or blunders found.</p>}
                 </div>
               </CardContent>
             </Card>
           </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GameReview;