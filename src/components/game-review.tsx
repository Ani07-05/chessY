"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExternalLink, Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { 
  calculateAccuracy, 
  classifyMoveQuality, 
  estimatePlayerRating, 
  detectGamePhase,
  getMoveQualityCounts,
  MoveQualityCounts
} from '@/lib/accuracy-calculator'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// Define icons and colors for different move qualities
const moveQualityStyles: Record<string, { icon: string, color: string, bgColor: string }> = {
  "Brilliant": { icon: "💎", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900" },
  "Great": { icon: "★", color: "text-indigo-500", bgColor: "bg-indigo-100 dark:bg-indigo-900" },
  "Best": { icon: "✓✓", color: "text-green-500", bgColor: "bg-green-100 dark:bg-green-900" },
  "Good": { icon: "✓", color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900" },
  "Book": { icon: "📖", color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900" },
  "Inaccuracy": { icon: "?", color: "text-yellow-500", bgColor: "bg-yellow-100 dark:bg-yellow-900" },
  "Mistake": { icon: "?!", color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900" },
  "Blunder": { icon: "??", color: "text-red-500", bgColor: "bg-red-100 dark:bg-red-900" }
};

interface GameData {
  date?: string;
  timeControl?: string;
  resultClass?: string;
  resultText?: string;
  white?: { username: string };
  black?: { username: string };
  url?: string;
}

export interface GameReviewProps {
  gameData: GameData;
  evaluation: any;
  moveHistory: string[];
  moveIndex: number;
  evalHistory: number[];
  moveAnalyses: any[];
  onFirstMove: () => void;
  onPrevMove: () => void;
  onNextMove: () => void;
  onLastMove: () => void;
  onPlayThrough: () => void;
  onStopPlayThrough: () => void;
  isPlaying: boolean;
  currentFen: string;
  engineDepth: number;
  onEngineDepthChange: (depth: number) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  capturedPieces: { white: string[], black: string[] };
}


interface GameReviewPanelProps {
    gameData: GameData;
    evaluation: any;
    moveHistory: string[];
    moveIndex: number;
    evalHistory: number[];
    moveAnalyses: any[];
    onFirstMove: () => void;
    onPrevMove: () => Promise<void>;
    onNextMove: () => void;
    onLastMove: () => void;
    onPlayThrough: () => void;
    onStopPlayThrough: () => void;
    isPlaying: boolean;
    currentFen: string;
    engineDepth: number;
    onEngineDepthChange: (depth: number) => void;
    playbackSpeed: number;
    onPlaybackSpeedChange: (speed: number) => void;
    capturedPieces: { white: string[]; black: string[] };
  }
  
  
  export function GameReviewPanel({
    gameData,
    evaluation,
    moveHistory,
    moveIndex,
    evalHistory,
    moveAnalyses,
    onFirstMove,
    onPrevMove,
    onNextMove,
    onLastMove,
    onPlayThrough,
    onStopPlayThrough,
    isPlaying,
    currentFen,
    engineDepth,
    onEngineDepthChange,
    playbackSpeed,
    onPlaybackSpeedChange,
    capturedPieces
  }: GameReviewPanelProps)

 {
  const [whiteAccuracy, setWhiteAccuracy] = useState<number>(0);
  const [blackAccuracy, setBlackAccuracy] = useState<number>(0);
  const [whiteRating, setWhiteRating] = useState<number>(0);
  const [blackRating, setBlackRating] = useState<number>(0);
  const [whiteMoveQualities, setWhiteMoveQualities] = useState<MoveQualityCounts>({
    brilliant: 0, great: 0, best: 0, good: 0, 
    book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0
  });
  const [blackMoveQualities, setBlackMoveQualities] = useState<MoveQualityCounts>({
    brilliant: 0, great: 0, best: 0, good: 0, 
    book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0
  });
  const [gamePhase, setGamePhase] = useState<'opening' | 'middlegame' | 'endgame'>('opening');
  const [openingQuality, setOpeningQuality] = useState<{ white: string, black: string }>({ white: 'Good', black: 'Good' });
  const [middlegameQuality, setMiddlegameQuality] = useState<{ white: string, black: string }>({ white: 'Good', black: 'Good' });
  const [endgameQuality, setEndgameQuality] = useState<{ white: string, black: string }>({ white: '-', black: '-' });
  const [evalChartData, setEvalChartData] = useState<any>(null);

  // Update evaluations and statistics when move analyses change
  useEffect(() => {
    if (moveAnalyses.length > 0) {
      const whiteEvals = evalHistory.filter((_, i) => i % 2 === 1);
      const blackEvals = evalHistory.filter((_, i) => i % 2 === 0 && i > 0);
      
      // Calculate accuracy using new algorithm
      setWhiteAccuracy(calculateAccuracy(whiteEvals, 'white'));
      setBlackAccuracy(calculateAccuracy(blackEvals, 'black'));
      
      // Get move quality counts
      setWhiteMoveQualities(getMoveQualityCounts(moveAnalyses, 'white'));
      setBlackMoveQualities(getMoveQualityCounts(moveAnalyses, 'black'));
      
      // Calculate estimated ratings based on move quality
      const whiteMoveQualityList = moveAnalyses
        .filter(m => m?.playerColor === 'white')
        .map(m => m?.quality || '');
      
      const blackMoveQualityList = moveAnalyses
        .filter(m => m?.playerColor === 'black')
        .map(m => m?.quality || '');
      
      setWhiteRating(estimatePlayerRating(whiteMoveQualityList));
      setBlackRating(estimatePlayerRating(blackMoveQualityList));
      
      // Evaluate phase quality
      evaluatePhaseQualities(moveAnalyses);
    }
  }, [moveAnalyses, evalHistory]);

  // Update evaluation chart
  useEffect(() => {
    if (evalHistory.length > 0) {
      updateEvaluationChart();
    }
  }, [evalHistory]);

  // Update game phase
  useEffect(() => {
    if (currentFen) {
      setGamePhase(detectGamePhase(currentFen));
    }
  }, [currentFen]);

  // Evaluate phase qualities
  const evaluatePhaseQualities = (analyses: any[]) => {
    if (analyses.length === 0) return;
    
    const openingMoves: Record<string, any[]> = { white: [], black: [] };
    const middlegameMoves: Record<string, any[]> = { white: [], black: [] };
    const endgameMoves: Record<string, any[]> = { white: [], black: [] };
    
    analyses.forEach(move => {
      if (!move) return;
      
      // Determine phase based on move number
      const phase = move.moveNumber <= 10 ? 'opening' 
                  : move.moveNumber <= 30 ? 'middlegame' 
                  : 'endgame';
      
      // Add to appropriate array
      if (phase === 'opening') {
        openingMoves[move.playerColor].push(move);
      } else if (phase === 'middlegame') {
        middlegameMoves[move.playerColor].push(move);
      } else {
        endgameMoves[move.playerColor].push(move);
      }
    });
    
    // Helper to determine phase quality
    const getPhaseQuality = (moves: any[]): string => {
      if (moves.length === 0) return '-';
      
      const qualities = moves.map(m => m.quality);
      const brilliantCount = qualities.filter(q => q === 'Brilliant').length;
      const greatCount = qualities.filter(q => q === 'Great').length;
      const bestCount = qualities.filter(q => q === 'Best').length;
      const inaccuracyCount = qualities.filter(q => q === 'Inaccuracy').length;
      const mistakeCount = qualities.filter(q => q === 'Mistake').length;
      const blunderCount = qualities.filter(q => q === 'Blunder').length;
      
      const goodRatio = (brilliantCount + greatCount + bestCount) / moves.length;
      const badRatio = (inaccuracyCount + mistakeCount + blunderCount) / moves.length;
      
      if (brilliantCount > 0 || goodRatio > 0.7) return 'Excellent';
      if (goodRatio > 0.5) return 'Good';
      if (badRatio > 0.3) return 'Inaccuracy';
      if (blunderCount > 0) return 'Mistake';
      return 'Average';
    };
    
    setOpeningQuality({
      white: getPhaseQuality(openingMoves.white),
      black: getPhaseQuality(openingMoves.black)
    });
    
    setMiddlegameQuality({
      white: getPhaseQuality(middlegameMoves.white),
      black: getPhaseQuality(middlegameMoves.black)
    });
    
    setEndgameQuality({
      white: getPhaseQuality(endgameMoves.white),
      black: getPhaseQuality(endgameMoves.black)
    });
  };

  // Update evaluation chart
  const updateEvaluationChart = () => {
    // Cap evaluations for better visualization
    const cappedEvals = evalHistory.map(value => Math.max(-5, Math.min(5, value)));
    
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
    
    setEvalChartData({ data, options });
  };

  // Helper to get evaluation description
  const getEvaluationDescription = (evaluation: number): string => {
    if (evaluation > 3) return "White is winning";
    if (evaluation > 1.5) return "White has the advantage";
    if (evaluation > 0.5) return "White is slightly better";
    if (evaluation >= -0.5) return "Equal position";
    if (evaluation >= -1.5) return "Black is slightly better";
    if (evaluation >= -3) return "Black has the advantage";
    return "Black is winning";
  };

  // Helper function to display move quality
  const getQualityDisplay = (quality: string) => {
    if (!quality) return null;
    
    const style = moveQualityStyles[quality] || moveQualityStyles["Good"];
    
    return (
      <div className={`inline-flex items-center gap-1 font-medium ${style.color}`}>
        <span>{style.icon}</span>
        <span>{quality}</span>
      </div>
    );
  };

  // Get current move quality
  const getCurrentMoveQuality = () => {
    if (moveIndex <= 0 || moveIndex > moveAnalyses.length) {
      return null;
    }
    
    const analysis = moveAnalyses[moveIndex - 1];
    if (!analysis) return null;
    
    return getQualityDisplay(analysis.quality);
  };

  // Get quality badge (uses different styling)
  const getQualityBadge = (quality: string) => {
    if (!quality || quality === '-') return null;
    
    // Map quality to variant
    const variant = quality === 'Excellent' || quality === 'Good' ? 'default' : 
                   quality === 'Average' ? 'secondary' :
                   'destructive';
    
    return <Badge variant={variant}>{quality}</Badge>;
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Game Info Card */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2">Game Info</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{gameData?.date || 'Unknown'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Time Control:</span>
                <span className="font-medium">{gameData?.timeControl || 'Standard'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Result:</span>
                <span className={`font-medium ${gameData?.resultClass || ''}`}>
                  {gameData?.resultText || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Moves:</span>
                <span className="font-medium">{moveHistory.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Move:</span>
                <span className="font-medium">{moveIndex} / {moveHistory.length}</span>
              </div>
            </div>
            
            <Separator className="my-3" />
            
            <div className="text-sm font-medium mb-2">Players</div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-white border border-gray-300 rounded-full"></div>
                  <span>{gameData?.white?.username || 'White'}</span>
                </div>
                <span className="font-medium">{whiteRating || '?'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-black rounded-full"></div>
                  <span>{gameData?.black?.username || 'Black'}</span>
                </div>
                <span className="font-medium">{blackRating || '?'}</span>
              </div>
            </div>
            
            <Separator className="my-3" />
            
            <div className="text-sm font-medium mb-2">Accuracy</div>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">White:</span>
                  <span className="font-medium">{whiteAccuracy.toFixed(1)}%</span>
                </div>
                <Progress value={whiteAccuracy} className="h-1.5" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Black:</span>
                  <span className="font-medium">{blackAccuracy.toFixed(1)}%</span>
                </div>
                <Progress value={blackAccuracy} className="h-1.5" />
              </div>
            </div>
            
            <Separator className="my-3" />
            
            <div className="text-sm font-medium mb-2">Captured Material</div>
            <div className="flex justify-between">
              <div className="flex flex-wrap gap-0.5 text-sm">
                {capturedPieces.black.map((piece, i) => (
                  <span key={i} className="inline-block">{piece}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-0.5 text-sm justify-end">
                {capturedPieces.white.map((piece, i) => (
                  <span key={i} className="inline-block">{piece}</span>
                ))}
              </div>
            </div>
            
            <Separator className="my-3" />
            
            <div className="text-sm font-medium mb-2">External Links</div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={() => window.open(gameData?.url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Chess.com
            </Button>
          </CardContent>
        </Card>
        
        {/* Evaluation chart and settings */}
        <Card className="col-span-3">
          <CardContent className="p-4">
            {evalChartData && (
              <div className="h-[180px] w-full">
                <Line data={evalChartData.data} options={evalChartData.options as any} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <div className="text-sm font-medium mb-1">Move Quality Breakdown</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.keys(moveQualityStyles).map(quality => {
                    const whiteCount = whiteMoveQualities[quality.toLowerCase() as keyof MoveQualityCounts] || 0;
                    const blackCount = blackMoveQualities[quality.toLowerCase() as keyof MoveQualityCounts] || 0;
                    const style = moveQualityStyles[quality];
                    
                    return (
                      <div key={quality} className={`flex justify-between items-center p-1 rounded ${style.bgColor}`}>
                        <div className={`flex items-center gap-1 ${style.color}`}>
                          <span>{style.icon}</span>
                          <span>{quality}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="h-5 min-w-[20px] flex items-center justify-center">
                            {whiteCount}
                          </Badge>
                          <Badge variant="outline" className="h-5 min-w-[20px] flex items-center justify-center bg-gray-800 text-white">
                            {blackCount}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Engine Settings</div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="depth" className="text-xs text-muted-foreground">
                      Depth
                    </label>
                    <Select 
                      value={engineDepth.toString()} 
                      onValueChange={(value) => onEngineDepthChange(Number(value))}
                    >
                      <SelectTrigger className="w-20 h-7">
                        <SelectValue placeholder="Depth" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="18">18</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="22">22</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label htmlFor="showLines" className="text-xs text-muted-foreground">
                      Show Engine Lines
                    </label>
                    <input
                      type="checkbox"
                      id="showLines"
                      checked={true}
                      onChange={() => {}} // Add empty onChange handler to fix controlled component warning
                      className="h-4 w-4"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label htmlFor="playbackSpeed" className="text-xs text-muted-foreground">
                      Playback Speed
                    </label>
                    <Select 
                      value={playbackSpeed.toString()} 
                      onValueChange={(value) => onPlaybackSpeedChange(Number(value))}
                    >
                      <SelectTrigger className="w-20 h-7">
                        <SelectValue placeholder="Speed" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3000">Slow</SelectItem>
                        <SelectItem value="1500">Normal</SelectItem>
                        <SelectItem value="800">Fast</SelectItem>
                        <SelectItem value="400">Very Fast</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Game Phase Quality</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block mb-1">Opening</span>
                      <div className="flex justify-between items-center">
                        <div className="w-3 h-3 bg-white border border-gray-300 rounded-full"></div>
                        {getQualityBadge(openingQuality.white)}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="w-3 h-3 bg-black rounded-full"></div>
                        {getQualityBadge(openingQuality.black)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Middlegame</span>
                      <div className="flex justify-between items-center">
                        <div className="w-3 h-3 bg-white border border-gray-300 rounded-full"></div>
                        {getQualityBadge(middlegameQuality.white)}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="w-3 h-3 bg-black rounded-full"></div>
                        {getQualityBadge(middlegameQuality.black)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Endgame</span>
                      <div className="flex justify-between items-center">
                        <div className="w-3 h-3 bg-white border border-gray-300 rounded-full"></div>
                        {getQualityBadge(endgameQuality.white)}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="w-3 h-3 bg-black rounded-full"></div>
                        {getQualityBadge(endgameQuality.black)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Playback controls */}
      <div className="flex justify-between gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={onFirstMove}>
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onPrevMove} disabled={moveIndex === 0}>
          <SkipBack className="h-4 w-4 rotate-90" />
        </Button>
        {isPlaying ? (
          <Button variant="destructive" size="sm" onClick={onStopPlayThrough}>
            <Pause className="h-4 w-4 mr-2" />
            Stop
          </Button>
        ) : (
          <Button 
            variant="default" 
            size="sm" 
            onClick={onPlayThrough}
            disabled={moveIndex >= moveHistory.length}
          >
            <Play className="h-4 w-4 mr-2" />
            Play
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onNextMove} 
          disabled={moveIndex >= moveHistory.length}
        >
          <SkipForward className="h-4 w-4 rotate-90" />
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onLastMove}
          disabled={moveIndex >= moveHistory.length}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Current position status */}
      <div className="bg-muted p-3 rounded-md">
        <div className="text-sm mb-2">
          Move {Math.floor(moveIndex / 2) + 1}{moveIndex % 2 === 0 ? ". White" : ". Black"}
          {moveIndex < moveHistory.length ? (
            <span className="ml-1">to play <span className="font-medium">{moveHistory[moveIndex]}</span></span>
          ) : (
            <span className="ml-1">Game Over</span>
          )}
        </div>
        
        {moveIndex > 0 && (
          <div className="mt-2">
            {getCurrentMoveQuality()}
          </div>
        )}
        
        {evaluation && (
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground">Evaluation: </span>
            <span className="font-medium">
              {evaluation.eval > 0 ? "+" : ""}{evaluation.eval.toFixed(2)}
            </span>
            <span className="ml-2 text-muted-foreground">
              {getEvaluationDescription(evaluation.eval)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}