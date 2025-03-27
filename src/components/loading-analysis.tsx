import { RefreshCw } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface LoadingAnalysisProps {
  progress: number
}

export function LoadingAnalysis({ progress }: LoadingAnalysisProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <div>
              <div className="font-medium">Analyzing game moves...</div>
              <div className="text-sm text-muted-foreground">
                Using Stockfish 17 NNUE
              </div>
            </div>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Analyzing positions...</span>
            <span>{Math.round(progress)}%</span>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Analysis powered by Chess API
          </div>
        </div>
      </div>
    </div>
  )
}