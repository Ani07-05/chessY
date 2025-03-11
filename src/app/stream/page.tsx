"use client"

import { Badge } from "@/components/ui/badge"

import { useState, useEffect, useRef } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"
import { motion } from "framer-motion"
import {
  BarChart3,
  Eye,
  ExternalLink,
  LineChart,
  Loader2,
  LogOut,
  PieChart,
  Plus,
  Presentation,
  Radio,
  RefreshCw,
  Trash2,
  Trophy,
  Users,
  Video,
  X,
  Youtube,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// Interfaces
interface Poll {
  id: string
  question: string
  options: Record<string, string>
  active: boolean
  created_at: string
  votes: Record<string, string>
  voters?: Record<string, { timestamp: number; option: string; name: string; email: string }>
  created_by: string
  ended_by?: string
  type?: "regular" | "quiz"
}

interface NewPoll {
  question: string
  options: Record<string, string>
  type: "regular" | "quiz"
}

interface StreamStats {
  totalUsers: number
  activePolls: number
  totalVotes: number
  viewerCount: number
}

export default function StreamPage() {
  // State Variables
  const [totalUsers, setTotalUsers] = useState<number>(0)
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [newPoll, setNewPoll] = useState<NewPoll>({
    question: "",
    options: { "0": "", "1": "" },
    type: "regular",
  })
  const [activePolls, setActivePolls] = useState<Poll[]>([])
  const [pollError, setPollError] = useState<string>("")
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false)
  const [password, setPassword] = useState<string>("")
  const [fetchError, setFetchError] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [authType, setAuthType] = useState<"admin" | "user">("admin")
  const [email, setEmail] = useState("")
  const [chessUsername, setChessUsername] = useState("")
  const [activeTab, setActiveTab] = useState("dashboard")
  const [streamStats, setStreamStats] = useState<StreamStats>({
    totalUsers: 0,
    activePolls: 0,
    totalVotes: 0,
    viewerCount: 0,
  })
  const [isCreatingPoll, setIsCreatingPoll] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [streamDuration, setStreamDuration] = useState(0)
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null)
  const viewerCounterRef = useRef<NodeJS.Timeout | null>(null)
  const [isPresentingPPT, setIsPresentingPPT] = useState(false)

  const YOUTUBE_STUDIO_URL = "https://studio.youtube.com/channel/UCsHvluagayXmciRIsWimHOQ/livestreaming"
  const PRESENTATION_URL = "http://localhost:3000"

  const supabase = createClientComponentClient<Database>()

  // Initialization with useEffect
  useEffect(() => {
    if (localStorage.getItem("stream_authorized") === "true") {
      setIsAuthorized(true)
      setAuthType("admin")
    }

    const initializeApp = async () => {
      await fetchStats()
      await fetchActivePolls()
      setIsLoading(false)
    }

    initializeApp()

    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current)
      if (viewerCounterRef.current) clearInterval(viewerCounterRef.current)
    }
  }, [])

  // Stream timer effect
  useEffect(() => {
    if (isStreaming) {
      streamTimerRef.current = setInterval(() => {
        setStreamDuration((prev) => prev + 1)
      }, 1000)

      // Simulate viewer count changes - in a real app, this would be replaced with YouTube API data
      viewerCounterRef.current = setInterval(() => {
        setViewerCount((prev) => {
          const change = Math.floor(Math.random() * 5) - 2
          return Math.max(0, prev + change)
        })
      }, 5000)
    } else {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current)
      if (viewerCounterRef.current) clearInterval(viewerCounterRef.current)
    }

    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current)
      if (viewerCounterRef.current) clearInterval(viewerCounterRef.current)
    }
  }, [isStreaming])

  // Format stream duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`
  }

  // Database Functions
  const fetchStats = async () => {
    try {
      // Get total users from users table
      const { count: userCount, error: userError } = await supabase.from("users").select("*", { count: "exact" })

      if (!userError) {
        setTotalUsers(userCount || 0)
        // Update stream stats without visits
        setStreamStats({
          totalUsers: userCount || 0,
          activePolls: activePolls.length,
          totalVotes: activePolls.reduce((acc, poll) => acc + Object.keys(poll.votes || {}).length, 0),
          viewerCount: viewerCount,
        })
      } else {
        console.error("Error fetching user count:", userError)
      }

      // Set initial viewer count (random between 10-50)
      setViewerCount(Math.floor(Math.random() * 40) + 10)

      // Update stream stats
      setStreamStats({
        totalUsers: userCount || 0,
        activePolls: activePolls.length,
        totalVotes: activePolls.reduce((acc, poll) => acc + Object.keys(poll.votes || {}).length, 0),
        viewerCount: viewerCount,
      })
    } catch (err) {
      console.error("Error fetching stats:", err)
    }
  }

  const fetchActivePolls = async () => {
    try {
      setFetchError("")

      const { data, error } = await supabase
        .from("polls")
        .select("id, question, options, active, created_at, votes, created_by, type, voters")
        .eq("active", true)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Database error:", error)
        throw new Error(`Database error: ${error.message}`)
      }

      if (data) {
        const parsedPolls = data.map((poll) => {
          let parsedOptions: Record<string, string> = {}
          let parsedVotes: Record<string, string> = {}
          let parsedVoters: Record<string, { timestamp: number; option: string; name: string; email: string }> = {}

          try {
            // Handle different formats of options
            if (typeof poll.options === "string") {
              parsedOptions = JSON.parse(poll.options)
            } else if (poll.options && typeof poll.options === "object") {
              parsedOptions = poll.options
            }
          } catch (e) {
            console.error("Error parsing options for poll:", poll.id, e)
            parsedOptions = {}
          }

          try {
            // Handle different formats of votes
            if (typeof poll.votes === "string") {
              parsedVotes = JSON.parse(poll.votes)
            } else if (poll.votes && typeof poll.votes === "object") {
              parsedVotes = poll.votes
            }
          } catch (e) {
            console.error("Error parsing votes for poll:", poll.id, e)
            parsedVotes = {}
          }

          try {
            // Handle different formats of voters
            if (typeof poll.voters === "string") {
              parsedVoters = JSON.parse(poll.voters)
            } else if (poll.voters && typeof poll.voters === "object") {
              parsedVoters = poll.voters
            }
          } catch (e) {
            console.error("Error parsing voters for poll:", poll.id, e)
            parsedVoters = {}
          }

          return {
            ...poll,
            options: parsedOptions,
            votes: parsedVotes,
            voters: parsedVoters,
          }
        })

        setActivePolls(parsedPolls)
      }

      // Update stream stats
      setStreamStats((prev) => ({
        ...prev,
        activePolls: data?.length || 0,
        totalVotes: data?.reduce((acc, poll) => acc + Object.keys(poll.votes || {}).length, 0) || 0,
      }))
    } catch (err: any) {
      console.error("Error details:", err)
      setFetchError(err.message || "Failed to fetch polls")
      setActivePolls([])
    }
  }

  // Stream Control Functions
  const handleStartStream = () => {
    setIsStreaming(true)
    setStreamDuration(0)
    toast.success("Stream started successfully")
    window.open(YOUTUBE_STUDIO_URL, "_blank")
  }

  const handleStopStream = () => {
    setIsStreaming(false)
    setStreamDuration(0)
    toast.success("Stream ended successfully")
  }

  const handlePresentPPT = () => {
    setIsPresentingPPT(true)
    window.open(PRESENTATION_URL, "_blank")
    toast.success("Presentation mode activated")
  }

  const handleStopPresentation = () => {
    setIsPresentingPPT(false)
    toast.success("Presentation mode deactivated")
  }

  // Poll Creation Functions
  const handleAddOption = () => {
    setNewPoll((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        [Object.keys(prev.options).length.toString()]: "",
      },
    }))
  }

  const handleRemoveOption = (keyToRemove: string) => {
    if (Object.keys(newPoll.options).length <= 2) {
      toast.error("A poll must have at least 2 options")
      return
    }

    const updatedOptions: Record<string, string> = {}
    let newIndex = 0

    // Rebuild options object without the removed option
    Object.entries(newPoll.options).forEach(([key, value]) => {
      if (key !== keyToRemove) {
        updatedOptions[newIndex.toString()] = value
        newIndex++
      }
    })

    setNewPoll((prev) => ({
      ...prev,
      options: updatedOptions,
    }))
  }

  const handleCreatePoll = async () => {
    try {
      setPollError("")
      setIsCreatingPoll(true)

      if (!newPoll.question.trim()) {
        setPollError("Question is required")
        toast.error("Question is required")
        return
      }

      const validOptions = Object.fromEntries(
        Object.entries(newPoll.options).filter(([_, value]) => value.trim() !== ""),
      )

      if (Object.keys(validOptions).length < 2) {
        setPollError("At least 2 valid options are required")
        toast.error("At least 2 valid options are required")
        return
      }

      const { data, error } = await supabase
        .from("polls")
        .insert([
          {
            question: newPoll.question.trim(),
            options: validOptions,
            active: true,
            votes: {},
            created_by: email || "admin",
            type: newPoll.type,
          },
        ])
        .select()

      if (error) {
        console.error("Poll creation error:", error)
        setPollError(error.message || "Failed to create poll")
        toast.error("Failed to create poll: " + error.message)
        return
      }

      setNewPoll({ question: "", options: { "0": "", "1": "" }, type: "regular" })
      await fetchActivePolls()
      toast.success("Poll created successfully")
    } catch (err: any) {
      console.error("Error creating poll:", err)
      setPollError(err.message || "Failed to create poll")
      toast.error("Error creating poll: " + err.message)
    } finally {
      setIsCreatingPoll(false)
    }
  }

  const handleEndPoll = async (pollId: string) => {
    try {
      setPollError("")
      const { error } = await supabase
        .from("polls")
        .update({
          active: false,
          ended_by: email || "admin",
        })
        .eq("id", pollId)

      if (error) {
        console.error("Error ending poll:", error)
        setPollError(error.message)
        toast.error("Failed to end poll: " + error.message)
        return
      }

      await fetchActivePolls()
      toast.success("Poll ended successfully")
    } catch (err: any) {
      console.error("Error ending poll:", err)
      setPollError(err.message)
      toast.error("Error ending poll: " + err.message)
    }
  }

  const handleVote = async (pollId: string, optionId: string, userId: string) => {
    try {
      // First, get the current poll data
      const { data: pollData, error: fetchError } = await supabase
        .from("polls")
        .select("votes, voters")
        .eq("id", pollId)
        .single()

      if (fetchError) throw fetchError

      // Update votes
      const updatedVotes = { ...(pollData.votes || {}) }
      updatedVotes[userId] = optionId

      // Update voters with timestamp
      const updatedVoters = { ...(pollData.voters || {}) }
      updatedVoters[userId] = {
        timestamp: Date.now(),
        option: optionId,
      }

      // Save both updates to the database
      const { error: updateError } = await supabase
        .from("polls")
        .update({
          votes: updatedVotes,
          voters: updatedVoters,
        })
        .eq("id", pollId)

      if (updateError) throw updateError

      // Success handling
      toast.success("Vote recorded successfully!")
      await fetchActivePolls() // Refresh the polls
    } catch (error) {
      console.error("Error recording vote:", error)
      toast.error("Failed to record your vote")
    }
  }

  // Authentication Functions
  const handleAuth = async () => {
    if (authType === "admin") {
      if (password === "ChessY@2025") {
        setIsAuthorized(true)
        localStorage.setItem("stream_authorized", "true")
        toast.success("Admin access granted")
      } else {
        setPollError("Incorrect admin password")
        toast.error("Incorrect admin password")
      }
    } else {
      try {
        setPollError("") // Clear any existing errors

        if (!email || !password || !chessUsername) {
          setPollError("All fields are required")
          toast.error("All fields are required")
          return
        }

        // First check if user exists
        const { data: existingUser, error: checkError } = await supabase
          .from("users")
          .select("*")
          .eq("email", email.toLowerCase().trim())
          .maybeSingle()

        if (checkError) {
          console.error("Error checking user:", checkError)
          setPollError("Error checking user account")
          toast.error("Error checking user account")
          return
        }

        if (existingUser) {
          // Existing user login
          if (existingUser.password === password) {
            setIsAuthorized(true)
            localStorage.setItem("user_auth", JSON.stringify(existingUser))
            toast.success("Login successful")

            // Update chess username if different
            if (existingUser.chess_username !== chessUsername) {
              await handleUpdateChessUsername()
            }
          } else {
            setPollError("Incorrect password")
            toast.error("Incorrect password")
          }
        } else {
          // New user registration
          const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert([
              {
                email: email.toLowerCase().trim(),
                password,
                chess_username: chessUsername.trim(),
              },
            ])
            .select()
            .single()

          if (insertError) {
            console.error("Error creating user:", insertError)
            setPollError(insertError.message)
            toast.error("Error creating user: " + insertError.message)
            return
          }

          setIsAuthorized(true)
          localStorage.setItem("user_auth", JSON.stringify(newUser))
          toast.success("Account created successfully")
        }
      } catch (err: any) {
        console.error("Auth error:", err)
        setPollError(err.message || "An error occurred during authentication")
        toast.error("Authentication error: " + err.message)
      }
    }
  }

  const handleUpdateChessUsername = async () => {
    try {
      setPollError("")
      if (!chessUsername.trim()) {
        setPollError("Chess.com username is required")
        toast.error("Chess.com username is required")
        return
      }

      const { data, error } = await supabase
        .from("users")
        .update({ chess_username: chessUsername.trim() })
        .eq("email", email)
        .select()
        .single()

      if (error) {
        console.error("Update error:", error)
        setPollError(error.message)
        toast.error("Update error: " + error.message)
        return
      }

      localStorage.setItem("user_auth", JSON.stringify(data))
      toast.success("Username updated successfully!")
    } catch (err: any) {
      console.error("Chess.com username update error:", err)
      setPollError(err.message)
      toast.error("Update error: " + err.message)
    }
  }

  const handleLogout = () => {
    setIsAuthorized(false)
    localStorage.removeItem("stream_authorized")
    localStorage.removeItem("user_auth")
    setEmail("")
    setPassword("")
    setChessUsername("")
    toast.success("Logged out successfully")
  }

  // UI Rendering
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black p-8 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-zinc-900/90 backdrop-blur-sm p-8 rounded-xl border border-zinc-800 max-w-md w-full shadow-2xl"
        >
          <div className="flex items-center justify-center mb-6">
            <Trophy className="h-10 w-10 text-white mr-3" />
            <h1 className="text-3xl font-bold text-white">Chess ERP</h1>
          </div>

          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {authType === "admin" ? "Admin Access" : "User Login"}
          </h2>

          <button
            onClick={() => setAuthType(authType === "admin" ? "user" : "admin")}
            className="text-blue-400 mb-4 text-sm hover:text-blue-300 transition-colors"
          >
            Switch to {authType === "admin" ? "User Login" : "Admin Access"}
          </button>

          {pollError && (
            <div className="text-red-400 text-sm mb-4 bg-red-900/20 p-3 rounded border border-red-800/50">
              {pollError}
            </div>
          )}

          <div className="space-y-4">
            {authType === "user" && (
              <>
                <div>
                  <Label className="text-zinc-300 mb-2">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300 mb-2">Chess.com Username</Label>
                  <Input
                    type="text"
                    value={chessUsername}
                    onChange={(e) => setChessUsername(e.target.value)}
                    className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  />
                </div>
              </>
            )}
            <div>
              <Label className="text-zinc-300 mb-2">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                onKeyPress={(e) => e.key === "Enter" && handleAuth()}
              />
            </div>
            <Button onClick={handleAuth} className="w-full bg-white text-black hover:bg-zinc-200 transition-colors">
              {authType === "admin" ? "Access Stream" : "Login"}
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  const exportVoterData = (poll: Poll) => {
    try {
      // Create CSV content
      let csvContent = "Voter,Email,Option\n"

      Object.entries(poll.voters || {}).forEach(([_, voter]) => {
        const optionText = poll.options[voter.option] || "Unknown option"
        csvContent += `${voter.name || "Anonymous"},${voter.email || "No email"},${optionText}\n`
      })

      // Create a blob and download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `poll-voters-${poll.id}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("Voter data exported successfully")
    } catch (error) {
      console.error("Error exporting voter data:", error)
      toast.error("Failed to export voter data")
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-white mr-1" />
            <span className="font-bold text-xl">Chess ERP Stream</span>
          </div>

          <div className="flex items-center gap-4">
            {isStreaming && (
              <div className="flex items-center">
                <div className="animate-pulse mr-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500"></div>
                </div>
                <span className="text-sm font-medium">LIVE</span>
                <span className="mx-2 text-zinc-500">•</span>
                <span className="text-sm">{formatDuration(streamDuration)}</span>
                <span className="mx-2 text-zinc-500">•</span>
                <div className="flex items-center">
                  <Eye className="h-4 w-4 mr-1 text-zinc-400" />
                  <span className="text-sm">{viewerCount}</span>
                </div>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-zinc-800">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-between items-center">
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-white data-[state=active]:text-black">
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="stream" className="data-[state=active]:bg-white data-[state=active]:text-black">
                Stream Control
              </TabsTrigger>
              <TabsTrigger value="polls" className="data-[state=active]:bg-white data-[state=active]:text-black">
                Polls
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchStats()
                  fetchActivePolls()
                }}
                className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardDescription className="text-zinc-400">Total Users</CardDescription>
                  <CardTitle className="text-3xl text-white">{totalUsers}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-zinc-400">Registered chess players</div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardDescription className="text-zinc-400">Active Polls</CardDescription>
                  <CardTitle className="text-3xl text-white">{activePolls.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-zinc-400">Currently running polls</div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardDescription className="text-zinc-400">Total Votes</CardDescription>
                  <CardTitle className="text-3xl text-white">
                    {activePolls.reduce((acc, poll) => acc + Object.keys(poll.votes || {}).length, 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-zinc-400">Across all active polls</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white">Stream Analytics</CardTitle>
                  <CardDescription>Viewer engagement over time</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <LineChart className="h-16 w-16 text-zinc-500 mx-auto" />
                    <p className="text-zinc-400">
                      {isStreaming ? "Collecting stream analytics..." : "Start streaming to collect viewer analytics"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white">Poll Engagement</CardTitle>
                  <CardDescription>Participation by poll</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <PieChart className="h-16 w-16 text-zinc-500 mx-auto" />
                    <p className="text-zinc-400">
                      {activePolls.length > 0
                        ? "Analyzing poll engagement..."
                        : "Create polls to see engagement metrics"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Recent Activity</CardTitle>
                <CardDescription>Latest events from your stream</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isStreaming ? (
                    <>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                        <div className="bg-white/10 p-2 rounded-full">
                          <Video className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Stream started</p>
                          <p className="text-sm text-zinc-400">
                            Stream has been running for {formatDuration(streamDuration)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                        <div className="bg-green-500/10 p-2 rounded-full">
                          <Users className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Viewers joined</p>
                          <p className="text-sm text-zinc-400">Current viewer count: {viewerCount}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                      <div className="bg-zinc-700/50 p-2 rounded-full">
                        <Video className="h-5 w-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Stream offline</p>
                        <p className="text-sm text-zinc-400">Start streaming to see activity</p>
                      </div>
                    </div>
                  )}

                  {activePolls.slice(0, 2).map((poll) => (
                    <div key={poll.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                      <div className="bg-blue-500/10 p-2 rounded-full">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Poll created: {poll.question}</p>
                        <p className="text-sm text-zinc-400">{Object.keys(poll.votes || {}).length} votes received</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stream" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white">Stream Control</CardTitle>
                  <CardDescription>Manage your live chess stream</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="w-full md:w-2/3 aspect-video bg-black rounded-lg border border-zinc-800 flex items-center justify-center overflow-hidden">
                      {isStreaming ? (
                        <div className="relative w-full h-full">
                          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black opacity-50"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="flex items-center justify-center mb-4">
                                <div className="h-4 w-4 bg-red-500 rounded-full animate-pulse mr-2"></div>
                                <span className="text-xl font-bold text-white">LIVE</span>
                              </div>
                              <p className="text-zinc-300">Stream is active and running</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-4 bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                                onClick={() => window.open(YOUTUBE_STUDIO_URL, "_blank")}
                              >
                                <Youtube className="h-4 w-4 mr-2" />
                                Open YouTube Studio
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-6">
                          <Youtube className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                          <p className="text-zinc-400 mb-2">Ready to start streaming</p>
                          <p className="text-xs text-zinc-500 max-w-md mx-auto mb-4">
                            When you start streaming, you'll be redirected to YouTube Studio to configure your live
                            stream settings
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="w-full md:w-1/3 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Stream Status</Label>
                        <div className="flex items-center">
                          <div
                            className={`h-3 w-3 rounded-full ${isStreaming ? "bg-red-500" : "bg-zinc-500"} mr-2`}
                          ></div>
                          <span>{isStreaming ? "Live" : "Offline"}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-zinc-300">Duration</Label>
                        <div className="font-mono text-xl">{formatDuration(streamDuration)}</div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-zinc-300">Viewers</Label>
                        <div className="text-xl">{viewerCount}</div>
                      </div>

                      {isStreaming ? (
                        <Button
                          onClick={handleStopStream}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors duration-200"
                        >
                          Stop Stream
                        </Button>
                      ) : (
                        <Button
                          onClick={handleStartStream}
                          className="w-full bg-white hover:bg-zinc-100 text-black font-bold py-4 px-8 rounded-lg text-lg transition-colors duration-200"
                        >
                          Start Stream
                        </Button>
                      )}

                      {isPresentingPPT ? (
                        <Button
                          onClick={handleStopPresentation}
                          className="w-full bg-zinc-700 hover:bg-zinc-600 text-white"
                        >
                          Stop Presentation
                        </Button>
                      ) : (
                        <Button
                          onClick={handlePresentPPT}
                          variant="outline"
                          className="w-full border-zinc-700 text-white hover:bg-zinc-800"
                        >
                          <Presentation className="h-4 w-4 mr-2" />
                          Present Slides
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white">Stream Information</CardTitle>
                  <CardDescription>Details about your current stream</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Stream Title</Label>
                    <Input
                      type="text"
                      placeholder="Chess Lesson: Opening Strategies"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-300">Stream Description</Label>
                    <textarea
                      className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white min-h-[100px]"
                      placeholder="Join us for an interactive chess lesson where we'll cover essential opening strategies for beginners and intermediate players."
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-300">Chat Moderation</Label>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-300">Record Stream</Label>
                    <Switch defaultChecked />
                  </div>

                  <div className="pt-4">
                    <Button
                      variant="outline"
                      className="w-full border-zinc-700 text-white hover:bg-zinc-800"
                      onClick={() => window.open(YOUTUBE_STUDIO_URL, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Advanced Settings in YouTube Studio
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="polls" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white">Active Polls</CardTitle>
                    <CardDescription>Manage your current polls</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activePolls.length > 0 ? (
                      <div className="space-y-6">
                        {activePolls.map((poll) => (
                          <Card key={poll.id} className="bg-zinc-800 border-zinc-700">
                            <CardHeader className="pb-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-white">{poll.question}</CardTitle>
                                  <CardDescription>
                                    Created {new Date(poll.created_at).toLocaleString()}
                                  </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-white/10 text-white border-white/20">
                                    {poll.type === "quiz" ? "Quiz" : "Regular Poll"}
                                  </Badge>
                                  {authType === "admin" && (
                                    <div className="flex items-center gap-1">
                                      <Label htmlFor={`show-voters-${poll.id}`} className="text-xs text-zinc-400">
                                        Show voters
                                      </Label>
                                      <Switch
                                        id={`show-voters-${poll.id}`}
                                        className="data-[state=checked]:bg-blue-500"
                                        onCheckedChange={(checked) => {
                                          const pollsElement = document.getElementById(`poll-voters-${poll.id}`)
                                          if (pollsElement) {
                                            pollsElement.style.display = checked ? "block" : "none"
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                              <div className="space-y-3">
                                {Object.entries(poll.options).map(([key, value]) => {
                                  // Count votes for this option
                                  const voteCount = Object.values(poll.votes || {}).filter((v) => v === key).length
                                  const totalVotes = Object.keys(poll.votes || {}).length
                                  const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0

                                  return (
                                    <div key={key} className="space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-white">{value}</span>
                                        <span className="text-zinc-400">
                                          {voteCount} votes ({percentage.toFixed(1)}%)
                                        </span>
                                      </div>
                                      <div className="w-full bg-zinc-700 rounded-full h-2">
                                        <div
                                          className="bg-white h-2 rounded-full"
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                      {/* Voter details section - only visible to admin */}
                                      {authType === "admin" && voteCount > 0 && (
                                        <div
                                          id={`poll-voters-${poll.id}`}
                                          className="mt-2 pl-2 border-l-2 border-zinc-700"
                                          style={{ display: "none" }}
                                        >
                                          <p className="text-xs text-zinc-400 mb-1">Voters:</p>
                                          <div className="space-y-1 max-h-24 overflow-y-auto pr-2">
                                            {Object.entries(poll.votes || {})
                                              .filter(([_, vote]) => vote === key)
                                              .sort((a, b) => {
                                                // Get user data for sorting by time
                                                const userA = poll.voters?.[a[0]]?.timestamp || 0
                                                const userB = poll.voters?.[b[0]]?.timestamp || 0
                                                return userB - userA // Sort by most recent first
                                              })
                                              .map(async ([voterId, _]) => {
                                                // Get user data from users table
                                                const { data: userData } = await supabase
                                                  .from("users")
                                                  .select("chess_username, created_at")
                                                  .eq("id", voterId)
                                                  .single()

                                                return (
                                                  <div
                                                    key={voterId}
                                                    className="text-xs flex justify-between bg-zinc-700/30 p-1 rounded"
                                                  >
                                                    <span className="text-zinc-300">
                                                      {userData?.chess_username || "Anonymous"}
                                                    </span>
                                                    <span className="text-zinc-400">
                                                      {new Date(
                                                        userData?.created_at || Date.now(),
                                                      ).toLocaleTimeString()}
                                                    </span>
                                                  </div>
                                                )
                                              })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                              {authType === "admin" && Object.keys(poll.voters || {}).length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => exportVoterData(poll)}
                                  className="text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                                >
                                  Export Voter Data
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleEndPoll(poll.id)}
                                className={authType === "admin" ? "" : "ml-auto"}
                              >
                                <X className="h-4 w-4 mr-2" />
                                End Poll
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 border border-dashed border-zinc-700 rounded-lg">
                        <Radio className="h-12 w-12 text-zinc-500 mx-auto mb-4" />
                        <h3 className="text-xl font-medium text-zinc-300 mb-2">No active polls</h3>
                        <p className="text-zinc-400 mb-4">Create a new poll to engage with your audience</p>
                        <Button onClick={() => setActiveTab("polls")} className="bg-white text-black hover:bg-zinc-100">
                          Create Poll
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="bg-zinc-900 border-zinc-800 sticky top-24">
                  <CardHeader>
                    <CardTitle className="text-white">Create New Poll</CardTitle>
                    <CardDescription>Engage with your audience</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pollError && (
                      <div className="text-red-400 text-sm mb-4 bg-red-900/20 p-3 rounded border border-red-800/50">
                        {pollError}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-zinc-300">Poll Type</Label>
                      <div className="flex space-x-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="regular"
                            name="pollType"
                            checked={newPoll.type === "regular"}
                            onChange={() => setNewPoll((prev) => ({ ...prev, type: "regular" }))}
                            className="text-white"
                          />
                          <Label htmlFor="regular" className="text-zinc-300">
                            Regular Poll
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="quiz"
                            name="pollType"
                            checked={newPoll.type === "quiz"}
                            onChange={() => setNewPoll((prev) => ({ ...prev, type: "quiz" }))}
                            className="text-white"
                          />
                          <Label htmlFor="quiz" className="text-zinc-300">
                            Quiz
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-300">Question</Label>
                      <Input
                        type="text"
                        placeholder="Enter poll question"
                        value={newPoll.question}
                        onChange={(e) => setNewPoll((prev) => ({ ...prev, question: e.target.value }))}
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-zinc-300">Options</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddOption}
                          className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Option
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {Object.entries(newPoll.options).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <Input
                              type="text"
                              placeholder={`Option ${Number.parseInt(key) + 1}`}
                              value={value}
                              onChange={(e) =>
                                setNewPoll((prev) => ({
                                  ...prev,
                                  options: { ...prev.options, [key]: e.target.value },
                                }))
                              }
                              className="bg-zinc-800 border-zinc-700 text-white"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveOption(key)}
                              className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleCreatePoll}
                      disabled={isCreatingPoll}
                      className="w-full bg-white hover:bg-zinc-100 text-black"
                    >
                      {isCreatingPoll ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Poll"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

