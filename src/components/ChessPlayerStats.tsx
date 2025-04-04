import { Star, Award, TrendingUp, Circle, Sparkles, Check, Square, AlertCircle, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface ChessPlayerStatsProps {
  whiteUsername: string;
  blackUsername: string;
  whiteRating?: number;
  blackRating?: number;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  moveQuality?: {
    white: {
      brilliant: number;
      great: number;
      best: number;
      excellent: number;
      good: number;
      inaccuracy: number;
      mistake: number;
      blunder: number;
      book: number;
    };
    black: {
      brilliant: number;
      great: number;
      best: number;
      excellent: number;
      good: number;
      inaccuracy: number;
      mistake: number;
      blunder: number;
      book: number;
    };
  };
  estimatedPerformance?: {
    white: number;
    black: number;
  };
  currentMoveIndex?: number;
}

const ChessPlayerStats: React.FC<ChessPlayerStatsProps> = ({
  whiteUsername,
  blackUsername,
  whiteRating,
  blackRating,
  whiteAccuracy,
  blackAccuracy,
  moveQuality,
  estimatedPerformance,
  currentMoveIndex = -1
}) => {
  const renderMoveQualityBars = (color: 'white' | 'black') => {
    if (!moveQuality) return null;
    
    const quality = moveQuality[color];
    const totalMoves = Object.values(quality).reduce((a, b) => a + b, 0) || 1;
    
    return (
      <div className="mt-2 space-y-1">
        <div className="text-xs text-gray-400 mb-1">Move Quality</div>
        
        {/* Brilliant moves */}
        {quality.brilliant > 0 && (
          <div className="flex items-center text-xs">
            <div className="w-20 text-purple-400 flex items-center">
              <Sparkles className="h-3 w-3 mr-1 fill-purple-400 stroke-purple-400" /> Brilliant
            </div>
            <div className="flex-1">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500" 
                  style={{width: `${(quality.brilliant / totalMoves) * 100}%`}}
                />
              </div>
            </div>
            <div className="w-8 text-right">{quality.brilliant}</div>
          </div>
        )}
        
        {/* Great moves */}
        {quality.great > 0 && (
          <div className="flex items-center text-xs">
            <div className="w-20 text-blue-400 flex items-center">
              <Star className="h-3 w-3 mr-1 fill-blue-400 stroke-blue-400" /> Great
            </div>
            <div className="flex-1">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500" 
                  style={{width: `${(quality.great / totalMoves) * 100}%`}}
                />
              </div>
            </div>
            <div className="w-8 text-right">{quality.great}</div>
          </div>
        )}

        {/* Best moves */}
        {quality.best > 0 && (
          <div className="flex items-center text-xs">
            <div className="w-20 text-lime-400 flex items-center">
              <Star className="h-3 w-3 mr-1 fill-lime-400 stroke-lime-400" /> Best
            </div>
            <div className="flex-1">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-lime-500" 
                  style={{width: `${(quality.best / totalMoves) * 100}%`}}
                />
              </div>
            </div>
            <div className="w-8 text-right">{quality.best}</div>
          </div>
        )}
        
        {/* Excellent moves */}
        {quality.excellent > 0 && (
          <div className="flex items-center text-xs">
            <div className="w-20 text-green-400 flex items-center">
              <Circle className="h-3 w-3 mr-1 fill-green-400 stroke-green-400" /> Excellent
            </div>
            <div className="flex-1">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500" 
                  style={{width: `${(quality.excellent / totalMoves) * 100}%`}}
                />
              </div>
            </div>
            <div className="w-8 text-right">{quality.excellent}</div>
          </div>
        )}
        
        {/* Good moves */}
        {quality.good > 0 && (
          <div className="flex items-center text-xs">
            <div className="w-20 text-emerald-400 flex items-center">
              <Check className="h-3 w-3 mr-1 stroke-emerald-400" /> Good
            </div>
            <div className="flex-1">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500" 
                  style={{width: `${(quality.good / totalMoves) * 100}%`}}
                />
              </div>
            </div>
            <div className="w-8 text-right">{quality.good}</div>
          </div>
        )}
        
        {/* Book moves */}
        {quality.book > 0 && (
          <div className="flex items-center text-xs">
            <div className="w-20 text-blue-400 flex items-center">
              <Square className="h-3 w-3 mr-1 fill-transparent stroke-blue-400" /> Book
            </div>
            <div className="flex-1">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500" 
                  style={{width: `${(quality.book / totalMoves) * 100}%`}}
                />
              </div>
            </div>
            <div className="w-8 text-right">{quality.book}</div>
          </div>
        )}
        
        {/* Inaccuracies */}
        {quality.inaccuracy > 0 && (
          <div className="flex items-center text-xs">
            <div className="w-20 text-yellow-400 flex items-center">
              <AlertCircle className="h-3 w-3 mr-1 fill-transparent stroke-yellow-400" /> Inaccuracy
            </div>
            <div className="flex-1">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500" 
                  style={{width: `${(quality.inaccuracy / totalMoves) * 100}%`}}
                />
              </div>
            </div>
            <div className="w-8 text-right">{quality.inaccuracy}</div>
          </div>
        )}
        
        {/* Mistakes */}
        {quality.mistake > 0 && (
          <div className="flex items-center text-xs">
            <div className="w-20 text-orange-400 flex items-center">
              <XCircle className="h-3 w-3 mr-1 fill-transparent stroke-orange-400" /> Mistake
            </div>
            <div className="flex-1">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500" 
                  style={{width: `${(quality.mistake / totalMoves) * 100}%`}}
                />
              </div>
            </div>
            <div className="w-8 text-right">{quality.mistake}</div>
          </div>
        )}
        
        {/* Blunders */}
        {quality.blunder > 0 && (
          <div className="flex items-center text-xs">
            <div className="w-20 text-red-400 flex items-center">
              <XCircle className="h-3 w-3 mr-1 fill-red-400 stroke-red-400" /> Blunder
            </div>
            <div className="flex-1">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500" 
                  style={{width: `${(quality.blunder / totalMoves) * 100}%`}}
                />
              </div>
            </div>
            <div className="w-8 text-right">{quality.blunder}</div>
          </div>
        )}
      </div>
    );
  };

  // Function to determine if the performance is better or worse than base rating
  const getPerformanceChange = (baseRating: number | undefined, currentRating: number) => {
    if (!baseRating) return { isHigher: false, difference: 0 };
    
    const difference = currentRating - baseRating;
    return { 
      isHigher: difference > 0,
      difference: Math.abs(difference)
    };
  };

  const whitePerformanceChange = getPerformanceChange(whiteRating, estimatedPerformance?.white || 0);
  const blackPerformanceChange = getPerformanceChange(blackRating, estimatedPerformance?.black || 0);
  
  return (
    <div className="bg-gray-900 rounded-md p-3 text-sm">
      <h3 className="text-gray-400 uppercase text-xs font-medium mb-2 flex items-center">
        <Award className="h-4 w-4 mr-1" /> Game Stats 
        {currentMoveIndex > -1 && <span className="ml-auto text-blue-400">Move {currentMoveIndex + 1}</span>}
      </h3>
      
      {/* White player stats */}
      <div className="mb-3 pb-3 border-b border-gray-800">
        <div className="flex justify-between items-center mb-1">
          <div className="font-medium flex items-center">
            <div className="w-3 h-3 bg-gray-200 rounded-full mr-2" />
            {whiteUsername}
          </div>
          {whiteRating && <div className="text-gray-400">{whiteRating}</div>}
        </div>
        
        {whiteAccuracy !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span>Accuracy</span>
              <span className="text-emerald-400">{Math.round(whiteAccuracy * 100)}%</span>
            </div>
            <Progress value={whiteAccuracy * 100} className="h-1" />
          </div>
        )}
        
        {renderMoveQualityBars('white')}
        
        {estimatedPerformance?.white && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-2 flex items-center text-xs">
                  <TrendingUp className={`h-3 w-3 mr-1 ${whitePerformanceChange.isHigher ? 'text-green-400' : 'text-red-400'}`} />
                  <span className={whitePerformanceChange.isHigher ? 'text-green-400' : 'text-red-400'}>
                    Est. Performance: {estimatedPerformance.white}
                    {whitePerformanceChange.difference > 0 && (
                      <span> ({whitePerformanceChange.isHigher ? '+' : '-'}{whitePerformanceChange.difference})</span>
                    )}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Estimated rating performance based on move quality at current position</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {/* Black player stats */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <div className="font-medium flex items-center">
            <div className="w-3 h-3 bg-gray-800 border border-gray-700 rounded-full mr-2" />
            {blackUsername}
          </div>
          {blackRating && <div className="text-gray-400">{blackRating}</div>}
        </div>
        
        {blackAccuracy !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span>Accuracy</span>
              <span className="text-emerald-400">{Math.round(blackAccuracy * 100)}%</span>
            </div>
            <Progress value={blackAccuracy * 100} className="h-1" />
          </div>
        )}
        
        {renderMoveQualityBars('black')}
        
        {estimatedPerformance?.black && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-2 flex items-center text-xs">
                  <TrendingUp className={`h-3 w-3 mr-1 ${blackPerformanceChange.isHigher ? 'text-green-400' : 'text-red-400'}`} />
                  <span className={blackPerformanceChange.isHigher ? 'text-green-400' : 'text-red-400'}>
                    Est. Performance: {estimatedPerformance.black}
                    {blackPerformanceChange.difference > 0 && (
                      <span> ({blackPerformanceChange.isHigher ? '+' : '-'}{blackPerformanceChange.difference})</span>
                    )}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Estimated rating performance based on move quality at current position</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};

export default ChessPlayerStats;