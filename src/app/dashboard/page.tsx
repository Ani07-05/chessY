"use client";

import { useState, useEffect, useCallback } from "react";
import { Chart as ChartJS } from 'chart.js/auto';
import { Line, Pie, Bar } from "react-chartjs-2";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronDown, ChevronUp, Clock, ExternalLink, Play, RefreshCw, Trophy, Users } from 'lucide-react';
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { UserNav } from "@/components/user-nav";
import { ThemeSwitcher } from "@/components/theme-switcher";

// Configure chart defaults
ChartJS.defaults.responsive = true;
ChartJS.defaults.maintainAspectRatio = false;

interface ChessStats {
  chess_rapid?: {
    last: { rating: number };
    record: { win: number; loss: number; draw: number };
    best?: { rating: number; date: number };
  };
  chess_blitz?: {
    last: { rating: number };
    record: { win: number; loss: number; draw: number };
    best?: { rating: number; date: number };
  };
  chess_bullet?: {
    last: { rating: number };
    record: { win: number; loss: number; draw: number };
    best?: { rating: number; date: number };
  };
}

interface ClassProgress {
  gamesPlayed: number;
  gamesWon: number;
  gamesDrawn: number;
  gamesLost: number;
  levelProgress: number;
  lastClassDate: Date;
  nextClassDate: Date;
  daysUntilNextClass: number;
}

interface UserProfile {
  id: string;
  username: string;
  chessUsername: string;
  role: string;
  avatarUrl?: string;
  email?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { theme } = useTheme();
  const [stats, setStats] = useState<ChessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [classProgress, setClassProgress] = useState<ClassProgress | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");

  const FIRST_CLASS_DATE = new Date("2025-03-03");
  const CLASS_INTERVAL = 7; // days
  const LATEST_CLASS_URL = "https://youtu.be/VQgKSLkUNvQ?si=ptTZQqOEiYHxh_3P";

  const getNextClassDate = (fromDate: Date = new Date()): Date => {
    const nextDate = new Date(FIRST_CLASS_DATE);
    while (nextDate <= fromDate) {
      nextDate.setDate(nextDate.getDate() + CLASS_INTERVAL);
    }
    return nextDate;
  };

  const getLastClassDate = (fromDate: Date = new Date()): Date => {
    const lastDate = getNextClassDate(fromDate);
    lastDate.setDate(lastDate.getDate() - CLASS_INTERVAL);
    return lastDate;
  };

  const getDaysUntilNextClass = (nextClassDate: Date): number => {
    const now = new Date();
    const diffTime = nextClassDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const fetchUserProfile = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (!session) {
        router.push("/auth");
        return;
      }

      const { data: profile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (fetchError) throw fetchError;

      if (!profile) {
        // Create profile if it doesn't exist
        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: session.user.id,
              email: session.user.email,
              username: session.user.email?.split('@')[0] || 'User',
              chess_username: 'magnuscarlsen'
            }
          ])
          .select()
          .single();
        
        if (insertError) throw insertError;
        
