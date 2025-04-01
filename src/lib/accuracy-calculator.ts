// /**
//  * Chess Accuracy Calculator implementing CAPS2-like algorithm
//  * Provides more intuitive scoring in the 50-95 range similar to Chess.com
//  */

// export interface MoveQualityCounts {
//     brilliant: number;
//     great: number;
//     best: number;
//     good: number;
//     book: number;
//     inaccuracy: number;
//     mistake: number;
//     miss: number;
//     blunder: number;
//   }

// export interface MoveRatingInfo {
//   moveElo: number;
//   qualityDisplay: string;
//   ratingDiff: number;
//   explanation: string;
// }

// /**
//  * CAPS2-like accuracy calculation that produces scores mostly in the 50-95 range
//  * @param evaluations - Array of position evaluations 
//  * @param playerColor - Color of the player ('white' or 'black')
//  * @returns Accuracy score (0-100)
//  */
// export function calculateAccuracy(evaluations: number[], playerColor: string): number {
//   if (evaluations.length < 2) return 70; // Default baseline for minimal data
  
//   let totalLoss = 0;
//   let maxPossibleLoss = 0;
  
//   for (let i = 0; i < evaluations.length - 1; i++) {
//     // Calculate loss based on evaluation difference
//     const prevEval = evaluations[i];
//     const currEval = evaluations[i+1];
    
//     // Calculate the eval difference from the player's perspective
//     const evalDiff = playerColor === 'white' 
//       ? prevEval - currEval
//       : currEval - prevEval;
      
//     // Only count losing moves as penalties
//     const loss = Math.max(0, evalDiff);
    
//     // Convert loss to a normalized penalty using sigmoid function
//     // This makes small mistakes less costly and big blunders have diminishing returns
//     const normalizedLoss = 2 / (1 + Math.exp(-loss * 0.5));
    
//     totalLoss += normalizedLoss;
//     maxPossibleLoss += 2; // Maximum possible loss for perfect comparison
//   }
  
//   // Convert to a 0-100 scale with appropriate scaling to match CAPS2 range
//   const perfectionRatio = 1 - (totalLoss / maxPossibleLoss);
  
//   // Scale to desired range (50-95) for typical scores
//   // Uses an exponential curve to reward excellence but be forgiving of mistakes
//   const scaledAccuracy = 50 + (Math.pow(perfectionRatio, 0.8) * 45);
  
//   // Round to one decimal place
//   return Math.round(scaledAccuracy * 10) / 10;
// }

// /**
//  * Classifies move quality using Chess.com/Lichess-like categories
//  * @param prevEval - Previous position evaluation
//  * @param currEval - Current position evaluation
//  * @param playerColor - Color of the player ('white' or 'black')
//  * @param moveIndex - Index of the current move
//  * @param bestMoveSan - Best move according to engine (SAN)
//  * @param actualMoveSan - Actual move played (SAN)
//  * @param positionComplexity - Complexity of the position (0-1) - Higher values indicate more complex positions
//  * @returns Move quality classification
//  */
// export function classifyMoveQuality(
//   prevEval: number,
//   currEval: number,
//   playerColor: string,
//   moveIndex: number,
//   bestMoveSan?: string,
//   actualMoveSan?: string,
//   positionComplexity: number = 0.5
// ): string {
//   // Calculate the eval difference from the player's perspective
//   const evalDifference = playerColor === 'white' 
//     ? prevEval - currEval
//     : currEval - prevEval;
  
//   // Determine if this is the engine's top choice
//   const isBestMove = bestMoveSan && actualMoveSan && bestMoveSan === actualMoveSan;
  
//   // Is this in the opening phase?
//   const isOpening = moveIndex <= 20;
  
//   // Check for dramatic evaluation shifts
//   const dramaticShift = Math.abs(prevEval - currEval) > 2.0;
  
//   // Did the player sacrifice material but gain positional advantage?
//   const isSacrifice = evalDifference < -0.3 && currEval > prevEval + 0.5;
  
//   // Classification logic based on realistic chess evaluation thresholds
//   if (isBestMove) {
//     // Brilliant move - a sacrifice that leads to advantage
//     if (isSacrifice) {
//       return "Brilliant";
//     }
    
//     // Great move - improvement that dramatically alters evaluation
//     if (dramaticShift && prevEval < 0 && currEval > 0) {
//       return "Great";
//     }
    
//     // Best move - the engine's top choice
//     return "Best";
//   }
  
//   // Book move - standard opening theory
//   if (isOpening && moveIndex <= 10 && evalDifference <= 0.2) {
//     return "Book";
//   }
  
