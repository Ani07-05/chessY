import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

export interface Poll {
  id: string
  question: string
  options: string[]
  votes: Record<string, string>
  active: boolean
  created_at: string
  type: "regular" | "quiz"
}

export const fetchPolls = async (active = true): Promise<Poll[]> => {
  const supabase = createClientComponentClient()

  try {
    const { data, error } = await supabase
      .from("polls")
      .select("*")
      .eq("active", active)
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    if (!data) return []

    return data.map((poll) => {
      // Ensure options is always an array
      let parsedOptions
      try {
        parsedOptions =
          typeof poll.options === "string"
            ? JSON.parse(poll.options)
            : Array.isArray(poll.options)
              ? poll.options
              : Object.keys(poll.options)
      } catch (e) {
        console.error("Error parsing options for poll:", poll.id, e)
        parsedOptions = []
      }

      // Ensure votes is always an object
      let parsedVotes
      try {
        parsedVotes = typeof poll.votes === "string" ? JSON.parse(poll.votes) : poll.votes || {}
      } catch (e) {
        console.error("Error parsing votes for poll:", poll.id, e)
        parsedVotes = {}
      }

      return {
        ...poll,
        options: Array.isArray(parsedOptions) ? parsedOptions : [],
        votes: parsedVotes,
      }
    })
  } catch (error) {
    console.error("Error fetching polls:", error)
    return []
  }
}

export const submitVote = async (pollId: string, option: string): Promise<boolean> => {
  const supabase = createClientComponentClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      throw new Error("User not logged in")
    }

    // First, get the current poll state
    const { data: currentPoll } = await supabase.from("polls").select("votes").eq("id", pollId).single()

    if (!currentPoll) {
      throw new Error("Poll not found")
    }

    // Update votes object
    const votes = currentPoll.votes || {}
    votes[session.user.id] = option

    // Update the poll
    const { error } = await supabase.from("polls").update({ votes }).eq("id", pollId)

    if (error) {
      throw error
    }

    return true
  } catch (error) {
    console.error("Error submitting vote:", error)
    return false
  }
}

export const hasUserVoted = async (pollId: string): Promise<boolean> => {
  const supabase = createClientComponentClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return false
    }

    const { data } = await supabase.from("polls").select("votes").eq("id", pollId).single()

    if (!data || !data.votes) {
      return false
    }

    const votes = typeof data.votes === "string" ? JSON.parse(data.votes) : data.votes
    return votes[session.user.id] !== undefined
  } catch (error) {
    console.error("Error checking if user voted:", error)
    return false
  }
}

export const getPollResults = (poll: Poll): { option: string; count: number; percentage: number }[] => {
  if (!poll || !poll.options || !poll.votes) {
    return []
  }

  const totalVotes = Object.keys(poll.votes).length

  return poll.options.map((option) => {
    const count = Object.values(poll.votes).filter((vote) => vote === option).length
    const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0

    return {
      option,
      count,
      percentage,
    }
  })
}

