import React from 'react';
import { Button } from "@/components/ui/button";
import { Move } from 'chess.js'; // Import Move type

interface ChessMoveListProps {
  moves: Move[]; // Use Move[] type
  currentMoveIndex: number;
  onSelectMove: (moveIndex: number) => void;
  isNavigating?: boolean;
}

const ChessMoveList: React.FC<ChessMoveListProps> = ({ 
  moves, 
  currentMoveIndex, 
  onSelectMove,
  isNavigating = false
}) => {
  const renderMoves = () => {
    const elements = [];
    
    // Start with the initial position button
    elements.push(
      <Button
        key="initial"
        variant={currentMoveIndex === -1 ? "default" : "outline"}
        size="sm"
        onClick={() => !isNavigating && onSelectMove(-1)}
        className="m-1 text-xs"
        disabled={isNavigating}
      >
        Start
      </Button>
    );

    // Add all moves in pairs (white and black)
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = moves[i];
      const blackMove = moves[i + 1];
      
      elements.push(
        <div key={`move-${moveNumber}`} className="flex items-center">
          <div className="w-8 text-gray-500 text-xs">{moveNumber}.</div>
          
          <Button
            variant={currentMoveIndex === i ? "default" : "outline"}
            size="sm"
            onClick={() => !isNavigating && onSelectMove(i)}
            className="m-1 text-xs flex-1"
            disabled={isNavigating}
          >
            {whiteMove.san}
          </Button>
          
          {blackMove && (
            <Button
              variant={currentMoveIndex === i + 1 ? "default" : "outline"}
              size="sm"
              onClick={() => !isNavigating && onSelectMove(i + 1)}
              className="m-1 text-xs flex-1"
              disabled={isNavigating}
            >
              {blackMove.san}
            </Button>
          )}
        </div>
      );
    }
    
    return elements;
  };

  return (
    <div className="overflow-y-auto max-h-[300px] p-2">
      <div className="space-y-1">
        {renderMoves()}
      </div>
    </div>
  );
};

export default ChessMoveList;