//   // For non-best moves, classify based on evaluation loss using realistic thresholds
//   if (evalDifference <= 0.3) {
//     return "Good";
//   } else if (evalDifference <= 1.0) {
//     return "Inaccuracy";
//   } else if (evalDifference <= 2.0) {
//     return "Mistake";
//   } else {
//     return "Blunder";
//   }
// }

// /**
//  * Calculate what rating level a move represents
//  * @param moveQuality - Quality classification of the move
//  * @param evalDifference - Evaluation difference to best move
//  * @param playerRating - Player's actual rating
//  * @param moveNumber - Number of the current move
//  * @param phase - Game phase (opening, middlegame, endgame)
//  * @returns Rating level this move represents
//  */
// export function calculateMoveRating(
//   moveQuality: string,
//   evalDifference: number,
//   playerRating: number = 1200,
//   moveNumber: number = 1,
//   phase: 'opening' | 'middlegame' | 'endgame' = 'middlegame'
// ): MoveRatingInfo {
//   // Base ratings by move quality - calibrated to match chess.com
//   const ratingsByQuality: Record<string, number> = {
//     "Brilliant": 2500,  // Chess.com rarely gives brilliant
//     "Great": 2300,      // Strong move that's hard to find
//     "Best": 2100,       // Top engine choice
//     "Good": 1800,       // Solid move but not best
//     "Book": 1600,       // Standard opening theory
//     "Inaccuracy": 1000, // Minor mistake
//     "Mistake": 700,     // Significant mistake
//     "Blunder": 400      // Major blunder
//   };
  
//   // Start with base rating for this move quality
//   let baseRating = ratingsByQuality[moveQuality] || 1200;
  
//   // Adjust based on phase - opening mistakes are penalized more strongly
//   // since good players know opening theory better
//   if (phase === 'opening' && moveNumber <= 15) {
//     if (moveQuality === "Inaccuracy") baseRating -= 100;
//     if (moveQuality === "Mistake") baseRating -= 150;
//     if (moveQuality === "Blunder") baseRating -= 200;
//   }
  
//   // Endgame precision is critical at high levels
//   if (phase === 'endgame') {
//     if (moveQuality === "Best" || moveQuality === "Great" || moveQuality === "Brilliant") {
//       baseRating += 100; // Good endgame play indicates higher skill
//     }
//   }
  
//   // Adjust based on evaluation difference magnitude - larger eval swings
//   // indicate more serious mistakes or stronger moves
//   if (moveQuality === "Inaccuracy") {
//     // Scale inaccuracy ratings from 1200 down to 800 based on eval difference
//     baseRating = 1200 - Math.min(evalDifference * 300, 400);
//   } else if (moveQuality === "Mistake") {
//     // Scale mistake ratings from 800 down to 500 based on eval difference
//     baseRating = 800 - Math.min(evalDifference * 150, 300);
//   } else if (moveQuality === "Blunder") {
//     // Scale blunder ratings from 500 down to 200 based on eval difference
//     const severityFactor = Math.min(evalDifference, 5) / 5; // 0-1 scale of blunder severity
//     baseRating = 500 - Math.round(300 * severityFactor);
    
//     // Flag truly terrible blunders (mate in 1 missed, etc.)
//     if (evalDifference > 7) {
//       baseRating = 200;
//     }
//   } else if (moveQuality === "Great" || moveQuality === "Brilliant") {
//     // Great and brilliant moves in sharp positions are rated higher
//     baseRating += Math.min(evalDifference * 50, 150);
//   }
  
//   // Calculate difference from player's rating
//   const ratingDiff = baseRating - playerRating;

//   // Create explanatory text based on chess.com style
//   let explanation = '';
//   const relativeRating = ratingDiff > 0 ? "above" : "below";
//   const ratingGap = Math.abs(ratingDiff);
  
//   if (moveQuality === "Brilliant") {
//     explanation = `Exceptional move! This is typical of ${Math.round(baseRating/100)*100}+ rated players.`;
//   } else if (moveQuality === "Great") {
//     explanation = `Very strong move, typical of players rated ${Math.round(baseRating/100)*100}.`;
//   } else if (moveQuality === "Best") {
//     explanation = `Perfect move - the engine's top choice.`;
//   } else if (moveQuality === "Good") {
//     explanation = `Solid move, typical of a ${Math.round(baseRating/100)*100} rated player.`;
//   } else if (moveQuality === "Book") {
//     explanation = `Standard opening theory, played at all rating levels.`;
//   } else if (moveQuality === "Inaccuracy") {
//     if (ratingDiff < -200) {
//       explanation = `This inaccuracy is ${ratingGap} points ${relativeRating} your rating level of ${playerRating}.`;
//     } else {
//       explanation = `Minor inaccuracy, typical at your rating level.`;
//     }
//   } else if (moveQuality === "Mistake") {
//     explanation = `This mistake is typical of a ${Math.round(baseRating/100)*100} rated player (${ratingGap} points ${relativeRating} your rating).`;
//   } else if (moveQuality === "Blunder") {
//     if (baseRating < 400) {
//       explanation = `Severe blunder - this move loses significant material or position.`;
//     } else {
//       explanation = `This blunder is typical of players rated ${Math.round(baseRating/100)*100}, which is ${ratingGap} points ${relativeRating} your rating of ${playerRating}.`;
//     }
//   }
  