        if (newProfile) {
          setUserProfile({
            id: newProfile.id,
            username: newProfile.username,
            chessUsername: newProfile.chess_username,
            role: 'user',
            email: newProfile.email,
            avatarUrl: newProfile.avatar_url
          });
          setUsername(newProfile.chess_username);
        }
      } else {
        setUserProfile({
          id: profile.id,
          username: profile.username || session.user.email?.split('@')[0] || 'User',
          chessUsername: profile.chess_username || 'magnuscarlsen',
          role: 'user',
          email: profile.email,
          avatarUrl: profile.avatar_url
        });
        setUsername(profile.chess_username || 'magnuscarlsen');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user profile');
    }
  };

  const fetchGameArchives = async (username: string): Promise<string[]> => {
    const response = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
    if (!response.ok) throw new Error("Failed to fetch game archives");
    const data = await response.json();
    return data.archives;
  };

  const fetchGamesForMonth = async (archiveUrl: string): Promise<any[]> => {
    const response = await fetch(archiveUrl);
    if (!response.ok) throw new Error("Failed to fetch monthly games");
    const data = await response.json();
    return data.games || [];
  };

  const fetchRecentGames = async (username: string) => {
    try {
      const archives = await fetchGameArchives(username);
      if (archives.length === 0) return [];
      
      // Get the most recent archive
      const latestArchiveUrl = archives[archives.length - 1];
      const games = await fetchGamesForMonth(latestArchiveUrl);
      
      // Sort by end time (most recent first) and take the 5 most recent games
      const sortedGames = games.sort((a: any, b: any) => b.end_time - a.end_time).slice(0, 5);
      
      // Process games to add result information
      const processedGames = sortedGames.map((game: any) => {
        const playerColor = game.white.username.toLowerCase() === username.toLowerCase() ? "white" : "black";
        const opponentColor = playerColor === "white" ? "black" : "white";
        const result = game[playerColor].result;
        
        return {
          ...game,
          playerColor,
          opponentColor,
          opponentUsername: game[opponentColor].username,
          result,
          resultText: result === "win" ? "Victory" : result === "draw" ? "Draw" : "Defeat",
          resultClass: result === "win" ? "text-green-500" : result === "draw" ? "text-yellow-500" : "text-red-500",
          date: new Date(game.end_time * 1000).toLocaleDateString(),
          time: new Date(game.end_time * 1000).toLocaleTimeString(),
          timeControl: game.time_control,
          url: game.url
        };
      });
      
      setRecentGames(processedGames);
    } catch (err) {
      console.error("Error fetching recent games:", err);
    }
  };

  const fetchClassProgress = async () => {
    try {
      if (!username) return;
      
      const lastClass = getLastClassDate();
      const nextClass = getNextClassDate();
      const daysUntilNext = getDaysUntilNextClass(nextClass);
      
      const archives = await fetchGameArchives(username);
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
            const playerColor = game.white.username.toLowerCase() === username.toLowerCase() ? "white" : "black";
            const result = game[playerColor].result;
            
            if (result === "win") gamesWon++;
            else if (result === "draw" || result === "stalemate") gamesDrawn++;
            else gamesLost++;
          }
        }
      }

      // Calculate level progress (example formula)
      const levelProgress = Math.min(100, (gamesWon * 15 + gamesDrawn * 5));

      setClassProgress({
        gamesPlayed,
        gamesWon,
        gamesDrawn,
        gamesLost,
        levelProgress,
        lastClassDate: lastClass,
        nextClassDate: nextClass,
        daysUntilNextClass: daysUntilNext
      });
    } catch (err) {
      console.error("Error fetching class progress:", err);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      await fetchUserProfile();
      if (username) {
        await Promise.all([
          fetchStats(),
          fetchClassProgress(),
          fetchRecentGames(username)
        ]);
      }
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    if (!username) return;
    
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
  };

  useEffect(() => {
    const videoId = getYouTubeVideoId(LATEST_CLASS_URL);
    if (videoId) {
      // Get high quality thumbnail
      setVideoPreviewUrl(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    }
  }, [LATEST_CLASS_URL]);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (username) {
      fetchStats();
      fetchClassProgress();
      fetchRecentGames(username);
    }
  }, [username]); // Removed fetchStats from dependencies

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
    );
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
    );
  }

  const getRatingChange = (type: 'chess_rapid' | 'chess_blitz' | 'chess_bullet') => {
    if (!stats || !stats[type]) return { value: 0, isPositive: false };
    
    // This is a placeholder since we don't have historical data
    // In a real app, you'd compare with previous ratings from your database
    const change = Math.floor(Math.random() * 30) - 15; // Random number between -15 and 15
    return {
      value: Math.abs(change),
      isPositive: change >= 0
    };
  };

  const getWinRateData = (type: 'chess_rapid' | 'chess_blitz' | 'chess_bullet') => {
    const record = stats?.[type]?.record;
    const emptyData = {
      labels: ['Wins', 'Losses', 'Draws'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(234, 179, 8, 0.8)'
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(234, 179, 8, 1)'
        ],
        borderWidth: 2
      }]
    };

    if (!record) return emptyData;

    return {
      labels: ['Wins', 'Losses', 'Draws'],
      datasets: [
        {
          data: [record.win, record.loss, record.draw],
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(234, 179, 8, 0.8)'
          ],
          borderColor: [
            'rgba(34, 197, 94, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(234, 179, 8, 1)'
          ],
          borderWidth: 2
        }
      ]
    };
  };

  const getWinRatePercentage = (type: 'chess_rapid' | 'chess_blitz' | 'chess_bullet') => {
    const record = stats?.[type]?.record;
    if (!record) return 0;
    
    const total = record.win + record.loss + record.draw;
    if (total === 0) return 0;
    
    return Math.round((record.win / total) * 100);
  };

  const ratingsData = {
    labels: ['Rapid', 'Blitz', 'Bullet'],
    datasets: [
      {
        label: 'Ratings',
        data: [
          stats?.chess_rapid?.last.rating || 0,
          stats?.chess_blitz?.last.rating || 0,
          stats?.chess_bullet?.last.rating || 0
        ],
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }
    ]
  };

  const activityData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Games Played',
        data: [3, 5, 2, 8, 4, 7, 6],
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 4,
      }
    ]
  };

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
                  await supabase.auth.signOut();
                  router.push("/auth");
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
            <p className="text-muted-foreground">
              Welcome back, {userProfile?.username || "Chess Player"}!
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshData}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            
            {isSuperAdmin && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => router.push("/analytics")}
              >
                <Users className="h-4 w-4 mr-2" />
                Analytics
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
                  <Button 
                    size="lg" 
                    className="gap-2 text-lg"
                    onClick={() => window.open(LATEST_CLASS_URL, "_blank")}
                  >
                    <Play className="h-5 w-5" />
                    Watch Now
                  </Button>
                </div>
                <div className="relative w-full md:w-2/5 aspect-video rounded-lg overflow-hidden shadow-xl group cursor-pointer"
                     onClick={() => window.open(LATEST_CLASS_URL, "_blank")}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10" />
                  {videoPreviewUrl ? (
                    <img 
                      src={videoPreviewUrl} 
                      alt="Chess class thumbnail" 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className={`w-full h-full ${theme === 'dark' ? 'chess-pattern-dark' : 'chess-pattern-light'}`}>
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
                      <img 
                        src="/chess.svg" 
                        alt="Chess pattern" 
                        className="w-full h-full object-cover"
                      />
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
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["chess_rapid", "chess_blitz", "chess_bullet"].map((type) => {
                  const typedType = type as 'chess_rapid' | 'chess_blitz' | 'chess_bullet';
                  const ratingChange = getRatingChange(typedType);
                  const displayName = type.replace('chess_', '').charAt(0).toUpperCase() + type.replace('chess_', '').slice(1);
                  
                  return (
                    <Card key={type} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle>{displayName} Rating</CardTitle>
                        <CardDescription>
                          Current performance in {displayName.toLowerCase()} games
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-end">
                          <div>
                            <div className="text-3xl font-bold">
                              {stats?.[typedType]?.last.rating || "N/A"}
                            </div>
                            <div className="flex items-center mt-1">
                              {ratingChange.isPositive ? (
                                <ChevronUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-red-500" />
                              )}
                              <span className={ratingChange.isPositive ? "text-green-500" : "text-red-500"}>
                                {ratingChange.value} pts
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Win Rate</div>
                            <div className="text-xl font-semibold">
                              {getWinRatePercentage(typedType)}%
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Rating Comparison</CardTitle>
                    <CardDescription>
                      Compare your ratings across different time controls
                    </CardDescription>
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
                              display: false
                            }
                          }
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Activity</CardTitle>
                    <CardDescription>
                      Your chess games played this week
                    </CardDescription>
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
                              display: false
                            }
                          }
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
                    <CardDescription>
                      Prepare for your upcoming chess lesson
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-4">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {classProgress.nextClassDate.toLocaleDateString(undefined, { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
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
                          <div className="text-xs text-muted-foreground">
                            {classProgress.levelProgress}% complete
                          </div>
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
                                <Progress value={classProgress.gamesWon / (classProgress.gamesPlayed || 1) * 100} className="h-2" />
                                <span className="text-sm font-medium">{Math.round(classProgress.gamesWon / (classProgress.gamesPlayed || 1) * 100)}%</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Draw Rate</div>
                              <div className="flex items-center gap-2">
                                <Progress value={classProgress.gamesDrawn / (classProgress.gamesPlayed || 1) * 100} className="h-2" />
                                <span className="text-sm font-medium">{Math.round(classProgress.gamesDrawn / (classProgress.gamesPlayed || 1) * 100)}%</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Loss Rate</div>
                              <div className="flex items-center gap-2">
                                <Progress value={classProgress.gamesLost / (classProgress.gamesPlayed || 1) * 100} className="h-2" />
                                <span className="text-sm font-medium">{Math.round(classProgress.gamesLost / (classProgress.gamesPlayed || 1) * 100)}%</span>
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
                                <div className="font-medium">{classProgress.nextClassDate.toLocaleDateString(undefined, { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}</div>
                              </div>
                              <div className="pl-8 text-sm text-muted-foreground">
                                {classProgress.daysUntilNextClass} days remaining
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-medium mb-2">Preparation Tasks</h4>
                              <ul className="space-y-2">
                                <li className="flex items-start gap-2">
                                  <div className="rounded-full h-5 w-5 bg-primary/20 text-primary flex items-center justify-center text-xs mt-0.5">1</div>
                                  <div>
                                    <div className="text-sm font-medium">Complete 10 puzzles</div>
                                    <div className="text-xs text-muted-foreground">Improve your tactical vision</div>
                                  </div>
                                </li>
                                <li className="flex items-start gap-2">
                                  <div className="rounded-full h-5 w-5 bg-primary/20 text-primary flex items-center justify-center text-xs mt-0.5">2</div>
                                  <div>
                                    <div className="text-sm font-medium">Play 5 games</div>
                                    <div className="text-xs text-muted-foreground">Apply what you've learned</div>
                                  </div>
                                </li>
                                <li className="flex items-start gap-2">
                                  <div className="rounded-full h-5 w-5 bg-primary/20 text-primary flex items-center justify-center text-xs mt-0.5">3</div>
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
                  <CardDescription>
                    Your latest chess matches on Chess.com
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {recentGames.length > 0 ? (
                    <div className="space-y-4">
                      {recentGames.map((game, index) => (
                        <div key={index} className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4 rounded-lg border">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={game.result === "win" ? "default" : game.result === "draw" ? "secondary" : "destructive"}>
                                {game.resultText}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{game.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${game.playerColor === "white" ? "bg-white border border-gray-300" : "bg-black"}`}></div>
                              <span className="font-medium">vs {game.opponentUsername}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Time Control: {game.timeControl}
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="shrink-0"
                            onClick={() => window.open(game.url, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Game
                          </Button>
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
                  const typedType = type as 'chess_rapid' | 'chess_blitz' | 'chess_bullet';
                  const displayName = type.replace('chess_', '').charAt(0).toUpperCase() + type.replace('chess_', '').slice(1);
                  
                  return (
                    <Card key={type}>
                      <CardHeader>
                        <CardTitle>{displayName} Statistics</CardTitle>
                        <CardDescription>
                          Detailed performance metrics
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium mb-1">Current Rating</div>
                            <div className="text-3xl font-bold">
                              {stats?.[typedType]?.last.rating || "N/A"}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium mb-1">Best Rating</div>
                            <div className="text-xl font-semibold">
                              {stats?.[typedType]?.best?.rating || "N/A"}
                              {stats?.[typedType]?.best?.date && (
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                  on {new Date(stats[typedType].best!.date * 1000).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div>
                            <div className="text-sm font-medium mb-3">Game Results</div>
                            <div className="h-[200px]">
                              <Pie
                                data={getWinRateData(typedType)}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      position: 'bottom'
                                    }
                                  }
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
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
