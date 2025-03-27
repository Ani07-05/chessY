/**
 * Chess Accuracy Calculator implementing CAPS2-like algorithm
 * Provides more intuitive scoring in the 50-95 range similar to Chess.com
 */

export interface MoveQualityCounts {
    brilliant: number;
    great: number;
    best: number;
    good: number;
    book: number;
    inaccuracy: number;
    mistake: number;
    miss: number;
    blunder: number;
  }
  
  /**
   * CAPS2-like accuracy calculation that produces scores mostly in the 50-95 range
   * @param evaluations - Array of position evaluations 
   * @param playerColor - Color of the player ('white' or 'black')
   * @returns Accuracy score (0-100)
   */
  export function calculateAccuracy(evaluations: number[], playerColor: string): number {
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
  }
  
  /**
   * Classifies move quality using Chess.com/Lichess-like categories
   * @param prevEval - Previous position evaluation
   * @param currEval - Current position evaluation
   * @param playerColor - Color of the player ('white' or 'black')
   * @param moveIndex - Index of the current move
   * @param bestMoveSan - Best move according to engine (SAN)
   * @param actualMoveSan - Actual move played (SAN)
   * @param positionComplexity - Complexity of the position (0-1)
   * @returns Move quality classification
   */
  export function classifyMoveQuality(
    prevEval: number,
    currEval: number,
    playerColor: string,
    moveIndex: number,
    bestMoveSan?: string,
    actualMoveSan?: string,
    positionComplexity: number = 0.5
  ): string {
    // Calculate the eval difference from the player's perspective
    const evalDifference = playerColor === 'white' 
      ? prevEval - currEval
      : currEval - prevEval;
    
    // Determine if this is the engine's top choice
    const isBestMove = bestMoveSan && actualMoveSan && bestMoveSan === actualMoveSan;
    
    // Is this in the opening phase?
    const isOpening = moveIndex <= 20;
    
    // Check for dramatic evaluation shifts
    const dramaticShift = Math.abs(prevEval - currEval) > 2.0;
    
    // Did the player sacrifice material but gain positional advantage?
    const isSacrifice = evalDifference < -0.3 && currEval > prevEval + 0.5;
    
    // Classification logic based on realistic chess evaluation thresholds
    if (isBestMove) {
      // Brilliant move - a sacrifice that leads to advantage
      if (isSacrifice) {
        return "Brilliant";
      }
      
      // Great move - improvement that dramatically alters evaluation
      if (dramaticShift && prevEval < 0 && currEval > 0) {
        return "Great";
      }
      
      // Best move - the engine's top choice
      return "Best";
    }
    
    // Book move - standard opening theory
    if (isOpening && moveIndex <= 10 && evalDifference <= 0.2) {
      return "Book";
    }
    
    // For non-best moves, classify based on evaluation loss using realistic thresholds
    if (evalDifference <= 0.3) {
      return "Good";
    } else if (evalDifference <= 1.0) {
      return "Inaccuracy";
    } else if (evalDifference <= 2.0) {
      return "Mistake";
    } else {
      return "Blunder";
    }
  }
  
  /**
   * Estimates player rating based on move quality
   * @param moveQualities - Array of move quality classifications
   * @returns Estimated rating (Elo)
   */
  export function estimatePlayerRating(moveQualities: string[]): number {
    if (moveQualities.length === 0) return 800;
    
    // Count occurrences of each move quality
    const counts: Record<string, number> = {
      "Brilliant": 0,
      "Great": 0,
      "Best": 0,
      "Good": 0,
      "Book": 0,
      "Inaccuracy": 0,
      "Mistake": 0,
      "Miss": 0,
      "Blunder": 0
    };
    
    moveQualities.forEach(quality => {
      if (counts.hasOwnProperty(quality)) {
        counts[quality]++;
      }
    });
    
    // Calculate accuracy metrics
    const totalMoves = moveQualities.length || 1;
    const goodMoves = counts["Best"] + counts["Good"] + counts["Great"] + counts["Brilliant"];
    const badMoves = counts["Inaccuracy"] + counts["Mistake"] + counts["Blunder"];
    
    // Calculate accuracy percentage (similar to chess.com's accuracy)
    const accuracyPercentage = (goodMoves / totalMoves) * 100 - (badMoves / totalMoves) * 35;
    
    // Map accuracy to rating using chess.com-like formula
    // Based on general observation that:
    // ~35-50% accuracy = ~800-1000 rating
    // ~60-70% accuracy = ~1200-1500 rating
    // ~75-85% accuracy = ~1600-1900 rating
    // ~90%+ accuracy = ~2000+ rating
    
    let estimatedRating;
    
    if (accuracyPercentage < 40) {
      estimatedRating = 800 + (accuracyPercentage - 25) * 10;
    } else if (accuracyPercentage < 60) {
      estimatedRating = 950 + (accuracyPercentage - 40) * 15;
    } else if (accuracyPercentage < 75) {
      estimatedRating = 1250 + (accuracyPercentage - 60) * 20;
    } else if (accuracyPercentage < 85) {
      estimatedRating = 1550 + (accuracyPercentage - 75) * 30;
    } else if (accuracyPercentage < 95) {
      estimatedRating = 1850 + (accuracyPercentage - 85) * 25;
    } else {
      estimatedRating = 2100 + (accuracyPercentage - 95) * 30;
    }
    
    // Brilliant moves are relatively rare even at high levels
    // Limit their impact to prevent unrealistic ratings
    const brilliantBonus = Math.min(counts["Brilliant"] * 25, 100);
    estimatedRating += brilliantBonus;
    
    // Even GMs make blunders occasionally
    // Each blunder should have significant impact
    const blunderPenalty = Math.min(counts["Blunder"] * 50, 400);
    estimatedRating -= blunderPenalty;
    
    // Clamp to reasonable values
    estimatedRating = Math.max(600, Math.min(2400, estimatedRating));
    
    // Round to nearest 25
    return Math.round(estimatedRating / 25) * 25;
  }
  
  /**
   * Detects the phase of the game based on piece count
   * @param fen - FEN string representation of the position
   * @returns Game phase ('opening', 'middlegame', or 'endgame')
   */
  export function detectGamePhase(fen: string): 'opening' | 'middlegame' | 'endgame' {
    // Extract position from FEN
    const position = fen.split(' ')[0];
    
    // Count pieces
    const pieceCounts = {
      majorPieces: 0, // Queens and rooks
      minorPieces: 0, // Knights and bishops
      pawns: 0,
      total: 0
    };
    
    for (const char of position) {
      if (char === 'Q' || char === 'q' || char === 'R' || char === 'r') {
        pieceCounts.majorPieces++;
        pieceCounts.total++;
      } else if (char === 'B' || char === 'b' || char === 'N' || char === 'n') {
        pieceCounts.minorPieces++;
        pieceCounts.total++;
      } else if (char === 'P' || char === 'p') {
        pieceCounts.pawns++;
        pieceCounts.total++;
      } else if (char === 'K' || char === 'k') {
        pieceCounts.total++;
      }
    }
    
    // Heuristics for game phases
    if (pieceCounts.total >= 28) {
      return 'opening';
    } else if (pieceCounts.total <= 12 || (pieceCounts.majorPieces <= 2 && pieceCounts.minorPieces <= 2)) {
      return 'endgame';
    } else {
      return 'middlegame';
    }
  }
  
  /**
   * Gets total counts for each move quality category
   * @param moveAnalyses - Array of move analyses containing quality assessments
   * @param playerColor - Optional filter by player color
   * @returns Object with counts for each move quality
   */
  export function getMoveQualityCounts(moveAnalyses: any[], playerColor?: string): MoveQualityCounts {
    const counts: MoveQualityCounts = {
      brilliant: 0,
      great: 0,
      best: 0,
      good: 0,
      book: 0,
      inaccuracy: 0,
      mistake: 0,
      miss: 0,
      blunder: 0
    };
    
    // Filter by player color if specified
    const filteredMoves = playerColor 
      ? moveAnalyses.filter(m => m?.playerColor === playerColor)
      : moveAnalyses;
    
    // Count each move quality
    filteredMoves.forEach(move => {
      if (!move || !move.quality) return;
      
      const quality = move.quality.toLowerCase();
      if (quality.includes("brilliant")) counts.brilliant++;
      else if (quality.includes("great")) counts.great++;
      else if (quality.includes("best")) counts.best++;
      else if (quality.includes("good")) counts.good++;
      else if (quality.includes("book")) counts.book++;
      else if (quality.includes("inaccuracy")) counts.inaccuracy++;
      else if (quality.includes("mistake")) counts.mistake++;
      else if (quality.includes("miss")) counts.miss++;
      else if (quality.includes("blunder")) counts.blunder++;
    });
    
    return counts;
  }