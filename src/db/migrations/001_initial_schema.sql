-- Drop all existing tables
DROP TABLE IF EXISTS "public"."polls" CASCADE;
DROP TABLE IF EXISTS "public"."users" CASCADE;
DROP TABLE IF EXISTS "public"."visits" CASCADE;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (renamed from auth)
CREATE TABLE "public"."users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "chess_username" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON "public"."users"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Create polls table
CREATE TABLE "public"."polls" (
    "id" SERIAL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "votes" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Create visits table
CREATE TABLE "public"."visits" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID REFERENCES "public"."users"(id),
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX "polls_active_idx" ON "public"."polls" ("active");
CREATE INDEX "users_email_idx" ON "public"."users" ("email");
CREATE INDEX "visits_created_at_idx" ON "public"."visits" ("created_at");

-- Create index for chess username searches
CREATE INDEX "users_chess_username_idx" ON "public"."users" ("chess_username");

-- Disable RLS
ALTER TABLE "public"."polls" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."visits" DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Insert test data
INSERT INTO "public"."users" (email, password, chess_username)
VALUES 
  ('test@example.com', 'testpass123', 'chesshero1'),
  ('demo@example.com', 'demopass123', 'chesschamp2');

-- Insert some test visits
INSERT INTO "public"."visits" (user_id)
SELECT id FROM "public"."users" WHERE email = 'test@example.com';
