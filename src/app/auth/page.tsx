"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useSearchParams, useRouter } from "next/navigation"

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [chessUsername, setChessUsername] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [isSuperuser, setIsSuperuser] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  // Direct superuser navigation - bypasses potential middleware checks
  const navigateAsSuperuser = () => {
    console.log("Navigating to stream page as superuser")
    // Store superuser status in both sessionStorage and cookies for redundancy
    sessionStorage.setItem("is_superuser", "true")
    document.cookie = "is_superuser=true; path=/"
    // Force navigation with a full page reload to bypass any client-side routing
    window.location.href = "/stream"
  }

  // Check for superuser status on component mount
  useEffect(() => {
    const isSuperuserSession = sessionStorage.getItem("is_superuser") === "true"
    const hasSuperuserCookie = document.cookie.split(";").some((item) => item.trim().startsWith("is_superuser=true"))

    if (isSuperuserSession || hasSuperuserCookie) {
      const currentPath = window.location.pathname
      if (currentPath === "/auth") {
        // We're on the auth page but we should be on the stream page
        console.log("Detected superuser session, redirecting to stream page")
        window.location.href = "/stream"
      }
    }
  }, [])

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (isSuperuser) {
        // Check for hardcoded superuser password since it's a demo
        if (password === "ChessY@2025") {
          console.log("Superuser access granted")
          navigateAsSuperuser()
          return
        } else {
          throw new Error("Invalid superuser password")
        }
      }

      // Rest of the auth logic for regular users
      if (isSignUp) {
        // Step 1: Create auth user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: email.split("@")[0],
              chess_username: chessUsername || "magnuscarlsen",
            },
          },
        })

        if (signUpError) throw signUpError

        // Check if the auth user creation was successful with the correct format
        if (authData.user) {
          // Make sure we're using the correct ID format
          const userId = authData.user.id

          const { error: profileError } = await supabase.from("users").insert([
            {
              id: userId,
              email: authData.user.email,
              username: email.split("@")[0], // Getting directly from form input
              chess_username: chessUsername || "magnuscarlsen",
            },
          ])

          if (profileError) {
            console.error("Profile creation error:", profileError)
            throw new Error(`Failed to create user profile: ${profileError.message}`)
          }

          setSuccessMessage("Account created successfully!")
          router.push("/dashboard")
        }
      } else {
        // Regular sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) throw signInError
        router.push("/dashboard")
      }
    } catch (err) {
      console.error("Auth error:", err)
      setError(err instanceof Error ? err.message : "An error occurred during authentication")
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsSignUp(!isSignUp)
    setError("")
    setSuccessMessage("")
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative overflow-hidden">
      {/* Chess-themed background with dotted pattern */}
      <div className="absolute inset-0 bg-[#121212] z-0">
        <div className="absolute inset-0 opacity-10">
          <div className="chess-dots"></div>
        </div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-radial from-[#2c2c2c] to-transparent opacity-40"></div>
      </div>

      {/* Left panel with chess pieces */}
      <div className="hidden md:flex md:w-1/2 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#121212]/90 to-[#121212]/70"></div>

        {/* Animated chess pieces */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="chess-board-perspective mb-8">
            <div className="chess-board">
              {/* White pieces row */}
              <div className="piece-row">
                <div className="piece-square white">
                  <div className="chess-piece rook-white"></div>
                </div>
                <div className="piece-square black">
                  <div className="chess-piece knight-white"></div>
                </div>
                <div className="piece-square white">
                  <div className="chess-piece bishop-white"></div>
                </div>
                <div className="piece-square black">
                  <div className="chess-piece queen-white"></div>
                </div>
                <div className="piece-square white">
                  <div className="chess-piece king-white"></div>
                </div>
                <div className="piece-square black">
                  <div className="chess-piece bishop-white"></div>
                </div>
                <div className="piece-square white">
                  <div className="chess-piece knight-white"></div>
                </div>
                <div className="piece-square black">
                  <div className="chess-piece rook-white"></div>
                </div>
              </div>
              {/* Pawn rows */}
              <div className="piece-row">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={`piece-square ${i % 2 === 0 ? "black" : "white"}`}>
                    <div className="chess-piece pawn-white"></div>
                  </div>
                ))}
              </div>
              {/* Empty rows */}
              {[...Array(4)].map((_, rowIdx) => (
                <div key={rowIdx} className="piece-row">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className={`piece-square ${
                        rowIdx % 2 === 0 ? (i % 2 === 0 ? "white" : "black") : i % 2 === 0 ? "black" : "white"
                      }`}
                    ></div>
                  ))}
                </div>
              ))}
              {/* Black pawn row */}
              <div className="piece-row">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={`piece-square ${i % 2 === 0 ? "white" : "black"}`}>
                    <div className="chess-piece pawn-black"></div>
                  </div>
                ))}
              </div>
              {/* Black pieces row */}
              <div className="piece-row">
                <div className="piece-square black">
                  <div className="chess-piece rook-black"></div>
                </div>
                <div className="piece-square white">
                  <div className="chess-piece knight-black"></div>
                </div>
                <div className="piece-square black">
                  <div className="chess-piece bishop-black"></div>
                </div>
                <div className="piece-square white">
                  <div className="chess-piece queen-black"></div>
                </div>
                <div className="piece-square black">
                  <div className="chess-piece king-black"></div>
                </div>
                <div className="piece-square white">
                  <div className="chess-piece bishop-black"></div>
                </div>
                <div className="piece-square black">
                  <div className="chess-piece knight-black"></div>
                </div>
                <div className="piece-square white">
                  <div className="chess-piece rook-black"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <h1 className="text-5xl font-bold mb-4 tracking-tight font-serif">Chess ERP</h1>
            <p className="text-xl text-gray-300 mb-8 max-w-md">Master the game. Elevate your strategy.</p>
          </div>
        </div>
      </div>

      {/* Auth form side */}
      <div className="flex-1 flex items-center justify-center z-10 p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Chess-themed card with border */}
          <div className="chess-card">
            <div className="chess-card-inner">
              {/* Form header with chess piece icon */}
              <div className="text-center mb-8">
                <div className="flex justify-center mb-6">
                  {isSuperuser ? (
                    <div className="chess-piece-icon king-gold"></div>
                  ) : (
                    <div className="chess-piece-icon knight-white"></div>
                  )}
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight font-serif">
                  {isSuperuser ? "Grandmaster Access" : isSignUp ? "Join the Tournament" : "Welcome Back"}
                </h2>
                <p className="mt-2 text-gray-400">
                  {isSuperuser
                    ? "Enter your credentials to access admin features"
                    : isSignUp
                      ? "Create your account to start your chess journey"
                      : "Sign in to continue your chess mastery"}
                </p>
              </div>

              {/* Auth form */}
              <form className="space-y-6" onSubmit={handleAuth}>
                {!isSuperuser ? (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                          Email
                        </label>
                        <div className="chess-input-wrapper">
                          <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="chess-input"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                          <div className="chess-input-icon pawn-white"></div>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                          Password
                        </label>
                        <div className="chess-input-wrapper">
                          <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            minLength={6}
                            className="chess-input"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          <div className="chess-input-icon rook-white"></div>
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      {isSignUp && (
                        <div>
                          <label htmlFor="chess-username" className="block text-sm font-medium text-gray-300 mb-2">
                            Chess.com Username (Optional)
                          </label>
                          <div className="chess-input-wrapper">
                            <input
                              id="chess-username"
                              name="chess-username"
                              type="text"
                              className="chess-input"
                              placeholder="Your Chess.com username"
                              value={chessUsername}
                              onChange={(e) => setChessUsername(e.target.value)}
                            />
                            <div className="chess-input-icon knight-white"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // Superuser login fields
                  <div>
                    <label htmlFor="superuser-password" className="block text-sm font-medium text-gray-300 mb-2">
                      Grandmaster Password
                    </label>
                    <div className="chess-input-wrapper superuser">
                      <input
                        id="superuser-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        className="chess-input"
                        placeholder="Enter grandmaster password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <div className="chess-input-icon king-gold"></div>
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-red-400 text-sm text-center bg-red-900/20 p-3 rounded-lg border border-red-800/50 animate-pulse">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="text-green-400 text-sm text-center bg-green-900/20 p-3 rounded-lg border border-green-800/50">
                    {successMessage}
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`chess-button ${isSuperuser ? "gold" : "white"} ${loading ? "loading" : ""}`}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="chess-loader"></div>
                        <span className="ml-2">Processing...</span>
                      </div>
                    ) : isSuperuser ? (
                      "Access Grandmaster Area"
                    ) : isSignUp ? (
                      "Create Account"
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </div>
              </form>

              {/* Mode toggle buttons */}
              <div className="mt-6 flex flex-col space-y-3 text-center">
                {!isSuperuser && (
                  <button
                    type="button"
                    className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
                    onClick={toggleMode}
                  >
                    {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                  </button>
                )}
                <button
                  type="button"
                  className="chess-text-button"
                  onClick={() => {
                    setIsSuperuser(!isSuperuser)
                    setError("")
                    setSuccessMessage("")
                    setPassword("")
                    setEmail("")
                  }}
                >
                  {isSuperuser ? <>Back to regular login</> : <>Grandmaster login</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