//   // Create a qualitative display similar to chess.com
//   let qualityDisplay = '';
  
//   if (moveQuality === "Brilliant") qualityDisplay = "Brilliant Move";
//   else if (moveQuality === "Great") qualityDisplay = "Great Find";
//   else if (moveQuality === "Best") qualityDisplay = "Best Move";
//   else if (moveQuality === "Good") qualityDisplay = "Good Move";
//   else if (moveQuality === "Book") qualityDisplay = "Book Move";
//   else if (moveQuality === "Inaccuracy") qualityDisplay = "Inaccuracy";
//   else if (moveQuality === "Mistake") qualityDisplay = "Mistake";
//   else if (moveQuality === "Blunder") qualityDisplay = "Blunder";
  
//   return {
//     moveElo: baseRating,
//     qualityDisplay,
//     ratingDiff,
//     explanation
//   };
// }

// /**
//  * Estimates player rating based on move quality
//  * @param moveQualities - Array of move quality classifications
//  * @returns Estimated rating (Elo)
//  */
// export function estimatePlayerRating(moveQualities: string[]): number {
//   if (moveQualities.length === 0) return 800;
  
//   // Count occurrences of each move quality
//   const counts: Record<string, number> = {
//     "Brilliant": 0,
//     "Great": 0,
//     "Best": 0,
//     "Good": 0,
//     "Book": 0,
//     "Inaccuracy": 0,
//     "Mistake": 0,
//     "Miss": 0,
//     "Blunder": 0
//   };
  
//   moveQualities.forEach(quality => {
//     if (counts.hasOwnProperty(quality)) {
//       counts[quality]++;
//     }
//   });
  
//   // Calculate accuracy metrics
//   const totalMoves = moveQualities.length || 1;
//   const goodMoves = counts["Best"] + counts["Good"] + counts["Great"] + counts["Brilliant"];
//   const badMoves = counts["Inaccuracy"] + counts["Mistake"] + counts["Blunder"];
  
//   // Calculate accuracy percentage (similar to chess.com's accuracy)
//   const accuracyPercentage = (goodMoves / totalMoves) * 100 - (badMoves / totalMoves) * 35;
  
//   // Map accuracy to rating using chess.com-like formula
//   // Based on general observation that:
//   // ~35-50% accuracy = ~800-1000 rating
//   // ~60-70% accuracy = ~1200-1500 rating
//   // ~75-85% accuracy = ~1600-1900 rating
//   // ~90%+ accuracy = ~2000+ rating
  
//   let estimatedRating;
  
//   if (accuracyPercentage < 40) {
//     estimatedRating = 800 + (accuracyPercentage - 25) * 10;
//   } else if (accuracyPercentage < 60) {
//     estimatedRating = 950 + (accuracyPercentage - 40) * 15;
//   } else if (accuracyPercentage < 75) {
//     estimatedRating = 1250 + (accuracyPercentage - 60) * 20;
//   } else if (accuracyPercentage < 85) {
//     estimatedRating = 1550 + (accuracyPercentage - 75) * 30;
//   } else if (accuracyPercentage < 95) {
//     estimatedRating = 1850 + (accuracyPercentage - 85) * 25;
//   } else {
//     estimatedRating = 2100 + (accuracyPercentage - 95) * 30;
//   }
  
//   // Brilliant moves are relatively rare even at high levels
//   // Limit their impact to prevent unrealistic ratings
//   const brilliantBonus = Math.min(counts["Brilliant"] * 25, 100);
//   estimatedRating += brilliantBonus;
  
//   // Even GMs make blunders occasionally
//   // Each blunder should have significant impact
//   const blunderPenalty = Math.min(counts["Blunder"] * 50, 400);
//   estimatedRating -= blunderPenalty;
  
//   // Clamp to reasonable values
//   estimatedRating = Math.max(600, Math.min(2400, estimatedRating));
  
//   // Round to nearest 25
//   return Math.round(estimatedRating / 25) * 25;
// }

