// components/ChessPlayerStats.tsx (or relevant path)
import React from 'react';
import { Star, Award, TrendingUp, Circle, Sparkles, Check, Square, AlertCircle, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

// Define structure for move quality counts
// Exporting allows GameReview to use the same type definition potentially
export interface MoveQualityCounts {
  brilliant: number;
  great: number;
  best: number;
  excellent: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
  book: number;
  // Add total if GameReview's derive function includes it and you want to use it here
  total?: number; // Make total optional or ensure deriveMoveQualityCounts always returns it
}

interface ChessPlayerStatsProps {
  whiteUsername: string;
  blackUsername: string;
  whiteRating?: number;
  blackRating?: number;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  moveQuality?: { // Prop is optional
    white: MoveQualityCounts;
    black: MoveQualityCounts;
  };
  estimatedPerformance?: {
    white: number;
    black: number;
  };
}

const ChessPlayerStats: React.FC<ChessPlayerStatsProps> = ({
  whiteUsername,
  blackUsername,
  whiteRating,
  blackRating,
  whiteAccuracy,
  blackAccuracy,
  moveQuality, // Can be undefined
  estimatedPerformance,
}) => {

  // Function to render move quality bars
  const renderMoveQualityBars = (color: 'white' | 'black') => {
    // Handles case where moveQuality or specific color data is missing
    if (!moveQuality?.[color]) return null;

    const quality = moveQuality[color];
    // Use optional chaining and nullish coalescing for safety
    const totalMoves = quality.total ?? Object.values(quality).reduce((a, b) => a + b, 0);

    // Return early if no moves to analyze
    if (!totalMoves || totalMoves <= 0) {
        return <div className="text-xs text-gray-500 mt-2">No moves to analyze for quality breakdown.</div>;
    }

    // Helper for rendering individual bar
    const renderBar = (label: string, value: number, Icon: React.ElementType, colorClass: string, bgColor: string, strokeColor?: string) => {
        if (value <= 0) return null;
        const percentage = (value / totalMoves) * 100;
        const iconProps = {
            className: `h-3 w-3 mr-1 ${strokeColor ? `stroke-${strokeColor}` : ''} ${!strokeColor ? `fill-${colorClass} stroke-${colorClass}` : 'fill-transparent'}`, // Dynamic fill/stroke
        };
        return (
            <div className="flex items-center text-xs">
                <div className={`w-20 ${colorClass} flex items-center shrink-0`}>
                    <Icon {...iconProps} /> {label}
                </div>
                <div className="flex-1 mx-1">
                    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full ${bgColor}`} style={{ width: `${percentage}%` }} />
                    </div>
                </div>
                <div className="w-8 text-right shrink-0">{value}</div>
            </div>
        );
    };


    return (
      <div className="mt-2 space-y-1">
        <div className="text-xs text-gray-400 mb-1">Move Quality</div>
        {renderBar("Brilliant", quality.brilliant, Sparkles, "text-purple-400", "bg-purple-500")}
        {renderBar("Great", quality.great, Star, "text-indigo-400", "bg-indigo-500")}
        {renderBar("Best", quality.best, Star, "text-green-400", "bg-green-500")}
        {renderBar("Excellent", quality.excellent, Circle, "text-blue-400", "bg-blue-500")}
        {renderBar("Good", quality.good, Check, "text-sky-400", "bg-sky-500", "sky-400")}
        {renderBar("Book", quality.book, Square, "text-gray-400", "bg-gray-500", "gray-400")}
        {renderBar("Inaccuracy", quality.inaccuracy, AlertCircle, "text-yellow-400", "bg-yellow-500", "yellow-400")}
        {renderBar("Mistake", quality.mistake, XCircle, "text-orange-400", "bg-orange-500", "orange-400")}
        {renderBar("Blunder", quality.blunder, XCircle, "text-red-400", "bg-red-500", "red-400")}
      </div>
    );
  };

  // Function to calculate performance change
  const getPerformanceChange = (baseRating: number | undefined, estimatedRating: number | undefined) => {
    if (baseRating === undefined || estimatedRating === undefined) return { isHigher: false, difference: 0, sign: '' };
    const difference = Math.round(estimatedRating - baseRating);
    return { isHigher: difference >= 0, difference: Math.abs(difference), sign: difference >= 0 ? '+' : '-' };
  };

  const whitePerformanceChange = getPerformanceChange(whiteRating, estimatedPerformance?.white);
  const blackPerformanceChange = getPerformanceChange(blackRating, estimatedPerformance?.black);

  return (
    <div className="bg-card border rounded-md p-3 text-sm text-card-foreground"> {/* Use theme variables */}
      <h3 className="text-muted-foreground uppercase text-xs font-medium mb-2 flex items-center">
        <Award className="h-4 w-4 mr-1" /> Game Stats
      </h3>

      {/* White player stats */}
      <div className="mb-3 pb-3 border-b"> {/* Use theme border */}
        <div className="flex justify-between items-center mb-1">
          <div className="font-medium flex items-center truncate"> {/* Added truncate */}
            <div className="w-3 h-3 bg-gray-200 rounded-full mr-2 border border-gray-400 shrink-0"></div>
            {whiteUsername}
          </div>
          {whiteRating !== undefined && <div className="text-muted-foreground">{whiteRating}</div>}
        </div>
        {whiteAccuracy !== undefined && whiteAccuracy > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1"><span>Accuracy</span><span className="text-emerald-500 font-medium">{whiteAccuracy.toFixed(1)}%</span></div>
            {/* Remove indicatorClassName */}
            <Progress value={whiteAccuracy} className="h-1 bg-emerald-500" /> {/* Use theme progress, apply color directly if needed */}
          </div>
        )}
        {estimatedPerformance?.white !== undefined && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-2 flex items-center text-xs cursor-default">
                  <TrendingUp className={`h-3 w-3 mr-1 ${whitePerformanceChange.isHigher ? 'text-green-500' : 'text-red-500'}`} />
                  <span className={whitePerformanceChange.isHigher ? 'text-green-500' : 'text-red-500'}>
                    Est. Perf: {Math.round(estimatedPerformance.white)}
                    {whitePerformanceChange.difference > 0 && whiteRating !== undefined && (<span className="ml-1">({whitePerformanceChange.sign}{whitePerformanceChange.difference})</span>)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Estimated rating based on game performance.</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {renderMoveQualityBars('white')}
      </div>

      {/* Black player stats */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <div className="font-medium flex items-center truncate"> {/* Added truncate */}
            <div className="w-3 h-3 bg-gray-800 border border-gray-700 rounded-full mr-2 shrink-0"></div>
            {blackUsername}
          </div>
          {blackRating !== undefined && <div className="text-muted-foreground">{blackRating}</div>}
        </div>
        {blackAccuracy !== undefined && blackAccuracy > 0 &&(
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1"><span>Accuracy</span><span className="text-emerald-500 font-medium">{blackAccuracy.toFixed(1)}%</span></div>
            {/* Remove indicatorClassName */}
            <Progress value={blackAccuracy} className="h-1 bg-emerald-500" /> {/* Use theme progress, apply color directly if needed */}
          </div>
        )}
        {estimatedPerformance?.black !== undefined && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                 <div className="mt-2 flex items-center text-xs cursor-default">
                   <TrendingUp className={`h-3 w-3 mr-1 ${blackPerformanceChange.isHigher ? 'text-green-500' : 'text-red-500'}`} />
                   <span className={blackPerformanceChange.isHigher ? 'text-green-500' : 'text-red-500'}>
                     Est. Perf: {Math.round(estimatedPerformance.black)}
                     {blackPerformanceChange.difference > 0 && blackRating !== undefined && (<span className="ml-1">({blackPerformanceChange.sign}{blackPerformanceChange.difference})</span>)}
                   </span>
                 </div>
              </TooltipTrigger>
              <TooltipContent><p>Estimated rating based on game performance.</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {renderMoveQualityBars('black')}
      </div>
    </div>
  );
};

export default ChessPlayerStats;