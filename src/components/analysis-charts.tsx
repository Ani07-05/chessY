"use client"

import React from 'react';
import { Line, Pie, Bar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement,
  ChartOptions,
  TooltipItem
} from 'chart.js';
// Helper functions for move quality styling
const getMoveQualityClass = (quality: string): string => {
  switch (quality) {
    case "Brilliant Move": return "text-purple-600";
    case "Best Move": return "text-indigo-600";
    case "Excellent Move": return "text-blue-600";
    case "Good Move": return "text-green-600";
    case "Book Move": return "text-blue-600";
    case "Inaccuracy": return "text-yellow-600";
    case "Mistake": return "text-orange-600";
    case "Blunder": return "text-red-600";
    default: return "text-gray-600";
  }
};

const getMoveQualityIcon = (quality: string): string => {
  switch (quality) {
    case "Brilliant Move": return "★";
    case "Best Move": return "✦";
    case "Excellent Move": return "⬥";
    case "Good Move": return "●";
    case "Book Move": return "⬩";
    case "Inaccuracy": return "⭘";
    case "Mistake": return "▲";
    case "Blunder": return "✖";
    default: return "○";
  }
};

// Register the required chart components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Define move quality categories and their associated colors
const moveQualities = [
  "Brilliant Move",
  "Best Move",
  "Excellent Move",
  "Good Move",
  "Book Move",
  "Inaccuracy",
  "Mistake",
  "Blunder"
];

const moveQualityColors = {
  "Brilliant Move": 'rgba(147, 51, 234, 0.8)',
  "Best Move": 'rgba(79, 70, 229, 0.8)',
  "Excellent Move": 'rgba(59, 130, 246, 0.8)',
  "Good Move": 'rgba(34, 197, 94, 0.8)',
  "Book Move": 'rgba(59, 130, 246, 0.8)',
  "Inaccuracy": 'rgba(234, 179, 8, 0.8)',
  "Mistake": 'rgba(249, 115, 22, 0.8)',
  "Blunder": 'rgba(239, 68, 68, 0.8)'
};

interface EvaluationChartProps {
  evaluations: number[];
  moveIndices?: number[];
  height?: number;
  showAxis?: boolean;
  colorTheme?: 'light' | 'dark';
}

/**
 * Renders a line chart of position evaluations throughout a game
 */
