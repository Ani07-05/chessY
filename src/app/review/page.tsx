"use client"

import { useEffect, useState, useCallback, Suspense } from "react" // Import Suspense
import { useSearchParams, useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RefreshCw, ChevronLeft } from "lucide-react"
import { toast } from "sonner"
import GameReview from "@/components/game-review"

// Define the type for game result
type GameResult = "win" | "loss" | "draw"

// Define the player info type
interface PlayerInfo {
  username: string
  rating?: number
  result: GameResult
}

// Define the Chess.com API game data type
interface ChessGameData {
  url: string
  pgn: string
  time_control: string
  end_time: number
  white: PlayerInfo
  black: PlayerInfo
  // Add other properties as needed
}

// Define the type for our formatted game data
interface GameData {
  pgn?: string
  fen?: string
  playerColor: "white" | "black"
  opponentColor: "white" | "black"
  opponentUsername?: string
  result: GameResult
  resultText: string
  resultClass: string
  date: string
  time: string
  url: string
  white: PlayerInfo
  black: PlayerInfo
  end_time: number
  timeControl: string
}

// Define the type for the game service response
type GameSide = "white" | "black"

// Define UserProfile type
interface UserProfile {
  id: string;
  username?: string;
  chess_username?: string;
  // Add other relevant profile fields
}

// Loading component for Suspense fallback
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin">
          <RefreshCw className="h-8 w-8" />
        </div>
        <p className="text-gray-600">Loading game review...</p>
      </div>
    </div>
  );
}

// Inner component containing the logic that uses useSearchParams
function ReviewPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [reviewGame, setReviewGame] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null) // Use UserProfile type

  // Fetch game data from URL parameters

  const fetchUserProfile = useCallback(async () => { // Wrap in useCallback
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        console.log("No authenticated session found")
        return
      }

      const { data: profile, error } = await supabase.from("users").select("*").eq("id", session.user.id).single()

      if (error) {
        console.error("Error fetching profile:", error)
        return
      }

      if (profile) {
        setUserProfile(profile as UserProfile) // Cast to UserProfile
      }
    } catch (err) {
      console.error("Error fetching user profile:", err)
    }
  }, [supabase]); // Add supabase dependency
  

  useEffect(() => {
    const fetchGameData = async () => {
      setLoading(true)
      try {
        // Get game ID and player color from URL parameters
        const gameIdParam = searchParams.get("gameId")
        const playerColorParam = searchParams.get("playerColor") || "white"
        const username = searchParams.get("username")

        // Ensure playerColor is a valid value
        const playerColor: GameSide = playerColorParam === "black" ? "black" : "white"
        
        if (!gameIdParam) {
          toast.error("No game ID provided")
          return
        }

        // Extract the game ID from the Chess.com URL if necessary
        const gameId = gameIdParam.includes("/") ? gameIdParam.split("/").pop() : gameIdParam

        if (!gameId) {
          toast.error("Invalid game ID format")
          return
        }

        console.log(`Fetching game with ID: ${gameId}, username: ${username || "not provided"}`)

        
        // Import game service dynamically
        const { fetchGameById } = await import("@/lib/chess-game-services")

        try {
          // Fetch the game using our service that searches in monthly archives
          const gameData: ChessGameData = await fetchGameById(gameId, username || undefined)

          // Format the game data
          const formattedGame: GameData = {
            playerColor,
            opponentColor: playerColor === "white" ? "black" : "white",
            result: gameData[playerColor].result,
            resultText:
              gameData[playerColor].result === "win"
                ? "Victory"
                : gameData[playerColor].result === "draw"
                  ? "Draw"
                  : "Defeat",
            resultClass:
              gameData[playerColor].result === "win"
                ? "text-green-500"
                : gameData[playerColor].result === "draw"
                  ? "text-yellow-500"
                  : "text-red-500",
            date: new Date(gameData.end_time * 1000).toLocaleDateString(),
            time: new Date(gameData.end_time * 1000).toLocaleTimeString(),
            url: gameData.url,
            pgn: gameData.pgn,
            white: gameData.white,
            black: gameData.black,
            end_time: gameData.end_time,
            timeControl: gameData.time_control || "Standard",
          }

          console.log("Game data loaded successfully:", formattedGame)
          setReviewGame(formattedGame)

          // Fetch user profile after game is loaded
          await fetchUserProfile()
        } catch (gameError) {
          console.error("Error fetching game from Chess.com API:", gameError)

          // Attempt to fetch from direct March 2025 archive as specified in the original code
          console.log("Attempting direct fetch from archive...")

          try {
            const response = await fetch(`https://api.chess.com/pub/player/${username || 'aggani007'}/games/2025/03`)

            if (!response.ok) {
              throw new Error(`Failed to fetch archive: ${response.statusText}`)
            }

            const archiveData = await response.json()
            const games = archiveData.games || []

            // Find the game with matching ID
            const game = games.find((g: ChessGameData) => { // Use ChessGameData type
              const gameUrlId = g.url.split("/").pop()
              return gameUrlId === gameId
            })

            if (!game) {
              throw new Error(`Game with ID ${gameId} not found in archive`)
            }

            // Format the game data from direct archive
            const formattedGame: GameData = {
              playerColor,
              opponentColor: playerColor === "white" ? "black" : "white",
              opponentUsername: game[playerColor === "white" ? "black" : "white"].username,
              result: game[playerColor].result as GameResult,
              resultText:
                game[playerColor].result === "win" ? "Victory" : game[playerColor].result === "draw" ? "Draw" : "Defeat",
              resultClass:
                game[playerColor].result === "win"
                  ? "text-green-500"
                  : game[playerColor].result === "draw"
                    ? "text-yellow-500"
                    : "text-red-500",
              date: new Date(game.end_time * 1000).toLocaleDateString(),
              time: new Date(game.end_time * 1000).toLocaleTimeString(),
              url: game.url,
              pgn: game.pgn,
              white: game.white,
              black: game.black,
              end_time: game.end_time,
              timeControl: game.time_control || "Standard",
            }

            console.log("Game data loaded via direct archive method:", formattedGame)
            setReviewGame(formattedGame)
            
            // Fetch user profile after game is loaded
            await fetchUserProfile()
          } catch (archiveError) {
            console.error("Direct archive fetch failed:", archiveError)
            throw gameError // Re-throw the original error
          }
        }
      } catch (error) {
        console.error("All game fetching methods failed:", error)
        toast.error("Error loading game data. The game could not be found.")
      } finally {
        setLoading(false)
      }
    }

    fetchGameData()
  }, [searchParams, fetchUserProfile]) // Added fetchUserProfile dependency

  // Fetch user profile from Supabase


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin">
            <RefreshCw className="h-8 w-8" />
          </div>
          <p className="text-gray-600">Loading game data...</p>
        </div>
      </div>
    )
  }

  if (!reviewGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-red-500">
            <p className="text-xl font-bold">Game not found</p>
            <p className="text-gray-600 mt-2">Unable to load the requested game.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="mt-4"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Determine the username to pass to GameReview
  const playerUsername = userProfile?.chess_username || 
    (reviewGame.playerColor === "white" ? reviewGame.white.username : reviewGame.black.username);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold">Game Review</h1>
          </div>
        </div>

        <Card className="p-6">
          <GameReview 
            game={reviewGame} 
            username={playerUsername} 
          />
        </Card>
      </div>
    </div>
  )
}

// Default export wraps the content in Suspense
export default function ReviewPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReviewPageContent />
    </Suspense>
  );
}