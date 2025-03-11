-- First, create enum for poll types if needed
CREATE TYPE poll_type AS ENUM ('regular', 'quiz');

-- Create polls table
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    votes JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true,
    type poll_type DEFAULT 'regular'
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    read BOOLEAN DEFAULT false
);

-- Create function to update poll votes
CREATE OR REPLACE FUNCTION update_poll_vote(
    poll_id UUID,
    user_id UUID,
    vote_option TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE polls
    SET votes = votes || jsonb_build_object(user_id::text, vote_option)
    WHERE id = poll_id;
END;
$$;

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for polls
CREATE POLICY "Anyone can view polls"
    ON public.polls
    FOR SELECT
    USING (true);

-- Drop existing policies first
DROP POLICY IF EXISTS "Only superusers can create polls" ON public.polls;
DROP POLICY IF EXISTS "Only superusers can create notifications" ON public.notifications;

-- Create policy for superuser check using session data instead
CREATE POLICY "Superusers can create polls"
ON public.polls
FOR INSERT
WITH CHECK (
  pg_catalog.current_setting('request.jwt.claims', true)::json->>'is_superuser' = 'true'
);

CREATE POLICY "Superusers can create notifications"
    FOR UPDATE
    USING (created_by = auth.uid());

-- Create RLS policies for notifications
CREATE POLICY "Anyone can view notifications"
    ON public.notifications
    FOR SELECT
    USING (true);

CREATE POLICY "Only superusers can create notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'superuser'
        )
    );

-- Update policies for polls table
DROP POLICY IF EXISTS "Superusers can create polls" ON public.polls;
CREATE POLICY "Anyone can view and create polls"
ON public.polls
FOR ALL
USING (true)
WITH CHECK (true);

-- Update policies for notifications
DROP POLICY IF EXISTS "Only superusers can create notifications" ON public.notifications;
CREATE POLICY "Anyone can manage notifications"
ON public.notifications
FOR ALL
USING (true)
WITH CHECK (true);

-- Drop the superuser check function as it's not needed
DROP FUNCTION IF EXISTS is_superuser();

-- Update policies for users table
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Superusers can access all data" ON public.users;

CREATE POLICY "Users can read own data"
ON public.users
FOR SELECT
USING (
  auth.uid() = id OR is_superuser()
);

CREATE POLICY "Users can update own data"
ON public.users
FOR UPDATE
USING (
  auth.uid() = id OR is_superuser()
);

CREATE POLICY "Superusers can access all data"
ON public.users
FOR ALL
USING (
  is_superuser()
);

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.polls TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION update_poll_vote TO authenticated;
