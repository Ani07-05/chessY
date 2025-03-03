-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own rating history" ON public.rating_history;
DROP POLICY IF EXISTS "Users can view their own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can view their own game records" ON public.game_records;

-- Drop existing tables in reverse order of dependencies
DROP TABLE IF EXISTS public.game_records;
DROP TABLE IF EXISTS public.achievements;
DROP TABLE IF EXISTS public.rating_history;
DROP TABLE IF EXISTS public.users;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table for authentication and role management
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  encrypted_password text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  chess_username text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  last_sign_in_at timestamp with time zone
);

-- Create default superadmin user
INSERT INTO public.users (email, encrypted_password, role, chess_username)
VALUES ('paathabot@gmail.com', crypt('ChessYBoss2025', gen_salt('bf')), 'superadmin', 'hikaru');

-- Rating history to track player ratings over time
CREATE TABLE public.rating_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_type text NOT NULL CHECK (game_type IN ('rapid', 'blitz', 'bullet')),
  rating integer NOT NULL,
  timestamp timestamp with time zone DEFAULT now()
);

-- Achievements table for tracking progress and milestones
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,
  progress integer DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Game records to track winning streaks and game history
CREATE TABLE public.game_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_type text NOT NULL CHECK (game_type IN ('rapid', 'blitz', 'bullet')),
  result text NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  opponent_username text,
  played_at timestamp with time zone DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_rating_history_user_id ON public.rating_history(user_id);
CREATE INDEX idx_achievements_user_id ON public.achievements(user_id);
CREATE INDEX idx_game_records_user_id ON public.game_records(user_id);
CREATE INDEX idx_rating_history_timestamp ON public.rating_history(timestamp);
CREATE INDEX idx_game_records_played_at ON public.game_records(played_at);

-- Enable RLS
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_records ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view their own rating history"
  ON public.rating_history FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own achievements"
  ON public.achievements FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own game records"
  ON public.game_records FOR ALL
  USING (auth.uid() = user_id);

-- Create policies for superadmin access
CREATE POLICY "Superadmin can view all rating history"
  ON public.rating_history FOR ALL
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'superadmin');

CREATE POLICY "Superadmin can view all achievements"
  ON public.achievements FOR ALL
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'superadmin');

CREATE POLICY "Superadmin can view all game records"
  ON public.game_records FOR ALL
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'superadmin');