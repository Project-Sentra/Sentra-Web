-- Migration: Add Supabase Auth integration to admin users table
-- Run this in your Supabase SQL Editor

-- Step 1: Add auth_user_id column to existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- Step 2: Add foreign key reference to auth.users
ALTER TABLE users ADD CONSTRAINT fk_users_auth 
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Remove password column (we'll use Supabase Auth instead)
-- WARNING: Back up data before running this!
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Step 4: Make auth_user_id unique (one admin per auth user)
ALTER TABLE users ADD CONSTRAINT unique_auth_user_id UNIQUE (auth_user_id);

-- Step 5: Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies to prevent users from seeing other admins' data
CREATE POLICY "Users can only see their own data" ON users
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Step 7: Allow service role (your backend) to insert/select users
CREATE POLICY "Service can insert users" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can select users" ON users
    FOR SELECT USING (true);
