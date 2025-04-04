"use client"

import { useState, useEffect, useCallback } from "react";
import { Chess, Move, Square } from "chess.js"; 
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


const MOVE_CLASSIFICATIONS = {
  BRILLIANT: { threshold: 0.9, multiplier: 2.0 },
  GREAT: { threshold: 0.6, multiplier: 1.5 },
  BEST: { threshold: 0.3, multiplier: 1.2 },
  EXCELLENT: { threshold: 0.1, multiplier: 1.1 },
  GOOD: { threshold: -0.1, multiplier: 1.0 },
  BOOK: { threshold: 0, multiplier: 1.0 },
  INACCURACY: { threshold: -0.5, multiplier: 0.8 },
  MISTAKE: { threshold: -1.0, multiplier: 0.6 },
  BLUNDER: { threshold: -2.0, multiplier: 0.4 }
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

interface GameReviewProps {
  game: GameData;
  username: string;
  isOpen?: boolean;
}

interface MoveAnalysis {
  moveNumber: number;
  moveText: string;
  move: string;
  playerColor: 'white' | 'black';
  prevEval: number;
  evaluation: number;
  evalDifference: number;
  quality: string;
  estimatedRating: number;
}

const GameReview = ({ game, username, isOpen = true }: GameReviewProps) => {
  const [chess, setChess] = useState<Chess | null>(null);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]); 
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [evaluation, setEvaluation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moveQuality, setMoveQuality] = useState({
    white: {
      brilliant: 0,
      great: 0,
      best: 0,
      excellent: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      book: 0
    },
    black: {
      brilliant: 0,
      great: 0,
      best: 0,
      excellent: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      book: 0
    }
  });
  const [moveEvaluations, setMoveEvaluations] = useState<number[]>([]);
  const [accuracies, setAccuracies] = useState({
    white: 0,
    black: 0
  });
  const [moveByMoveRatings, setMoveByMoveRatings] = useState<{
    white: number[];
    black: number[];
  }>({
    white: [],
    black: []
  });
  const [isPlayingThrough, setIsPlayingThrough] = useState(false);
  const [playbackSpeed, ] = useState(1500);
  const [moveAnalysis, setMoveAnalysis] = useState<MoveAnalysis[]>([]); 
  const [capturedPieces, setCapturedPieces] = useState<{ white: string[]; black: string[] }>({ white: [], black: [] });

  const generateMoveEvaluations = useCallback((chessInstance: Chess) => {
    const history = chessInstance.history({ verbose: true });
    const evaluations: number[] = [0];
    
    const tempChess = new Chess();
    let prevEval = 0;
    
    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      tempChess.move({ from: move.from, to: move.to, promotion: move.promotion });
      
      const pieces = countPieces(tempChess);
      
      
      let positionFactor = 0;
      
      const centralSquares: Square[] = ['d4', 'd5', 'e4', 'e5']; 
      centralSquares.forEach(square => {
        const piece = tempChess.get(square); 
        if (piece) {
          positionFactor += piece.color === 'w' ? 0.15 : -0.15;
        }
      });
      
      
      if (pieces.w.b >= 2) positionFactor += 0.5;
      if (pieces.b.b >= 2) positionFactor -= 0.5;
      
      
      const wKingSquare = findKing(tempChess, 'w');
      const bKingSquare = findKing(tempChess, 'b');
      
      
      if (wKingSquare) {
        const wKingFile = wKingSquare.charCodeAt(0) - 97;
        if ((wKingFile === 6 || wKingFile === 7) && pieces.w.p >= 3) {
          positionFactor += 0.4;
        }
      }
      
      if (bKingSquare) {
        const bKingFile = bKingSquare.charCodeAt(0) - 97;
        if ((bKingFile === 6 || bKingFile === 7) && pieces.b.p >= 3) {
          positionFactor -= 0.4;
        }
      }
      
      
      const materialEval = 
        pieces.w.p - pieces.b.p + 
        3 * (pieces.w.n - pieces.b.n) + 
        3.25 * (pieces.w.b - pieces.b.b) + 
        5 * (pieces.w.r - pieces.b.r) + 
        9 * (pieces.w.q - pieces.b.q);
      
      
      const noiseFactor = (Math.random() * 0.2) - 0.1;
      
      
      const tempoFactor = tempChess.turn() === 'w' ? 0.1 : -0.1;
      
      const evaluation = materialEval + positionFactor + noiseFactor + tempoFactor;
      
      
      const smoothedEval = prevEval * 0.2 + evaluation * 0.8;
      prevEval = smoothedEval;
      
      evaluations.push(smoothedEval);
    }
    
    return evaluations;
  }, []);

  useEffect(() => {
    if (isOpen && game) {
      try {
        const chessInstance = new Chess();
        
        if (game.pgn) {
          console.log("Loading PGN:", game.pgn.substring(0, 100) + "...");
          
          try {
            
            chessInstance.loadPgn(game.pgn);
            console.log("PGN loaded successfully using standard method");
          } catch (pgnError) {
            console.error("Error loading PGN with standard method:", pgnError);
            
            
            console.log("Attempting manual PGN parsing as fallback...");
            try {
              
              const moveRegex = /\d+\.\s+(\S+)\s+(?:(\S+)\s+)?/g;
              let match;
              const moves = [];
              
              while ((match = moveRegex.exec(game.pgn)) !== null) {
                if (match[1]) moves.push(match[1]);
                if (match[2]) moves.push(match[2]);
              }
              
              console.log("Extracted moves:", moves);
              
              
              chessInstance.reset();
              for (const move of moves) {
                try {
                  const result = chessInstance.move(move);
                  if (!result) {
                    console.error(`Failed to apply move: ${move}`);
                  }
                } catch (moveError) {
                  console.error(`Error applying move ${move}:`, moveError);
                }
              }
              
              console.log("Manual PGN parsing complete");
            } catch (fallbackError) {
              console.error("Manual PGN parsing also failed:", fallbackError);
              chessInstance.reset();
            }
          }
        } else if (game.fen) {
          console.log("Loading FEN:", game.fen);
          chessInstance.load(game.fen);
        }
        
        setChess(chessInstance);


        
        
        
        const history = chessInstance.history({ verbose: true });
        console.log("Full move history:", history);
        
        
        const knightMoves = history.filter(m => m.piece?.toLowerCase() === 'n');
        console.log("Knight moves in the game:", knightMoves);
        
        
        const knightDestinations: Record<string, Move> = {}; 
        for (let i = 0; i < knightMoves.length; i++) {
          const move = knightMoves[i];
          if (knightDestinations[move.to as string]) {
            console.warn(`POTENTIAL ISSUE: Knight moves to ${move.to} multiple times:`, 
              knightDestinations[move.to], "and now", move);
          }
          knightDestinations[move.to] = move;
        }
        
        setMoveHistory(history);
        
        const evals = generateMoveEvaluations(chessInstance);
        setMoveEvaluations(evals);
        
        const qualities = calculateMoveQualities(evals, chessInstance, game);
        setMoveQuality(qualities.moveQuality);
        setAccuracies(qualities.accuracies);
        setMoveByMoveRatings(qualities.moveByMoveRatings);
        
        setCurrentMoveIndex(-1);
        setLoading(false);
      } catch (error) {
        console.error("Error loading chess game:", error);
        setLoading(false);
        toast.error("Error loading chess game");
      }
    }
  }, [game, isOpen, generateMoveEvaluations]);



  const calculateMoveQualities = (evaluations: number[], chessInstance: Chess, game: GameData) => {
    const history = chessInstance.history({ verbose: true });
    const moveQuality = {
      white: {
        brilliant: 0,
        great: 0,
        best: 0,
        excellent: 0,
        good: 0,
        inaccuracy: 0,
        mistake: 0,
        blunder: 0,
        book: 0
      },
      black: {
        brilliant: 0,
        great: 0,
        best: 0,
        excellent: 0,
        good: 0,
        inaccuracy: 0,
        mistake: 0,
        blunder: 0,
        book: 0
      }
    };
    
    let whiteAccuracySum = 0;
    let whiteMoveCount = 0;
    let blackAccuracySum = 0;
    let blackMoveCount = 0;
    
    const moveRatingImpacts = {
      white: [] as number[],
      black: [] as number[]
    };

    const moveByMoveRatings = {
      white: [] as number[],
      black: [] as number[]
    };
    
    const tempChess = new Chess();
    
    
    const whiteBaseRating = game?.white?.rating || 1500;
    const blackBaseRating = game?.black?.rating || 1500;
    
    let currentWhiteRating = whiteBaseRating;
    let currentBlackRating = blackBaseRating;
    
    
    const allMoveAnalyses: MoveAnalysis[] = []; 
    
    for (let i = 0; i < history.length; i++) {
      const color = i % 2 === 0 ? 'white' : 'black';
      const move = history[i];
      const prevEval = evaluations[i];
      const currentEval = evaluations[i + 1];
      
      
      let evalChange;
      
      if (color === 'white') {
        evalChange = currentEval - prevEval;
      } else {
        evalChange = prevEval - currentEval;
      }
      
      let moveAccuracy;
      let ratingMultiplier;
      
      
      if (evalChange >= MOVE_CLASSIFICATIONS.BRILLIANT.threshold) {
        moveQuality[color].brilliant++;
        moveAccuracy = 100;
        ratingMultiplier = MOVE_CLASSIFICATIONS.BRILLIANT.multiplier;
      } else if (evalChange >= MOVE_CLASSIFICATIONS.GREAT.threshold) {
        moveQuality[color].great++;
        moveAccuracy = 96;
        ratingMultiplier = MOVE_CLASSIFICATIONS.GREAT.multiplier;
      } else if (evalChange >= MOVE_CLASSIFICATIONS.BEST.threshold) {
        moveQuality[color].best++;
        moveAccuracy = 90;
        ratingMultiplier = MOVE_CLASSIFICATIONS.BEST.multiplier;
      } else if (evalChange >= MOVE_CLASSIFICATIONS.EXCELLENT.threshold) {
        moveQuality[color].excellent++;
        moveAccuracy = 85;
        ratingMultiplier = MOVE_CLASSIFICATIONS.EXCELLENT.multiplier;
      } else if (evalChange >= MOVE_CLASSIFICATIONS.GOOD.threshold) {
        moveQuality[color].good++;
        moveAccuracy = 75;
        ratingMultiplier = MOVE_CLASSIFICATIONS.GOOD.multiplier;
      } else if (evalChange >= MOVE_CLASSIFICATIONS.INACCURACY.threshold) {
        moveQuality[color].inaccuracy++;
        moveAccuracy = 60;
        ratingMultiplier = MOVE_CLASSIFICATIONS.INACCURACY.multiplier;
      } else if (evalChange >= MOVE_CLASSIFICATIONS.MISTAKE.threshold) {
        moveQuality[color].mistake++;
        moveAccuracy = 40;
        ratingMultiplier = MOVE_CLASSIFICATIONS.MISTAKE.multiplier;
      } else {
        moveQuality[color].blunder++;
        moveAccuracy = 20;
        ratingMultiplier = MOVE_CLASSIFICATIONS.BLUNDER.multiplier;
      }
      
      
      const baseRating = color === 'white' ? whiteBaseRating : blackBaseRating;
      
      
      const ratingChange = (baseRating * ratingMultiplier - baseRating) * 0.7;
      
      if (color === 'white') {
        
        whiteAccuracySum += moveAccuracy;
        whiteMoveCount++;
        
        
        moveRatingImpacts.white.push(ratingMultiplier);
        
        
        currentWhiteRating = currentWhiteRating * 0.7 + (baseRating + ratingChange) * 0.3;
        
        
        moveByMoveRatings.white.push(Math.round(currentWhiteRating) || baseRating);
      } else {
        blackAccuracySum += moveAccuracy;
        blackMoveCount++;
        moveRatingImpacts.black.push(ratingMultiplier);
        
        currentBlackRating = currentBlackRating * 0.7 + (baseRating + ratingChange) * 0.3;
        moveByMoveRatings.black.push(Math.round(currentBlackRating) || baseRating);
      }
      
      tempChess.move({ from: move.from, to: move.to, promotion: move.promotion });
      
      
      const qualityLabel = evalChange >= MOVE_CLASSIFICATIONS.BRILLIANT.threshold ? "Brilliant" :
                         evalChange >= MOVE_CLASSIFICATIONS.GREAT.threshold ? "Great" :
                         evalChange >= MOVE_CLASSIFICATIONS.BEST.threshold ? "Best" :
                         evalChange >= MOVE_CLASSIFICATIONS.EXCELLENT.threshold ? "Excellent" :
                         evalChange >= MOVE_CLASSIFICATIONS.GOOD.threshold ? "Good" :
                         evalChange >= MOVE_CLASSIFICATIONS.INACCURACY.threshold ? "Inaccuracy" :
                         evalChange >= MOVE_CLASSIFICATIONS.MISTAKE.threshold ? "Mistake" : "Blunder";
      
      
      const moveNumber = Math.floor(i / 2) + 1;
      const moveText = `${moveNumber}${i % 2 === 0 ? "." : "..."}${move.san}`;
      
      allMoveAnalyses[i] = { 
        moveNumber,
        moveText,
        move: move.san,
        playerColor: color,
        prevEval,
        evaluation: currentEval,
        evalDifference: evalChange,
        quality: qualityLabel,
        estimatedRating: color === 'white' ? 
                        moveByMoveRatings.white[moveByMoveRatings.white.length - 1] : 
                        moveByMoveRatings.black[moveByMoveRatings.black.length - 1]
      };
    }
    
    
    setMoveAnalysis(allMoveAnalyses);
    
    
    const whiteAccuracy = whiteMoveCount > 0 ? whiteAccuracySum / whiteMoveCount / 100 : 0;
    const blackAccuracy = blackMoveCount > 0 ? blackAccuracySum / blackMoveCount / 100 : 0;
    
    return {
      moveQuality,
      accuracies: {
        white: whiteAccuracy,
        black: blackAccuracy
      },
      moveByMoveRatings
    };
  };

  const findKing = (chess: Chess, color: 'w' | 'b'): Square => { 
    const board = chess.board();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && piece.type === 'k' && piece.color === color) {
          const squareNotation = (String.fromCharCode(97 + j) + (8 - i)) as Square; 
          return squareNotation;
        }
      }
    }
    
    return 'e1'; 
  };

  const countPieces = (chess: Chess) => {
    const pieces = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
    };
    
    const board = chess.board();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece) {
          pieces[piece.color][piece.type]++;
        }
      }
    }
    
    return pieces;
  };

  const updateCapturedPieces = useCallback((fen: string) => {
    try {
      const whiteCaptured: string[] = [];
      const blackCaptured: string[] = [];

      
      const currentPieces = getFenPieces(fen);
      const startingPieces = {
        p: 8, n: 2, b: 2, r: 2, q: 1, k: 1,
        P: 8, N: 2, B: 2, R: 2, Q: 1, K: 1
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
        black: blackCaptured,
      });
    } catch (error) {
      console.error("Error updating captured pieces:", error);
    }
  }, []);

  
  const [isNavigating, setIsNavigating] = useState(false);
  
  const [lastActionTimestamp, setLastActionTimestamp] = useState(0);

  const goToMove = useCallback((moveIndex: number) => {
    
    if (currentMoveIndex === moveIndex || isNavigating) {
      return;
    }
    
    if (!chess) return;
    
    
    setIsNavigating(true);
    
    
    console.log(`Navigating to move ${moveIndex}`);
    
    try {
      
      const newChess = new Chess();
      
      if (moveIndex >= 0 && moveIndex < moveHistory.length) {
        
        for (let i = 0; i <= moveIndex; i++) {
          const move = moveHistory[i];
          const result = newChess.move({ 
            from: move.from, 
            to: move.to, 
            promotion: move.promotion 
          });
          
          if (!result) {
            console.error(`Failed to apply move ${i}: ${move.san}`);
            throw new Error(`Invalid move: ${move.san}`);
          }
        }
      }
      
      
      setChess(newChess);
      setCurrentMoveIndex(moveIndex);
      
      
      if (moveIndex >= -1 && moveIndex < moveEvaluations.length) {
        setEvaluation(moveEvaluations[moveIndex + 1]);
      }
      
      
      updateCapturedPieces(newChess.fen());
    } catch (error) {
      console.error("Error navigating to move:", error);
      toast.error("Error navigating to this position");
    } finally {
      
      setIsNavigating(false);
    }
  }, [chess, moveHistory, moveEvaluations, currentMoveIndex, isNavigating, updateCapturedPieces]);



  
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

  
  const getPieceSymbol = (piece: string): string => {
    const symbols: Record<string, string> = {
      p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
      P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
    };
    return symbols[piece] || piece;
  };

  
  const handleNextMove = useCallback(() => {
    
    const now = Date.now();
    if (now - lastActionTimestamp < 200) {
      console.log("Throttling navigation - too soon after last action");
      return;
    }
    
    if (!chess || !moveHistory.length || currentMoveIndex >= moveHistory.length - 1 || isNavigating) {
      if (isPlayingThrough) {
        setIsPlayingThrough(false);
      }
      return;
    }

    
    setLastActionTimestamp(now);
    
    
    console.log(`Moving forward from ${currentMoveIndex} to ${currentMoveIndex + 1}`);
    
    const nextMoveIndex = currentMoveIndex + 1;
    
    if (isPlayingThrough) {
      setTimeout(() => {
        if (nextMoveIndex < moveHistory.length) {
          
          setIsNavigating(true);
          
          try {
            
            const newChess = new Chess();
            
            
            for (let i = 0; i <= nextMoveIndex; i++) {
              const move = moveHistory[i];
              newChess.move({ 
                from: move.from, 
                to: move.to, 
                promotion: move.promotion 
              });
            }
            
            
            setChess(newChess);
            setCurrentMoveIndex(nextMoveIndex);
            
            
            if (nextMoveIndex >= -1 && nextMoveIndex < moveEvaluations.length) {
              setEvaluation(moveEvaluations[nextMoveIndex + 1]);
            }
            
            
            updateCapturedPieces(newChess.fen());
            
            
            if (nextMoveIndex < moveHistory.length - 1) {
              setTimeout(() => {
                handleNextMove();
              }, playbackSpeed);
            } else {
              setIsPlayingThrough(false);
            }
          } catch (error) {
            console.error("Error during autoplay:", error);
            setIsPlayingThrough(false);
          } finally {
            setIsNavigating(false);
          }
        } else {
          setIsPlayingThrough(false);
        }
      }, 50); 
    } else {
      
      goToMove(nextMoveIndex);
    }
  }, [chess, moveHistory, currentMoveIndex, isPlayingThrough, moveEvaluations, playbackSpeed, isNavigating, lastActionTimestamp, goToMove, updateCapturedPieces]);
  
  
  const handlePrevMove = useCallback(() => {
    
    const now = Date.now();
    if (now - lastActionTimestamp < 200) {
      return;
    }
    
    if (!chess || currentMoveIndex <= -1 || isNavigating) return;
    
    
    setLastActionTimestamp(now);
    
    
    console.log(`Moving backward from ${currentMoveIndex} to ${currentMoveIndex - 1} ===`);
    
    goToMove(currentMoveIndex - 1);
  }, [chess, currentMoveIndex, goToMove, isNavigating, lastActionTimestamp]);

  
  const handleFirstMove = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimestamp < 200 || !chess || isNavigating) return;
    
    setLastActionTimestamp(now);
    goToMove(-1);
  }, [chess, goToMove, isNavigating, lastActionTimestamp]);

  
  const handleLastMove = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimestamp < 200 || !chess || !moveHistory.length || isNavigating) return;
    
    setLastActionTimestamp(now);
    goToMove(moveHistory.length - 1);
  }, [chess, moveHistory, goToMove, isNavigating, lastActionTimestamp]);

  
  const handlePlayThrough = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimestamp < 200 || isNavigating) return;
    
    setLastActionTimestamp(now);
    setIsPlayingThrough(true);
    handleNextMove();
  }, [handleNextMove, isNavigating, lastActionTimestamp]);

  
  const handleStopPlayThrough = useCallback(() => {
    setIsPlayingThrough(false);
  }, []);
  
  
  useEffect(() => {
    
    
    if (chess && currentMoveIndex >= 0 && false) { 
      
      const fen = chess?.fen(); 
      console.debug(`Current position at move ${currentMoveIndex}: ${fen}`);
    }
  }, [chess, currentMoveIndex]);

  
  const downloadPGN = () => {
    if (!game?.pgn) {
      toast.error("No PGN available to download");
      return;
    }

    try {
      
      let enhancedPGN = game.pgn;

      
      moveAnalysis.forEach((analysis) => {
        if (!analysis) return;

        const moveComment = `{${analysis.quality} (${analysis.evaluation > 0 ? "+" : ""}${analysis.evaluation.toFixed(2)}).}`;

        
        const movePattern = new RegExp(`(${analysis.moveText.replace(".", "\\.").replace("+", "\\+")})\\s`, "g");
        enhancedPGN = enhancedPGN.replace(movePattern, `$1 ${moveComment} `);
      });

      
      const whiteAccuracy = accuracies.white ? Math.round(accuracies.white * 100) : 0;
      const blackAccuracy = accuracies.black ? Math.round(accuracies.black * 100) : 0;

      enhancedPGN = enhancedPGN.replace(
        "[Event ",
        `[WhiteAccuracy "${whiteAccuracy}%"]\n[BlackAccuracy "${blackAccuracy}%"]\n[AnalysisEngine "ChessAI v1.0"]\n[AnalysisDate "${new Date().toISOString()}"]\n[Event `
      );

      
      const blob = new Blob([enhancedPGN], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analysis_${game.white.username}_vs_${game.black.username}.pgn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Analysis PGN downloaded successfully");
    } catch (err) {
      console.error("Error downloading PGN:", err);
      toast.error("Error creating download");
    }
  };

  
  const getCurrentMoveEstimatedRating = (color: 'white' | 'black') => {
    const ratings = color === 'white' ? moveByMoveRatings.white : moveByMoveRatings.black;
    
    
    if (currentMoveIndex === -1) {
      return color === 'white' ? game.white?.rating || 0 : game.black?.rating || 0;
    }
    
    
    let colorMoveIndex = Math.floor(currentMoveIndex / 2);
    
    
    if (color === 'black' && currentMoveIndex % 2 === 0) {
      colorMoveIndex--;
    }
    
    
    if (color === 'white' && currentMoveIndex % 2 === 1) {
      
    }
    
    if (colorMoveIndex < 0 || colorMoveIndex >= ratings.length) {
      return color === 'white' ? game.white?.rating || 0 : game.black?.rating || 0;
    }
    
    return ratings[colorMoveIndex] || 0;  
  };

  const whiteCurrentRating = getCurrentMoveEstimatedRating('white');
  const blackCurrentRating = getCurrentMoveEstimatedRating('black');

  
  const getMoveQualityClass = (quality: string): string => {
    switch (quality) {
      case "Brilliant": return "text-purple-400";
      case "Great": return "text-indigo-400";
      case "Best": return "text-green-400";
      case "Good": case "Excellent": return "text-blue-400";
      case "Book": return "text-blue-400";
      case "Inaccuracy": return "text-yellow-400";
      case "Mistake": return "text-orange-400";
      case "Blunder": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  const isWhite = game?.white?.username.toLowerCase() === username.toLowerCase();
  const boardOrientation = isWhite ? 'white' : 'black';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading game analysis...</span>
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

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">
                  {game.white.username} vs {game.black.username}
                  {game.timeControl && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {game.timeControl}
                    </Badge>
                  )}
                </CardTitle>
                {game.resultText && (
                  <div className={`text-lg font-bold ${game.resultClass}`}>
                    {game.resultText}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-stretch">
                <ChessEvaluationBar evaluation={evaluation} />
                <div className="flex-1">
                  <Chessboard 
                    position={chess.fen()} 
                    boardOrientation={boardOrientation}
                    arePiecesDraggable={false}
                  />
                </div>
              </div>
              
              <div className="mt-4 border-t pt-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFirstMove}
                      disabled={currentMoveIndex === -1}
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevMove}
                      disabled={currentMoveIndex === -1}
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    
                    {isPlayingThrough ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStopPlayThrough}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePlayThrough}
                        disabled={currentMoveIndex === moveHistory.length - 1}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextMove}
                      disabled={currentMoveIndex === moveHistory.length - 1}
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLastMove}
                      disabled={currentMoveIndex === moveHistory.length - 1}
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadPGN}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Analysis
                  </Button>
                </div>
                
                <div className="mt-2">
                  <div className="text-sm text-gray-500">
                    Move {currentMoveIndex + 1} of {moveHistory.length}
                  </div>
                  <Progress
                    value={(currentMoveIndex + 1) / Math.max(1, moveHistory.length) * 100}
                    className="h-1 mt-1"
                  />
                </div>
                
                <div className="mt-4 flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-white w-3 h-3 rounded-full"></div>
                    <span>{game.white.username}</span>
                    <span className="text-sm text-gray-500">
                      {accuracies.white > 0 ? `${Math.round(accuracies.white * 100)}%` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {accuracies.black > 0 ? `${Math.round(accuracies.black * 100)}%` : ""}
                    </span>
                    <span>{game.black.username}</span>
                    <div className="bg-black w-3 h-3 rounded-full"></div>
                  </div>
                </div>
                
                <div className="mt-2 flex justify-between">
                  <div className="flex gap-1">
                    {capturedPieces.black.map((piece, i) => (
                      <span key={i} className="text-lg">
                        {piece}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {capturedPieces.white.map((piece, i) => (
                      <span key={i} className="text-lg">
                        {piece}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2 flex flex-col gap-4">
          <ChessPlayerStats 
            whiteUsername={game.white.username} 
            blackUsername={game.black.username}
            whiteRating={game.white.rating}
            blackRating={game.black.rating}
            whiteAccuracy={accuracies.white}
            blackAccuracy={accuracies.black}
            moveQuality={moveQuality}
            estimatedPerformance={{
              white: whiteCurrentRating || 0,  
              black: blackCurrentRating || 0   
            }}
            currentMoveIndex={currentMoveIndex}
          />
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Move List</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ChessMoveList 
                moves={moveHistory} 
                currentMoveIndex={currentMoveIndex} 
                onSelectMove={goToMove}
                isNavigating={isNavigating}
              />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="mt-6">
        <Tabs defaultValue="analysis">
          <TabsList>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          
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
                        <th className="text-left p-2">Player</th>
                        <th className="text-left p-2">Eval</th>
                        <th className="text-left p-2">Diff</th>
                        <th className="text-left p-2">Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moveAnalysis.map((analysis: MoveAnalysis | null, index) => analysis && ( 
                        <tr 
                          key={index} 
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => goToMove(index)}
                        >
                          <td className="p-2">{analysis.moveNumber}</td>
                          <td className="p-2 font-medium">{analysis.moveText}</td>
                          <td className="p-2">{analysis.playerColor === 'white' ? 'White' : 'Black'}</td>
                          <td className="p-2 font-mono">
                            {analysis.evaluation > 0 ? '+' : ''}
                            {analysis.evaluation.toFixed(2)}
                          </td>
                          <td className={`p-2 font-mono ${
                            analysis.evalDifference > 0.2 ? 'text-red-500' : 
                            analysis.evalDifference < -0.2 ? 'text-green-500' : ''
                          }`}>
                            {analysis.evalDifference > 0 ? '+' : ''}
                            {analysis.evalDifference.toFixed(2)}
                          </td>
                          <td className={`p-2 ${getMoveQualityClass(analysis.quality)}`}>
                            {analysis.quality}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="insights">
            <Card>
              <CardHeader>
                <CardTitle>Game Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-bold mb-2">Critical Moments</h3>
                    {moveAnalysis.filter((m): m is MoveAnalysis => !!m && (m.quality === 'Blunder' || m.quality === 'Brilliant')).length > 0 ? ( 
                      <div className="space-y-2">
                        {moveAnalysis
                          .filter((m): m is MoveAnalysis => !!m && (m.quality === 'Blunder' || m.quality === 'Brilliant')) 
                          .slice(0, 3)
                          .map((analysis, i) => (
                            <div 
                              key={i} 
                              className="p-2 border rounded hover:bg-gray-50 cursor-pointer"
                              onClick={() => goToMove(moveAnalysis.findIndex(ma => ma === analysis))} 
                            >
                              <div className="flex justify-between">
                                <span>{analysis.moveText}</span>
                                <span className={getMoveQualityClass(analysis.quality)}>
                                  {analysis.quality}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                Eval change: {analysis.evalDifference > 0 ? '+' : ''}
                                {analysis.evalDifference.toFixed(2)}
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    ) : (
                      <p className="text-gray-500">No critical moments identified yet.</p>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-bold mb-2">Move Quality Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Best Moves:</span>
                        <span className="font-medium text-green-500">
                          {
                            moveAnalysis.filter((m): m is MoveAnalysis => 
                              !!m && (m.quality === 'Best' || 
                              m.quality === 'Brilliant' || 
                              m.quality === 'Great')
                            ).length
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Good Moves:</span>
                        <span className="font-medium text-blue-500">
                          {
                            moveAnalysis.filter((m): m is MoveAnalysis => 
                              !!m && (m.quality === 'Good' || 
                              m.quality === 'Excellent')
                            ).length
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Inaccuracies/Mistakes:</span>
                        <span className="font-medium text-yellow-500">
                          {
                            moveAnalysis.filter((m): m is MoveAnalysis => 
                              !!m && (m.quality === 'Inaccuracy' || 
                              m.quality === 'Mistake')
                            ).length
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Blunders:</span>
                        <span className="font-medium text-red-500">
                          {moveAnalysis.filter((m): m is MoveAnalysis => !!m && m.quality === 'Blunder').length} 
                        </span>
                      </div>
                    </div>
                  </div>
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