export function EvaluationChart({ 
  evaluations, 
  moveIndices,
  height = 180, 
  showAxis = true,
  colorTheme = 'light'
}: EvaluationChartProps) {
  if (!evaluations || evaluations.length < 2) {
    return <div className="h-24 flex items-center justify-center text-muted-foreground">Insufficient data for chart</div>;
  }

  // Use explicit move indices if provided, otherwise use sequential numbers
  const labels = moveIndices || evaluations.map((_, i) => i);

  const data = {
    labels,
    datasets: [{
      label: 'Evaluation',
      data: evaluations,
      borderColor: 'rgb(99, 102, 241)',
      backgroundColor: 'rgba(99, 102, 241, 0.5)',
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 4,
      fill: false
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const value = context.parsed.y;
            return value > 0 ? `+${value.toFixed(2)}` : `${value.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      y: {
        min: -4,
        max: 4,
        ticks: { 
          stepSize: 1,
          display: showAxis 
        },
        grid: { 
          color: colorTheme === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(0, 0, 0, 0.1)',
          display: showAxis
        },
        display: showAxis
      },
      x: {
        ticks: { 
          maxTicksLimit: 10,
          display: showAxis
        },
        grid: { 
          display: false 
        },
        display: showAxis
      }
    }
  };

  return (
    <div style={{ height: `${height}px` }}>
      <Line data={data} options={options as ChartOptions<'line'>} />
    </div>
  );
}

interface MoveAnalysis {
  playerColor: string;
  quality: string;
  evalAfter?: number;
  moveNumber?: number;
  move?: string;
  fen?: string;
  estimatedRating?: number;
}

interface MoveQualityBreakdownProps {
  moveAnalyses: MoveAnalysis[];
  playerColor?: string;
}

/**
 * Renders a breakdown of move qualities in a pie chart
 */
export function MoveQualityBreakdown({ moveAnalyses, playerColor }: MoveQualityBreakdownProps) {
  if (!moveAnalyses || moveAnalyses.length === 0) {
    return <div className="h-40 flex items-center justify-center text-muted-foreground">No move data available</div>;
  }

  // Filter moves by player color if specified
  const filteredMoves = playerColor 
    ? moveAnalyses.filter(move => move.playerColor === playerColor)
    : moveAnalyses;

  // Count occurrences of each move quality
  const moveCounts = moveQualities.reduce((acc, quality) => {
    acc[quality] = filteredMoves.filter(move => move.quality === quality).length;
    return acc;
  }, {} as Record<string, number>);

  const data = {
    labels: Object.keys(moveCounts).filter(key => moveCounts[key] > 0),
    datasets: [
      {
        data: Object.values(moveCounts).filter(count => count > 0),
        backgroundColor: Object.keys(moveCounts)
          .filter(key => moveCounts[key] > 0)
          .map(key => moveQualityColors[key as keyof typeof moveQualityColors]),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 15,
          font: {
            size: 11
          }
        }
      },
    },
  };

  return (
    <div style={{ height: '200px' }}>
      <Pie data={data} options={options as ChartOptions<'pie'>} />
    </div>
  );
}

interface MoveQualityBarChartProps {
  moveAnalyses: MoveAnalysis[];
  playerColor?: string;
}

interface MoveQualityGridProps {
  moveAnalyses: MoveAnalysis[];
}

/**
 * Renders a bar chart of move qualities
 */
export function MoveQualityBarChart({ moveAnalyses, playerColor }: MoveQualityBarChartProps) {
  if (!moveAnalyses || moveAnalyses.length === 0) {
    return <div className="h-40 flex items-center justify-center text-muted-foreground">No move data available</div>;
  }

  // Filter moves by player color if specified
  const filteredMoves = playerColor 
    ? moveAnalyses.filter(move => move.playerColor === playerColor)
    : moveAnalyses;

  // Count occurrences of each move quality
  const counts: Record<string, number> = {};
  moveQualities.forEach(quality => {
    counts[quality] = filteredMoves.filter(move => move.quality === quality).length;
  });

  const data = {
    labels: moveQualities,
    datasets: [
      {
        label: 'Number of Moves',
        data: moveQualities.map(quality => counts[quality]),
        backgroundColor: moveQualities.map(quality => moveQualityColors[quality as keyof typeof moveQualityColors]),
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: {
          precision: 0,
        },
        grid: {
          display: false,
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div style={{ height: '240px' }}>
      <Bar data={data} options={options as ChartOptions<'bar'>} />
    </div>
  );
}

export function MoveQualityGrid({ moveAnalyses }: MoveQualityGridProps) {
  if (!moveAnalyses || moveAnalyses.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">No move data available</div>;
  }

  // Count occurrences of each move quality
  const counts: Record<string, number> = {};
  moveQualities.forEach(quality => {
    counts[quality] = moveAnalyses.filter(move => move.quality === quality).length;
  });

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {moveQualities.map(quality => (
        <div key={quality} className="flex justify-between items-center p-1 bg-muted/20 rounded">
          <div className={`flex items-center gap-1 ${getMoveQualityClass(quality)}`}>
            <span>{getMoveQualityIcon(quality)}</span>
            <span>{quality.split(' ')[0]}</span>
          </div>
          <span className="font-mono">{counts[quality]}</span>
        </div>
      ))}
    </div>
  );
}

interface AccuracyComparisonProps {
  playerAccuracy: number;
  opponentAccuracy: number;
  playerColor: string;
}

/**
 * Renders a bar chart comparing player and opponent accuracy
 */
export function AccuracyComparison({ 
  playerAccuracy, 
  opponentAccuracy, 
  playerColor 
}: AccuracyComparisonProps) {
  const data = {
    labels: ['You', 'Opponent'],
    datasets: [
      {
        label: 'Accuracy (%)',
        data: [playerAccuracy, opponentAccuracy],
        backgroundColor: [
          playerColor === 'white' ? 'rgba(220, 220, 220, 0.8)' : 'rgba(50, 50, 50, 0.8)',
          playerColor === 'white' ? 'rgba(50, 50, 50, 0.8)' : 'rgba(220, 220, 220, 0.8)',
        ],
        borderColor: [
          playerColor === 'white' ? 'rgba(220, 220, 220, 1)' : 'rgba(50, 50, 50, 1)',
          playerColor === 'white' ? 'rgba(50, 50, 50, 1)' : 'rgba(220, 220, 220, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
      },
    },
  };

  return (
    <div style={{ height: '140px' }}>
      <Bar data={data} options={options as any} />
    </div>
  );
}

interface GameSummaryCardProps {
  playerAccuracy: number;
  opponentAccuracy: number;
  moveAnalyses: MoveAnalysis[];
  playerColor: string;
}

/**
 * A comprehensive summary card with multiple charts
 */
export function GameSummaryCard({ 
  playerAccuracy, 
  opponentAccuracy, 
  moveAnalyses, 
  playerColor 
}: GameSummaryCardProps) {
  // Extract evaluations for the evaluation chart
  const evaluations = moveAnalyses.map(ma => ma.evalAfter || 0);
  
  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle>Game Analysis Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Evaluation Timeline</h4>
            <EvaluationChart evaluations={evaluations} />
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Accuracy Comparison</h4>
            <AccuracyComparison 
              playerAccuracy={playerAccuracy} 
              opponentAccuracy={opponentAccuracy} 
              playerColor={playerColor} 
            />
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Your Move Quality</h4>
              <MoveQualityGrid moveAnalyses={moveAnalyses.filter(ma => ma.playerColor === playerColor)} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}