"use client"

import type React from "react"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { PlusCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function CreatePoll() {
  const supabase = createClientComponentClient()
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState<string[]>(["", ""])
  const [pollType, setPollType] = useState<"regular" | "quiz">("regular")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addOption = () => {
    setOptions([...options, ""])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      toast.error("A poll must have at least 2 options")
      return
    }

    const newOptions = [...options]
    newOptions.splice(index, 1)
    setOptions(newOptions)
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate inputs
    if (!question.trim()) {
      toast.error("Please enter a question")
      return
    }

    const validOptions = options.filter((opt) => opt.trim() !== "")
    if (validOptions.length < 2) {
      toast.error("Please enter at least 2 options")
      return
    }

    setIsSubmitting(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error("You must be logged in to create a poll")
        return
      }

      // Insert the poll
      const {  error } = await supabase
        .from("polls")
        .insert({
          question: question.trim(),
          options: validOptions,
          created_by: session.user.id,
          type: pollType,
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      toast.success("Poll created successfully")

      // Reset form
      setQuestion("")
      setOptions(["", ""])
      setPollType("regular")
    } catch (error) {
      console.error("Error creating poll:", error)
      toast.error("Failed to create poll. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Poll</CardTitle>
        <CardDescription>Create a poll for chess players to vote on</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="question">Poll Question</Label>
            <Input
              id="question"
              placeholder="What's your favorite chess opening?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Poll Type</Label>
            <RadioGroup
              value={pollType}
              onValueChange={(value) => setPollType(value as "regular" | "quiz")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="regular" id="regular" />
                <Label htmlFor="regular">Regular Poll</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="quiz" id="quiz" />
                <Label htmlFor="quiz">Quiz (with correct answer)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Poll Options</Label>
              <Button type="button" variant="outline" size="sm" onClick={addOption} className="flex items-center gap-1">
                <PlusCircle className="h-4 w-4" />
                Add Option
              </Button>
            </div>

            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Poll"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

