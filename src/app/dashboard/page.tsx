"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, ExternalLink, Play, RefreshCw, Trophy, Users } from "lucide-react"
import { useTheme } from "next-themes"
import Image from "next/image"
import { toast } from "sonner"
import { Chart as ChartJS } from "chart.js/auto"
import { Line, Pie, Bar } from "react-chartjs-2"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { UserNav } from "@/components/user-nav"
import type { Database } from "@/lib/database"

// Configure chart defaults
ChartJS.defaults.responsive = true
ChartJS.defaults.maintainAspectRatio = false

interface ChessStats {
  chess_rapid?: {
    last: { rating: number }
    record: { win: number; loss: number; draw: number }
    best?: { rating: number; date: number }
  }
  chess_blitz?: {
    last: { rating: number }
    record: { win: number; loss: number; draw: number }
    best?: { rating: number; date: number }
  }
  chess_bullet?: {
    last: { rating: number }
    record: { win: number; loss: number; draw: number }
    best?: { rating: number; date: number }
  }
}

interface ClassProgress {
  gamesPlayed: number
  gamesWon: number
  gamesDrawn: number
  gamesLost: number
  levelProgress: number
  lastClassDate: Date
  nextClassDate: Date
  daysUntilNextClass: number
}

interface UserProfile {
  id: string
  username: string
  chessUsername: string
  role: string
  avatarUrl?: string
  email?: string
}

interface Poll {
  id: string
  question: string
  options: Record<string, string>
  votes: Record<string, string>
  active: boolean
  created_at: string
  type?: "regular" | "quiz"
}

interface GameData {
  fen: string
  playerColor: string
  opponentColor: string
  opponentUsername: string
  result: string
  resultText: string
  resultClass: string
  date: string
  time: string
  timeControl: string
  url: string
  white: { username: string; result: string }
  black: { username: string; result: string }
  end_time: number
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()
  const { theme } = useTheme()
  const [stats, setStats] = useState<ChessStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [username, setUsername] = useState("")
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [classProgress, setClassProgress] = useState<ClassProgress | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [recentGames, setRecentGames] = useState<GameData[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("")
  const [activePolls, setActivePolls] = useState<Poll[]>([])
  const [hasVoted, setHasVoted] = useState<Record<string, boolean>>({})

  const FIRST_CLASS_DATE = new Date("2025-03-03")
  const CLASS_INTERVAL = 7 // days
  const LATEST_CLASS_URL = "https://youtu.be/mpKAw1Sf_As?si=QGnqujweCPZmqBpU"

  const getNextClassDate = (fromDate: Date = new Date()): Date => {
    const nextDate = new Date(FIRST_CLASS_DATE)
    while (nextDate <= fromDate) {
      nextDate.setDate(nextDate.getDate() + CLASS_INTERVAL)
    }
    return nextDate
  }

  const getLastClassDate = (fromDate: Date = new Date()): Date => {
    const lastDate = getNextClassDate(fromDate)
    lastDate.setDate(lastDate.getDate() - CLASS_INTERVAL)
    return lastDate
  }

  const getDaysUntilNextClass = (nextClassDate: Date): number => {
    const now = new Date()
    const diffTime = nextClassDate.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const fetchUserProfile = useCallback(async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!session) {
        router.push("/auth")
        return
      }

      const { data: profile, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (!profile) {
        // Create profile if it doesn't exist
        const { data: newProfile, error: insertError } = await supabase
          .from("users")
          .insert([
            {
              id: session.user.id,
              email: session.user.email,
              username: session.user.email?.split("@")[0] || "User",
              chess_username: "magnuscarlsen",
            },
          ])
          .select()
          .single()

        if (insertError) throw insertError

        if (newProfile) {
          setUserProfile({
            id: newProfile.id,
            username: newProfile.username ?? "User",
            chessUsername: newProfile.chess_username ?? "hikaru",
            role: "user",
            email: newProfile.email ?? undefined,
            avatarUrl: newProfile.avatar_url ?? undefined,
          })
          setUsername(newProfile.chess_username ?? "magnuscarlsen")
        }
      } else {
        setUserProfile({
          id: profile.id,
          username: profile.username || session.user.email?.split("@")[0] || "User",
          chessUsername: profile.chess_username || "magnuscarlsen",
          role: profile.role || "user",
          email: profile.email ?? undefined,
          avatarUrl: profile.avatar_url ?? undefined,
        })
        setUsername(profile.chess_username || "magnuscarlsen")
        setIsSuperAdmin(profile.role === "admin" || profile.role === "superuser")
      }
    } catch (err) {
      console.error("Error fetching user profile:", err)
      setError(err instanceof Error ? err.message : "Failed to load user profile")
    }
  }, [router, supabase])

