// components/ChessMoveList.tsx (or relevant path)
import React from 'react';
import { Button } from "@/components/ui/button";
import { Move } from 'chess.js';
// Import the MoveAnalysis type from where it's defined (e.g., GameReview.tsx or a shared types file)
import { MoveAnalysis } from '../components/game-review'; // Adjust path as needed

interface ChessMoveListProps {
  moves: Move[];
  currentMoveIndex: number;
  onSelectMove: (moveIndex: number) => void;
  isNavigating?: boolean;
  // Add the moveAnalysis prop (optional)
  moveAnalysis?: (MoveAnalysis | null)[];
}

// Duplicated function (or import from utils) - needed for styling moves
const getMoveQualityClass = (quality: string | undefined): string => {
    if (!quality) return "";
    switch (quality) {
      case "Brilliant": return "text-purple-500 font-bold"; // Example: Add bold for emphasis
      case "Great": return "text-indigo-500 font-semibold";
      case "Best": return "text-green-500";
      case "Excellent": return "text-blue-500";
      case "Good": return "text-sky-500";
      case "Book": return "text-gray-500 italic"; // Example: Add italic for book moves
      case "Inaccuracy": return "text-yellow-500";
      case "Mistake": return "text-orange-500 font-semibold";
      case "Blunder": return "text-red-500 font-bold";
      default: return "text-foreground"; // Use default text color
    }
};

const ChessMoveList: React.FC<ChessMoveListProps> = ({
  moves,
  currentMoveIndex,
  onSelectMove,
  isNavigating = false,
  moveAnalysis // Destructure the new prop
}) => {

  const renderMoves = () => {
    const elements = [];

    // Start button
    elements.push(
      <Button
        key="initial"
        variant={currentMoveIndex === -1 ? "secondary" : "ghost"} // Use theme variants
        size="sm"
        onClick={() => !isNavigating && onSelectMove(-1)}
        className="m-1 text-xs h-7 px-2 w-full justify-start" // Adjusted styling
        disabled={isNavigating}
      >
        Start Position
      </Button>
    );

    // Moves pairs
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = moves[i];
      const blackMove = moves[i + 1];

      // Get quality for styling (optional chaining for safety)
      const whiteQuality = moveAnalysis?.[i]?.quality;
      const blackQuality = blackMove ? moveAnalysis?.[i + 1]?.quality : undefined;

      const whiteQualityClass = getMoveQualityClass(whiteQuality);
      const blackQualityClass = getMoveQualityClass(blackQuality);

      elements.push(
        <div key={`move-${moveNumber}`} className="flex items-center gap-1">
          <div className="w-6 text-right text-muted-foreground text-xs shrink-0">{moveNumber}.</div>

          {/* White Move Button */}
          <Button
            variant={currentMoveIndex === i ? "secondary" : "ghost"}
            size="sm"
            onClick={() => !isNavigating && onSelectMove(i)}
            className={`m-0.5 text-xs flex-1 h-7 px-2 justify-start truncate ${whiteQualityClass}`} // Apply quality class
            disabled={isNavigating}
            title={whiteMove.san + (whiteQuality ? ` (${whiteQuality})` : '')} // Add tooltip
          >
            {whiteMove.san}
          </Button>

          {/* Black Move Button */}
          {blackMove ? (
            <Button
              variant={currentMoveIndex === i + 1 ? "secondary" : "ghost"}
              size="sm"
              onClick={() => !isNavigating && onSelectMove(i + 1)}
              className={`m-0.5 text-xs flex-1 h-7 px-2 justify-start truncate ${blackQualityClass}`} // Apply quality class
              disabled={isNavigating}
               title={blackMove.san + (blackQuality ? ` (${blackQuality})` : '')} // Add tooltip
            >
              {blackMove.san}
            </Button>
          ) : (
              <div className="flex-1 m-0.5 h-7"></div> // Placeholder for alignment if no black move
          )}
        </div>
      );
    }

    return elements;
  };

  return (
    // Use theme background, adjust max-height as needed
    <div className="overflow-y-auto max-h-[calc(100vh-var(--header-height,250px))] p-1 bg-muted/20 rounded">
      <div className="space-y-0.5">
        {renderMoves()}
      </div>
    </div>
  );
};

export default ChessMoveList;