// /**
//  * Generates a cumulative game report summarizing player performance
//  * @param moveQualities - Array of move quality classifications
//  * @param playerRating - Player's rating
//  * @param moveRatings - Array of move rating information
//  * @returns Formatted game report
//  */
// export function generateGameReport(
//   moveQualities: string[],
//   playerRating: number,
//   moveRatings: MoveRatingInfo[]
// ): string {
//   if (moveQualities.length === 0) return "Insufficient data for analysis.";
  
//   // Count occurrences of each move quality
//   const counts: Record<string, number> = {
//     "Brilliant": 0,
//     "Great": 0,
//     "Best": 0,
//     "Good": 0,
//     "Book": 0,
//     "Inaccuracy": 0,
//     "Mistake": 0,
//     "Blunder": 0
//   };
  
//   moveQualities.forEach(quality => {
//     if (counts.hasOwnProperty(quality)) {
//       counts[quality]++;
//     }
//   });
  
//   // Count moves by rating difference
//   const ratingPerformance = {
//     excellent: 0, // >200 above player rating
//     good: 0,      // 0-200 above player rating
//     average: 0,   // ±100 of player rating
//     below: 0,     // 100-300 below player rating
//     poor: 0       // >300 below player rating
//   };
  
//   moveRatings.forEach(rating => {
//     if (rating.ratingDiff > 200) ratingPerformance.excellent++;
//     else if (rating.ratingDiff > 0) ratingPerformance.good++;
//     else if (rating.ratingDiff > -100) ratingPerformance.average++;
//     else if (rating.ratingDiff > -300) ratingPerformance.below++;
//     else ratingPerformance.poor++;
//   });
  
//   // Calculate average move rating
//   const averageMoveRating = moveRatings.reduce((sum, rating) => sum + rating.moveElo, 0) / moveRatings.length;
  
//   // Identify consistent problems
//   const problemAreas: string[] = [];
//   if (counts["Blunder"] > 1) {
//     problemAreas.push("Critical tactical oversights");
//   }
//   if (counts["Mistake"] > 2) {
//     problemAreas.push("Positional mistakes");
//   }
//   if (counts["Inaccuracy"] > 3) {
//     problemAreas.push("Minor inaccuracies");
//   }
  
//   // Generate report
//   let report = "## Game Analysis Summary\n\n";
  
//   // Overall performance assessment
//   report += "### Overall Performance\n";
//   if (averageMoveRating > playerRating + 200) {
//     report += `You played exceptionally well, performing like a ${Math.round(averageMoveRating / 100) * 100} rated player!\n`;
//   } else if (averageMoveRating > playerRating + 50) {
//     report += `You played above your rating level, showing improvement to the ${Math.round(averageMoveRating / 100) * 100} range.\n`;
//   } else if (averageMoveRating > playerRating - 50) {
//     report += `You played consistently at your current rating level of ${playerRating}.\n`;
//   } else if (averageMoveRating > playerRating - 200) {
//     report += `You played somewhat below your rating level in this game.\n`;
//   } else {
//     report += `You played significantly below your usual rating level in this game.\n`;
//   }
  
//   // Move quality breakdown
//   report += "\n### Move Quality Breakdown\n";
//   report += `- Brilliant moves: ${counts["Brilliant"]}\n`;
//   report += `- Great moves: ${counts["Great"]}\n`;
//   report += `- Best moves: ${counts["Best"]}\n`;
//   report += `- Good moves: ${counts["Good"]}\n`;
//   report += `- Book moves: ${counts["Book"]}\n`;
//   report += `- Inaccuracies: ${counts["Inaccuracy"]}\n`;
//   report += `- Mistakes: ${counts["Mistake"]}\n`;
//   report += `- Blunders: ${counts["Blunder"]}\n`;
  
//   // Rating performance
//   report += "\n### Rating Performance\n";
//   report += `- Excellent moves (${ratingPerformance.excellent}): Played like a ${playerRating + 300}+ rated player\n`;
//   report += `- Good moves (${ratingPerformance.good}): Played like a ${playerRating + 100}-${playerRating + 200} rated player\n`;
//   report += `- Average moves (${ratingPerformance.average}): Played at your rating level\n`;
//   report += `- Below average (${ratingPerformance.below}): Played like a ${playerRating - 200}-${playerRating - 100} rated player\n`;
//   report += `- Poor moves (${ratingPerformance.poor}): Played like a ${playerRating - 400}-${playerRating - 300} rated player\n`;
  
//   // Areas for improvement
//   if (problemAreas.length > 0) {
//     report += "\n### Areas for Improvement\n";
//     problemAreas.forEach(area => {
//       report += `- ${area}\n`;
//     });
//   }
  
//   return report;
// }