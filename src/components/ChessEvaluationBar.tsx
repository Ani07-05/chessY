import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ChessEvaluationBarProps {
  evaluation: number;
}

const ChessEvaluationBar: React.FC<ChessEvaluationBarProps> = ({ evaluation }) => {
  const [fillPercentage, setFillPercentage] = useState(50);
  const [prevEval, setPrevEval] = useState(evaluation);

  useEffect(() => {
    // Save previous evaluation for animation direction
    setPrevEval(evaluation);
    
    // Convert evaluation to percentage (sigmoid-like function)
    // This will map evaluation from -∞ to +∞ to a range of 0-100
    // Adjusted the divisor for better visual representation
    const percentage = 50 + (50 * Math.tanh(evaluation / 2.5));
    setFillPercentage(percentage);
  }, [evaluation]);

  // Get colors based on advantage
  const blackColor = "bg-gray-800";
  const whiteColor = "bg-gray-200";

  // Format the evaluation text
  const formatEvaluation = () => {
    const absEval = Math.abs(evaluation);
    const sign = evaluation > 0 ? "+" : "";
    return evaluation === 0 ? "0.0" : `${sign}${absEval.toFixed(1)}`;
  };

  // Get evaluation icon
  const getEvaluationIcon = () => {
    if (evaluation > 0.5) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (evaluation < -0.5) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-gray-500" />;
  };

  // Determine animation class based on whether advantage is increasing or decreasing
  const getAnimationClass = () => {
    if (Math.abs(evaluation - prevEval) < 0.1) return ""; // No significant change
    if (evaluation > prevEval) return "pulse-green";
    return "pulse-red";
  };

  return (
    <div className="h-full flex flex-col justify-center mr-2 relative">
      <div className="h-[calc(100%-20px)] w-8 bg-white border border-gray-300 relative rounded-sm overflow-hidden shadow-md">
        <div 
          className={`absolute w-full ${getAnimationClass()} transition-all duration-700 ease-out ${evaluation >= 0 ? blackColor : whiteColor}`}
          style={{ 
            height: `${fillPercentage}%`,
            bottom: 0
          }}
        />
        
        {/* Evaluation text */}
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold z-10 pointer-events-none">
          <span 
            className={`px-1 py-0.5 rounded flex items-center gap-1 ${Math.abs(evaluation) > 2 ? 'bg-opacity-70 bg-black text-white' : ''} transition-all duration-300`}
            style={{ transform: 'rotate(-90deg)' }}
          >
            {getEvaluationIcon()}
            {formatEvaluation()}
          </span>
        </div>
        
        {/* Center line */}
        <div className="absolute w-full h-[1px] bg-gray-400 left-0 top-1/2 transform -translate-y-1/2" />
        
        {/* Tick marks */}
        <div className="absolute w-1 h-[1px] bg-gray-400 right-0 top-[25%]" />
        <div className="absolute w-1 h-[1px] bg-gray-400 right-0 top-[75%]" />
      </div>
      
      {/* Advantage labels */}
      <div className="text-[10px] text-center w-full text-gray-500 font-medium mt-1">
        {evaluation > 0.5 ? "White +" : evaluation < -0.5 ? "Black +" : "Even"}
      </div>
      
      {/* Add CSS keyframes for pulse animations */}
      <style jsx>{`
        @keyframes pulseGreen {
          0% { opacity: 1; }
          50% { opacity: 0.8; box-shadow: 0 0 0 2px rgba(72, 187, 120, 0.5); }
          100% { opacity: 1; }
        }
        @keyframes pulseRed {
          0% { opacity: 1; }
          50% { opacity: 0.8; box-shadow: 0 0 0 2px rgba(245, 101, 101, 0.5); }
          100% { opacity: 1; }
        }
        .pulse-green {
          animation: pulseGreen 1s;
        }
        .pulse-red {
          animation: pulseRed 1s;
        }
      `}</style>
    </div>
  );
};

export default ChessEvaluationBar;