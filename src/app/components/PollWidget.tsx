'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function PollWidget() {
  const [activePoll, setActivePoll] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchLatestPoll = async () => {
      const { data: poll } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (poll) {
        setActivePoll(poll);
        // Check if user has already voted
        const { data: response } = await supabase
          .from('poll_responses')
          .select('*')
          .match({ poll_id: poll.id, user_id: (await supabase.auth.getUser()).data.user?.id })
          .single();

        if (response) {
          setSelectedOption(response.selected_option);
          setHasVoted(true);
        }
      }
    };

    fetchLatestPoll();
  }, []);

  const handleVote = async () => {
    if (selectedOption === null || !activePoll) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('poll_responses')
        .insert([{
          poll_id: activePoll.id,
          user_id: userData.user?.id,
          selected_option: selectedOption
        }]);

      if (error) throw error;
      setHasVoted(true);
    } catch (err) {
      console.error('Error submitting vote:', err);
    }
  };

  if (!activePoll) return null;

  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
      <h3 className="text-xl font-bold text-white mb-4">{activePoll.question}</h3>
      <div className="space-y-3">
        {activePoll.options.map((option: string, index: number) => (
          <button
            key={index}
            onClick={() => !hasVoted && setSelectedOption(index)}
            disabled={hasVoted}
            className={`w-full p-3 rounded text-left ${
              selectedOption === index
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300'
            } ${hasVoted ? 'cursor-not-allowed' : 'hover:bg-gray-700'}`}
          >
            {option}
          </button>
        ))}
      </div>
      {!hasVoted && (
        <button
          onClick={handleVote}
          disabled={selectedOption === null}
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Submit Vote
        </button>
      )}
      {hasVoted && (
        <p className="mt-4 text-green-400">Thanks for voting!</p>
      )}
    </div>
  );
}
