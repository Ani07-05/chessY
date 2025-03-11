'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

interface Poll {
  id: string;
  question: string;
  options: string[];
  created_at: string;
  created_by: string;
  votes: Record<string, string>;
  active: boolean;
}

export default function PollsPage() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  // Check if user is superuser
  useEffect(() => {
    const checkAccess = async () => {
      const isSuperuser = sessionStorage.getItem('is_superuser') === 'true';
      if (!isSuperuser) {
        router.push('/dashboard');
      }
    };
    checkAccess();
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Ensure options is parsed as an array
      const parsedPolls = data.map(poll => ({
        ...poll,
        options: Array.isArray(poll.options) ? poll.options : JSON.parse(poll.options)
      }));
      setPolls(parsedPolls);
    }
  };

  const createPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Filter out empty options
      const validOptions = options.filter(opt => opt.trim() !== '');
      
      if (validOptions.length < 2) {
        throw new Error('At least two options are required');
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error('No authenticated user');
      }

      // Create the poll - no need for superuser headers
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .insert({
          question: question.trim(),
          options: validOptions,
          created_by: session.user.id,
          votes: {},
          active: true
        })
        .select()
        .single();

      if (pollError) {
        console.error('Poll creation error:', pollError);
        throw pollError;
      }

      // Then create notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          type: 'poll',
          message: `New poll: ${question.trim()}`,
          poll_id: pollData.id
        });

      if (notifError) {
        console.error('Notification creation error:', notifError);
      }

      setQuestion('');
      setOptions(['', '']);
      await fetchPolls();
      
    } catch (error) {
      console.error('Error creating poll:', error);
      alert(error instanceof Error ? error.message : 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  // Add this function to handle vote counting
  const getVoteCounts = (poll: Poll) => {
    return Object.entries(poll.votes).reduce((acc, [userId, vote]) => {
      acc[vote as string] = (acc[vote as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const getVoteStats = (poll: Poll) => {
    const totalVotes = Object.keys(poll.votes || {}).length;
    const votesByOption = poll.options.map(option => ({
      option,
      votes: Object.values(poll.votes || {}).filter(v => v === option).length,
      percentage: totalVotes ? 
        (Object.values(poll.votes || {}).filter(v => v === option).length / totalVotes * 100) : 0
    }));

    return { totalVotes, votesByOption };
  };

  const closePoll = async (pollId: string) => {
    const { error } = await supabase
      .from('polls')
      .update({ active: false })
      .eq('id', pollId);

    if (!error) {
      fetchPolls();
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Manage Polls</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Create New Poll</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createPoll} className="space-y-4">
            <div>
              <label className="block mb-2">Question</label>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter your question"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="block mb-2">Options</label>
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index] = e.target.value;
                      setOptions(newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                    required
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setOptions(options.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOptions([...options, ''])}
                >
                  Add Option
                </Button>
              )}
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Poll'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {polls.map((poll) => {
          const { totalVotes, votesByOption } = getVoteStats(poll);
          
          return (
            <Card key={poll.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  {poll.question}
                  <Badge variant={poll.active ? "default" : "secondary"}>
                    {poll.active ? "Active" : "Closed"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Created {new Date(poll.created_at).toLocaleDateString()} • 
                  {totalVotes} total votes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {votesByOption.map(({ option, votes, percentage }) => (
                    <div key={option} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span>{option}</span>
                        <span className="text-sm text-muted-foreground">
                          {votes} votes ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  ))}
                </div>
                {poll.active && (
                  <Button 
                    onClick={() => closePoll(poll.id)}
                    variant="outline"
                    className="mt-4"
                  >
                    Close Poll
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
