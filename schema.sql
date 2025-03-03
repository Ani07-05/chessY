-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own rating history" ON public.rating_history;
DROP POLICY IF EXISTS "Users can view their own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can view their own game records" ON public.game_records;

-- Drop existing tables in reverse order of dependencies
DROP TABLE IF EXISTS public.game_records;
DROP TABLE IF EXISTS public.achievements;
DROP TABLE IF EXISTS public.rating_history;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rating history to track player ratings over time
CREATE TABLE public.rating_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  game_type text NOT NULL CHECK (game_type IN ('rapid', 'blitz', 'bullet')),
  rating integer NOT NULL,
  timestamp timestamp with time zone DEFAULT now()
);

-- Achievements table for tracking progress and milestones
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  achievement_type text NOT NULL,
  progress integer DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Game records to track winning streaks and game history
CREATE TABLE public.game_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  game_type text NOT NULL CHECK (game_type IN ('rapid', 'blitz', 'bullet')),
  result text NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  opponent_username text,
  played_at timestamp with time zone DEFAULT now()
);



-- Enable RLS
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_records ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view their own rating history"
  ON public.rating_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own achievements"
  ON public.achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own game records"
  ON public.game_records FOR SELECT
  USING (auth.uid() = user_id);