  const fetchGameArchives = async (username: string): Promise<string[]> => {
    try {
      const response = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`)
      if (!response.ok) throw new Error("Failed to fetch game archives")
      const data = await response.json()
      return data.archives || []
    } catch (error) {
      console.error("Error fetching game archives:", error)
      toast.error("Could not load game archives")
      return []
    }
  }

  const fetchGamesForMonth = async (archiveUrl: string): Promise<GameData[]> => {
    try {
      const response = await fetch(archiveUrl)
      if (!response.ok) throw new Error("Failed to fetch monthly games")
      const data = await response.json()
      return data.games || []
    } catch (error) {
      console.error("Error fetching monthly games:", error)
      return []
    }
  }

  const fetchRecentGames = useCallback(async (currentUsername: string) => {
    try {
      if (!currentUsername) return []; // Return empty array if no username
      const archives = await fetchGameArchives(currentUsername);
      if (archives.length === 0) return [];
      const latestArchiveUrl = archives[archives.length - 1];
      const games = await fetchGamesForMonth(latestArchiveUrl);
      const sortedGames = games.sort((a: GameData, b: GameData) => b.end_time - a.end_time).slice(0, 5);
      const processedGames = sortedGames.map((game: GameData) => {
        const playerColor = game.white.username.toLowerCase() === currentUsername.toLowerCase() ? "white" : "black";
        const opponentColor = playerColor === "white" ? "black" : "white";
        const result = game[playerColor].result;
        return {
          fen: game.fen,
          timeControl: game.timeControl,
          white: game.white,
          black: game.black,
          end_time: game.end_time,
          playerColor,
          opponentColor,
          opponentUsername: game[opponentColor].username,
          result,
          resultText: result === "win" ? "Victory" : result === "draw" ? "Draw" : "Defeat",
          resultClass: result === "win" ? "text-green-500" : result === "draw" ? "text-yellow-500" : "text-red-500",
          date: new Date(game.end_time * 1000).toLocaleDateString(),
          time: new Date(game.end_time * 1000).toLocaleTimeString(),
          url: game.url,
        };
      });
      setRecentGames(processedGames); // Update state here
    } catch (err) {
      console.error("Error fetching recent games:", err);
      setRecentGames([]); // Clear or set empty on error
    }
  }, []); // Removed username dependency

  const fetchClassProgress = useCallback(async (currentUsername: string) => {
    try {
      if (!currentUsername) return;

      const lastClass = getLastClassDate();
      const nextClass = getNextClassDate();
      const daysUntilNext = getDaysUntilNextClass(nextClass);

      const archives = await fetchGameArchives(currentUsername);
      let gamesPlayed = 0;
      let gamesWon = 0;
      let gamesDrawn = 0;
      let gamesLost = 0;

      // Get the most recent archives (last 2 months)
      const recentArchives = archives.slice(-2);

      for (const archiveUrl of recentArchives) {
        const games = await fetchGamesForMonth(archiveUrl);

        for (const game of games) {
          const gameEndTime = new Date(game.end_time * 1000);
          if (gameEndTime > lastClass && gameEndTime <= new Date()) {
            gamesPlayed++;
            const playerColor = game.white.username.toLowerCase() === currentUsername.toLowerCase() ? "white" : "black";
            const result = game[playerColor].result;

            if (result === "win") gamesWon++;
            else if (result === "draw" || result === "stalemate") gamesDrawn++;
            else gamesLost++;
          }
        }
      }

      // Calculate level progress (example formula)
      const levelProgress = Math.min(100, gamesWon * 15 + gamesDrawn * 5);

      setClassProgress({
        gamesPlayed,
        gamesWon,
        gamesDrawn,
        gamesLost,
        levelProgress,
        lastClassDate: lastClass,
        nextClassDate: nextClass,
        daysUntilNextClass: daysUntilNext,
      });
    } catch (err) {
      console.error("Error fetching class progress:", err);
    }
  }, [getLastClassDate, getNextClassDate]); // Removed username dependency

  const refreshData = async () => {
    setRefreshing(true)
    try {
      await fetchUserProfile()
      if (username) {
        await Promise.all([fetchStats(username), fetchClassProgress(username), fetchRecentGames(username)])
      }
      await fetchActivePolls()
      toast.success("Data refreshed successfully")
    } catch (err) {
      console.error("Error refreshing data:", err)
      toast.error("Failed to refresh data")
    } finally {
      setRefreshing(false)
    }
  }

  const fetchStats = useCallback(async (currentUsername: string) => {
    if (!currentUsername) return;

    setLoading(true)
    setError("")
    try {
      const response = await fetch(`https://api.chess.com/pub/player/${currentUsername}/stats`)
      if (!response.ok) throw new Error("Failed to fetch stats")
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats")
    } finally {
      setLoading(false)
    }
  }, [])

  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[7].length === 11 ? match[7] : false
  }


  const handleVote = async (pollId: string, optionKey: string) => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        toast.error("You must be logged in to vote")
        return
      }

      // Get the current poll
      const { data: pollData, error: pollError } = await supabase
        .from("polls")
        .select("*")
        .eq("id", pollId)
        .single()

      if (pollError) {
        console.error("Error fetching poll:", pollError)
        toast.error("Failed to fetch poll")
        return
      }

      const currentPoll = pollData

      if (!currentPoll) {
        console.error("Poll not found")
        toast.error("Poll not found")
        return
      }

      // Update votes object
      const votes: Record<string, string> = currentPoll.votes as Record<string, string> || {}
      votes[session.user.id] = optionKey

      // Update the poll
      const { error } = await supabase.from("polls").update({ votes }).eq("id", pollId)

      if (error) {
        console.error("Error voting:", error)
        toast.error("Failed to submit vote")
        return
      }

      // Update local state
      setHasVoted((prev) => ({ ...prev, [pollId]: true }))
      fetchActivePolls()
      toast.success("Vote submitted successfully")
    } catch (err) {
      console.error("Error voting:", err)
      toast.error("Failed to submit vote")
    }
  }

  const fetchActivePolls = useCallback(async () => {
    try {
      const { data: polls, error } = await supabase
        .from("polls")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching polls:", error)
        return
      }

      if (polls) {
        const parsedPolls = polls.map((poll) => {
          let parsedOptions: Record<string, string> = {}

          try {
            // Handle different formats of options
            if (typeof poll.options === "string") {
              parsedOptions = JSON.parse(poll.options)
            } else if (poll.options && typeof poll.options === "object") {
              parsedOptions = Object.entries(poll.options).reduce((acc, [key, value]) => {
                if (typeof value === 'string') {
                  acc[key] = value;
                }
                return acc;
              }, {} as Record<string, string>);
            }
          } catch (e) {
            console.error("Error parsing options for poll:", poll.id, e)
            parsedOptions = {}
          }

          let parsedVotes: Record<string, string> = {}
          try {
              // Handle different formats of votes
            if (typeof poll.votes === "string") {
              parsedVotes = JSON.parse(poll.votes)
            } else if (poll.votes && typeof poll.votes === "object" && !Array.isArray(poll.votes)) {
              parsedVotes = Object.entries(poll.votes).reduce((acc, [key, value]) => {
                if (typeof value === 'string') {
                  acc[key] = value;
                }
                return acc;
              }, {} as Record<string, string>);
            }
          } catch (e) {
            console.error("Error parsing votes for poll:", poll.id, e)
            parsedVotes = {}
          }

          return {
                      id: poll.id,
                      question: poll.question,
                      options: parsedOptions,
                      votes: parsedVotes,
                      active: poll.active,
                      created_at: poll.created_at,
                      type: typeof poll.type === 'string' && (poll.type === 'regular' || poll.type === 'quiz') ? poll.type : undefined
                    } as Poll
        })

        setActivePolls(parsedPolls)

        // Check which polls the user has voted on
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.user?.id) {
          const voted = parsedPolls.reduce((acc: Record<string, boolean>, poll) => {
            acc[poll.id] = poll.votes?.[session.user.id] !== undefined
            return acc
          }, {})
          setHasVoted(voted)
        }
      }
    } catch (err) {
      console.error("Error processing polls:", err)
    }
  }, [supabase])

  // Handler to start reviewing a game with proper error handling
  const handleReviewGame = (game: GameData) => {
    console.log("handleReviewGame called with game:", game); // Log input game data
    try {
      // Extract game ID from URL
      const gameId = game.url?.split('/').pop(); // Add optional chaining for safety
      console.log("Extracted gameId:", gameId); // Log gameId

      if (!gameId) {
        toast.error("Could not determine game ID from URL: " + game.url);
        console.error("Could not determine game ID from URL:", game.url);
        return;
      }

      // Check if username is available
      if (!username) {
          toast.error("Username not available for review link.");
          console.error("Username is empty, cannot create review link.");
          return;
      }
      console.log("Using username:", username); // Log username

      // Navigate to review page in same tab with query parameters and username
      const reviewUrl = `/review?gameId=${gameId}&playerColor=${game.playerColor}&username=${username}`;
      console.log("Navigating to reviewUrl:", reviewUrl); // Log the final URL
      router.push(reviewUrl);
      toast.info("Navigating to game review..."); // Use info level toast
    } catch (error) {
      console.error("Error opening game review:", error);
      toast.error("Failed to open game review");
    }
  };

  useEffect(() => {
    const videoId = getYouTubeVideoId(LATEST_CLASS_URL)
    if (videoId) {
      // Get high quality thumbnail
      setVideoPreviewUrl(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)
    }
  }, [LATEST_CLASS_URL])

  useEffect(() => {
    fetchUserProfile()
  }, [fetchUserProfile])

  useEffect(() => {
    const currentUsername = userProfile?.chessUsername;
    if (currentUsername) {
      setLoading(true); // Start loading when fetching dependent data
      Promise.all([
        fetchStats(currentUsername),
        fetchClassProgress(currentUsername),
        fetchRecentGames(currentUsername),
        fetchActivePolls() // Assuming this doesn't strictly depend on chessUsername
      ]).catch(err => {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load some dashboard data.");
      }).finally(() => {
        setLoading(false); // Stop loading after all fetches complete or fail
      });
    } else {
      // Handle case where profile exists but chessUsername doesn't, if necessary
      setLoading(false); // Stop loading if no username to fetch data for
    }
    // Remove callback functions from dependency array if they are stable
    // and the effect should only re-run based on username change.
  }, [userProfile?.chessUsername]); // Keep only the primary trigger

  useEffect(() => {
    fetchActivePolls()
    // Set up realtime subscription for polls
    const channel = supabase
      .channel("polls_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, fetchActivePolls) // Pass function reference
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchActivePolls, supabase]); // Keep fetchActivePolls here if it should re-run subscription on change

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin">
            <RefreshCw className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading your chess data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md p-6 bg-card rounded-lg border border-destructive/20 shadow-lg">
          <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Data</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={refreshData}>Try Again</Button>
        </div>
      </div>
    )
  }



  const getWinRateData = (type: "chess_rapid" | "chess_blitz" | "chess_bullet") => {
    const record = stats?.[type]?.record
    const emptyData = {
      labels: ["Wins", "Losses", "Draws"],
      datasets: [
        {
          data: [0, 0, 0],
          backgroundColor: ["rgba(34, 197, 94, 0.8)", "rgba(239, 68, 68, 0.8)", "rgba(234, 179, 8, 0.8)"],
          borderColor: ["rgba(34, 197, 94, 1)", "rgba(239, 68, 68, 1)", "rgba(234, 179, 8, 1)"],
          borderWidth: 2,
        },
      ],
    }

    if (!record) return emptyData

    return {
      labels: ["Wins", "Losses", "Draws"],
      datasets: [
        {
          data: [record.win, record.loss, record.draw],
          backgroundColor: ["rgba(34, 197, 94, 0.8)", "rgba(239, 68, 68, 0.8)", "rgba(234, 179, 8, 0.8)"],
          borderColor: ["rgba(34, 197, 94, 1)", "rgba(239, 68, 68, 1)", "rgba(234, 179, 8, 1)"],
          borderWidth: 2,
        },
      ],
    }
  }

  const getWinRatePercentage = (type: "chess_rapid" | "chess_blitz" | "chess_bullet") => {
    const record = stats?.[type]?.record
    if (!record) return 0

    const total = record.win + record.loss + record.draw
    if (total === 0) return 0

    return Math.round((record.win / total) * 100)
  }

  const ratingsData = {
    labels: ["Rapid", "Blitz", "Bullet"],
    datasets: [
      {
        label: "Ratings",
        data: [
          stats?.chess_rapid?.last.rating || 0,
          stats?.chess_blitz?.last.rating || 0,
          stats?.chess_bullet?.last.rating || 0,
        ],
        borderColor: "rgb(99, 102, 241)",
        backgroundColor: "rgba(99, 102, 241, 0.1)",
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const activityData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Games Played",
        data: [3, 5, 2, 8, 4, 7, 6],
        backgroundColor: "rgba(99, 102, 241, 0.8)",
        borderRadius: 4,
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="flex h-16 items-center px-4 container mx-auto">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Trophy className="h-6 w-6 text-primary" />
            <span>Chess ERP</span>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <ThemeSwitcher />
            {userProfile && (
              <UserNav
                user={userProfile}
                isSuperAdmin={isSuperAdmin}
                onLogout={async () => {
                  await supabase.auth.signOut()
                  router.push("/auth")
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {userProfile?.username || "Chess Player"}!</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshData} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            {isSuperAdmin && (
              <Button variant="default" size="sm" onClick={() => router.push("/stream")}>
                <Users className="h-4 w-4 mr-2" />
                Stream Control
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="border-primary/20 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-primary/10 p-6 flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">Watch the Latest Class</h2>
                  <p className="text-muted-foreground mb-4">
                    Improve your chess skills with our latest instructional video
                  </p>
                  <Button size="lg" className="gap-2 text-lg" onClick={() => window.open(LATEST_CLASS_URL, "_blank")}>
                    <Play className="h-5 w-5" />
                    Watch Now
                  </Button>
                </div>
                <div
                  className="relative w-full md:w-2/5 aspect-video rounded-lg overflow-hidden shadow-xl group cursor-pointer"
                  onClick={() => window.open(LATEST_CLASS_URL, "_blank")}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10" />
                  {videoPreviewUrl ? (
                    <Image
                      src={videoPreviewUrl || "/placeholder.svg"}
                      alt="Chess class thumbnail"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      width={640}
                      height={360}
                    />
                  ) : (
                    <div className={`w-full h-full ${theme === "dark" ? "chess-pattern-dark" : "chess-pattern-light"}`}>
                      <style jsx>{`
                        .chess-pattern-light {
                          --chess-light: #f1f5f9;
                          --chess-dark: #e2e8f0;
                          --gradient-start: rgba(99, 102, 241, 0.2);
                          --gradient-end: rgba(99, 102, 241, 0.1);
                          --piece-color: #1e293b;
                        }
                        .chess-pattern-dark {
                          --chess-light: #1e293b;
                          --chess-dark: #0f172a;
                          --gradient-start: rgba(99, 102, 241, 0.4);
                          --gradient-end: rgba(99, 102, 241, 0.2);
                          --piece-color: #f1f5f9;
                        }
                      `}</style>
                      <Image src="/chess.svg" alt="Chess pattern" className="w-full h-full object-cover" width={640} height={360} />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="bg-primary/90 rounded-full p-4 shadow-lg transform transition-transform duration-300 group-hover:scale-110">
                      <Play className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="progress">Class Progress</TabsTrigger>
              <TabsTrigger value="games">Recent Games</TabsTrigger>
              <TabsTrigger value="stats">Detailed Stats</TabsTrigger>
              <TabsTrigger value="polls">Polls</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["chess_rapid", "chess_blitz", "chess_bullet"].map((type) => {
                  const typedType = type as "chess_rapid" | "chess_blitz" | "chess_bullet"
                  // const ratingChange = getRatingChange(typedType) // No longer needed for display
                  const displayName =
                    type.replace("chess_", "").charAt(0).toUpperCase() + type.replace("chess_", "").slice(1)

                  return (
                    <Card key={type} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle>{displayName} Rating</CardTitle>
                        <CardDescription>Current performance in {displayName.toLowerCase()} games</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-end">
                          <div>
                            <div className="text-3xl font-bold">{stats?.[typedType]?.last.rating || "N/A"}</div>
                            {/* Removed rating change display block */}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Win Rate</div>
                            <div className="text-xl font-semibold">{getWinRatePercentage(typedType)}%</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Rating Comparison</CardTitle>
                    <CardDescription>Compare your ratings across different time controls</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <Line
                        data={ratingsData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false,
                            },
                          },
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Activity</CardTitle>
                    <CardDescription>Your chess games played this week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <Bar
                        data={activityData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false,
                            },
                          },
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {classProgress && (
                <Card>
                  <CardHeader>
                    <CardTitle>Next Class</CardTitle>
                    <CardDescription>Prepare for your upcoming chess lesson</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-4">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {classProgress.nextClassDate.toLocaleDateString(undefined, {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {classProgress.daysUntilNextClass} days remaining
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-medium">Preparation Progress</div>
                          <Progress value={classProgress.levelProgress} className="h-2" />
                          <div className="text-xs text-muted-foreground">{classProgress.levelProgress}% complete</div>
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="text-sm font-medium mb-2">Games Since Last Class</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-2xl font-bold">{classProgress.gamesPlayed}</div>
                            <div className="text-xs text-muted-foreground">Games Played</div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-green-500">{classProgress.gamesWon}</div>
                            <div className="text-xs text-muted-foreground">Victories</div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-yellow-500">{classProgress.gamesDrawn}</div>
                            <div className="text-xs text-muted-foreground">Draws</div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-red-500">{classProgress.gamesLost}</div>
                            <div className="text-xs text-muted-foreground">Defeats</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="progress" className="space-y-4">
              {classProgress ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Class Progress Report</CardTitle>
                      <CardDescription>
                        Your progress since the last class on {classProgress.lastClassDate.toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <div className="text-4xl font-bold">{classProgress.gamesPlayed}</div>
                              <div className="text-sm text-muted-foreground mt-1">Games Played</div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <div className="text-4xl font-bold text-green-500">{classProgress.gamesWon}</div>
                              <div className="text-sm text-muted-foreground mt-1">Victories</div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <div className="text-4xl font-bold text-yellow-500">{classProgress.gamesDrawn}</div>
                              <div className="text-sm text-muted-foreground mt-1">Draws</div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <div className="text-4xl font-bold text-red-500">{classProgress.gamesLost}</div>
                              <div className="text-sm text-muted-foreground mt-1">Defeats</div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium mb-3">Level Progress</h3>
                        <div className="space-y-2">
                          <Progress value={classProgress.levelProgress} className="h-3" />
                          <div className="flex justify-between text-sm">
                            <span>Beginner</span>
                            <span>Intermediate</span>
                            <span>Advanced</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-lg font-medium mb-3">Performance Metrics</h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Win Rate</div>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={(classProgress.gamesWon / (classProgress.gamesPlayed || 1)) * 100}
                                  className="h-2"
                                />
                                <span className="text-sm font-medium">
                                  {Math.round((classProgress.gamesWon / (classProgress.gamesPlayed || 1)) * 100)}%
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Draw Rate</div>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={(classProgress.gamesDrawn / (classProgress.gamesPlayed || 1)) * 100}
                                  className="h-2"
                                />
                                <span className="text-sm font-medium">
                                  {Math.round((classProgress.gamesDrawn / (classProgress.gamesPlayed || 1)) * 100)}%
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Loss Rate</div>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={(classProgress.gamesLost / (classProgress.gamesPlayed || 1)) * 100}
                                  className="h-2"
                                />
                                <span className="text-sm font-medium">
                                  {Math.round((classProgress.gamesLost / (classProgress.gamesPlayed || 1)) * 100)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-medium mb-3">Next Class Information</h3>
                          <div className="space-y-4">
                            <div className="bg-muted/50 p-4 rounded-lg">
                              <div className="flex items-center gap-3 mb-2">
                                <Clock className="h-5 w-5 text-primary" />
                                <div className="font-medium">
                                  {classProgress.nextClassDate.toLocaleDateString(undefined, {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </div>
                              </div>
                              <div className="pl-8 text-sm text-muted-foreground">
                                {classProgress.daysUntilNextClass} days remaining
                              </div>
                            </div>

                            <div>
                              <h4 className="text-sm font-medium mb-2">Preparation Tasks</h4>
                              <ul className="space-y-2">
                                <li className="flex items-start gap-2">
                                  <div className="rounded-full h-5 w-5 bg-primary/20 text-primary flex items-center justify-center text-xs mt-0.5">
                                    1
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium">Complete 10 puzzles</div>
                                    <div className="text-xs text-muted-foreground">Improve your tactical vision</div>
                                  </div>
                                </li>
                                <li className="flex items-start gap-2">
                                  <div className="rounded-full h-5 w-5 bg-primary/20 text-primary flex items-center justify-center text-xs mt-0.5">
                                    2
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium">Play 5 games</div>
                                    <div className="text-xs text-muted-foreground">Apply what you&apos;ve learned</div>
                                  </div>
                                </li>
                                <li className="flex items-start gap-2">
                                  <div className="rounded-full h-5 w-5 bg-primary/20 text-primary flex items-center justify-center text-xs mt-0.5">
                                    3
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium">Review previous class</div>
                                    <div className="text-xs text-muted-foreground">Reinforce key concepts</div>
                                  </div>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(LATEST_CLASS_URL, "_blank")}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Watch Previous Class
                      </Button>
                    </CardFooter>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center p-6">
                    <div className="text-center">
                      <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="games" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Games</CardTitle>
                  <CardDescription>Your latest chess matches on Chess.com</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentGames.length > 0 ? (
                    <div className="space-y-4">
                      {recentGames.map((game, index) => (
                        <div
                          key={index}
                          className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4 rounded-lg border"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant={
                                  game.result === "win"
                                    ? "default"
                                    : game.result === "draw"
                                      ? "secondary"
                                      : "destructive"
                                }
                              >
                                {game.resultText}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{game.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3 h-3 rounded-full ${game.playerColor === "white" ? "bg-white border border-gray-300" : "bg-black"}`}
                              ></div>
                              <span className="font-medium">vs {game.opponentUsername}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Time Control: {game.timeControl}</div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(game.url, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Game
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleReviewGame(game)}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Review Game
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-muted-foreground mb-2">No recent games found</div>
                      <Button variant="outline" size="sm" onClick={() => fetchRecentGames(username)}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Games
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["chess_rapid", "chess_blitz", "chess_bullet"].map((type) => {
                  const typedType = type as "chess_rapid" | "chess_blitz" | "chess_bullet"
                  const displayName =
                    type.replace("chess_", "").charAt(0).toUpperCase() + type.replace("chess_", "").slice(1)

                  return (
                    <Card key={type}>
                      <CardHeader>
                        <CardTitle>{displayName} Statistics</CardTitle>
                        <CardDescription>Detailed performance metrics</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium mb-1">Current Rating</div>
                            <div className="text-3xl font-bold">{stats?.[typedType]?.last.rating || "N/A"}</div>
                          </div>

                          <div>
                            <div className="text-sm font-medium mb-1">Best Rating</div>
                            <div className="text-xl font-semibold">
                              {stats?.[typedType]?.best?.rating || "N/A"}
                              {stats?.[typedType]?.best?.date && (
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                  on {new Date(stats?.[typedType]?.best?.date * 1000).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <Separator />
                          <div className="text-sm font-medium mb-3">Game Results</div>
                          <div className="h-[200px]">
                            <Pie
                              data={getWinRateData(typedType)}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: "bottom",
                                  },
                                },
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-sm text-muted-foreground">Wins</div>
                            <div className="text-lg font-semibold text-green-500">
                              {stats?.[typedType]?.record.win || 0}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Draws</div>
                            <div className="text-lg font-semibold text-yellow-500">
                              {stats?.[typedType]?.record.draw || 0}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Losses</div>
                            <div className="text-lg font-semibold text-red-500">
                              {stats?.[typedType]?.record.loss || 0}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="polls" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Polls</CardTitle>
                  <CardDescription>Vote and view poll results</CardDescription>
                </CardHeader>
                <CardContent>
                  {activePolls.length > 0 ? (
                    <div className="space-y-6">
                      {activePolls.map((poll) => (
                        <Card key={poll.id} className="border-primary/20">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-xl">{poll.question}</CardTitle>
                                <CardDescription>
                                  Created {new Date(poll.created_at).toLocaleDateString()}
                                </CardDescription>
                              </div>
                              {poll.type && (
                                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                                  {poll.type === "quiz" ? "Quiz" : "Poll"}
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            {poll.options && Object.keys(poll.options).length > 0 ? (
                              <div className="space-y-4">
                                {Object.entries(poll.options).map(([optionKey, optionText]) => {
                                  // Count votes for this option
                                  const voteCount = Object.values(poll.votes || {}).filter(
                                    (v) => v === optionKey,
                                  ).length
                                  const totalVotes = Object.keys(poll.votes || {}).length
                                  const percentage = totalVotes ? (voteCount / totalVotes) * 100 : 0

                                  return (
                                    <div key={optionKey} className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <span className="font-medium">{optionText}</span>
                                        <span className="text-sm text-muted-foreground">
                                          {voteCount} votes ({percentage.toFixed(1)}%)
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <Progress value={percentage} className="h-2 flex-1" />
                                        {!hasVoted[poll.id] && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleVote(poll.id, optionKey)}
                                          >
                                            Vote
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground">
                                No options available for this poll
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No active polls at the moment</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
