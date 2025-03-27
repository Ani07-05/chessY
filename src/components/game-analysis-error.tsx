import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

interface GameAnalysisErrorProps {
  errorMessage: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

/**
 * A component to display when there is an error in game analysis
 */
export function GameAnalysisError({ 
  errorMessage, 
  onRetry, 
  showRetry = true 
}: GameAnalysisErrorProps) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-destructive">Analysis Error</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{errorMessage || "An error occurred while analyzing the chess position."}</p>
        <p className="text-sm mt-2">The system will use a fallback engine to continue analysis.</p>
      </CardContent>
      {showRetry && onRetry && (
        <CardFooter>
          <Button variant="outline" onClick={onRetry} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Analysis
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}