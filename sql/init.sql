-- Drop existing objects if they exist
DO $$ BEGIN
    DROP TABLE IF EXISTS poll_responses CASCADE;
    DROP TABLE IF EXISTS polls CASCADE;
    DROP TABLE IF EXISTS visits CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TYPE IF EXISTS user_role CASCADE;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- Create role enum type
CREATE TYPE user_role AS ENUM ('user', 'admin', 'superadmin');

-- Create users table
CREATE TABLE users (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    role user_role DEFAULT 'user'::user_role,
    chess_username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create visits table
CREATE TABLE visits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create polls table
CREATE TABLE polls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id)
);

-- Create poll responses table
CREATE TABLE poll_responses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    selected_option INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(poll_id, user_id)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own data"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Superadmins can view all data"
    ON users FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'superadmin'
        )
    );

CREATE POLICY "Anyone can create visits"
    ON visits FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Superadmins can view visits"
    ON visits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'superadmin'
        )
    );

CREATE POLICY "Anyone can view polls"
    ON polls FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Superadmins can create polls" ON polls;
CREATE POLICY "Superadmins can create polls"
    ON polls
    FOR INSERT
    WITH CHECK (true);  -- Allow all inserts for now, we'll handle auth in the app

CREATE POLICY "Superadmins can update polls"
    ON polls
    FOR UPDATE
    USING (true)  -- Allow all updates for now
    WITH CHECK (true);

CREATE POLICY "Anyone can vote"
    ON poll_responses FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can view their own votes"
    ON poll_responses FOR SELECT
    USING (user_id = auth.uid());

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, role, chess_username)
    VALUES (
        new.id,
        CASE 
            WHEN new.raw_user_meta_data->>'role' = 'superadmin' THEN 'superadmin'::user_role
            ELSE 'user'::user_role
        END,
        new.raw_user_meta_data->>'chess_username'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
