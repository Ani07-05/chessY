import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function createUser(userData: {
  email: string;
  password: string;
  role?: string;
  chess_username?: string;
}) {
  try {
    // First create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw authError;
    }

    if (!authData?.user?.id) {
      console.error('No user ID received after signup');
      throw new Error('User creation failed - no user ID received');
    }

    // Then add the user details to your users table
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: userData.email,
          role: userData.role || 'user', // Default role
          chess_username: userData.chess_username || null,
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString()
        }
      ])
      .select();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      
      // Try to clean up the auth user since profile creation failed
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      throw profileError;
    }

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: userData.role || 'user',
        chessUsername: userData.chess_username
      },
      session: authData.session
    };
  } catch (error) {
    console.error('Error in user creation:', error);
    throw new Error('User creation failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}