import { createClient } from '@supabase/supabase-js';

// Note: Please install the required package by running:
// npm install @supabase/supabase-js
// or
// yarn add @supabase/supabase-js

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: number[];
  createdAt: Date;
  endedAt?: Date;
  streamId: string;
}

export interface Stream {
  id: string;
  userId: string;
  youtubeUrl: string;
  title: string;
  startedAt: Date;
  endedAt?: Date;
  isLive: boolean;
}

export async function startStream(userId: string, youtubeUrl: string, title: string): Promise<Stream> {
  try {
    const { data, error } = await supabase
      .from('streams')
      .insert({
        user_id: userId,
        youtube_url: youtubeUrl,
        title: title,
        started_at: new Date(),
        is_live: true
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      userId: data.user_id,
      youtubeUrl: data.youtube_url,
      title: data.title,
      startedAt: new Date(data.started_at),
      isLive: data.is_live
    };
  } catch (error) {
    console.error('Error starting stream:', error);
    throw error;
  }
}

export async function endStream(streamId: string): Promise<void> {
  try {
    await supabase
      .from('streams')
      .update({
        ended_at: new Date(),
        is_live: false
      })
      .eq('id', streamId);
  } catch (error) {
    console.error('Error ending stream:', error);
    throw error;
  }
}

export async function createPoll(streamId: string, question: string, options: string[]): Promise<Poll> {
  try {
    const { data, error } = await supabase
      .from('polls')
      .insert({
        stream_id: streamId,
        question: question,
        options: options,
        votes: new Array(options.length).fill(0),
        created_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      question: data.question,
      options: data.options,
      votes: data.votes,
      createdAt: new Date(data.created_at),
      streamId: data.stream_id
    };
  } catch (error) {
    console.error('Error creating poll:', error);
    throw error;
  }
}

export async function votePoll(pollId: string, optionIndex: number): Promise<void> {
  try {
    const { data: poll } = await supabase
      .from('polls')
      .select('votes')
      .eq('id', pollId)
      .single();

    if (!poll) throw new Error('Poll not found');

    const newVotes = [...poll.votes];
    newVotes[optionIndex]++;

    await supabase
      .from('polls')
      .update({ votes: newVotes })
      .eq('id', pollId);
  } catch (error) {
    console.error('Error voting in poll:', error);
    throw error;
  }
}

export async function getActivePoll(streamId: string): Promise<Poll | null> {
  try {
    const { data } = await supabase
      .from('polls')
      .select('*')
      .eq('stream_id', streamId)
      .is('ended_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      question: data.question,
      options: data.options,
      votes: data.votes,
      createdAt: new Date(data.created_at),
      streamId: data.stream_id,
      endedAt: data.ended_at ? new Date(data.ended_at) : undefined
    };
  } catch (error) {
    console.error('Error getting active poll:', error);
    return null;
  }
}