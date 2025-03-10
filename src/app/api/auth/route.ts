import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Attempt to sign in
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (!auth?.user?.id) {
      console.error('No user ID received after authentication');
      return NextResponse.json(
        { error: 'User authentication failed' },
        { status: 401 }
      );
    }

    // Get user role and details - changed from .single() to handle possible multiple results
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, chess_username')
      .eq('id', auth.user.id);

    if (userError) {
      console.error('Error fetching user data:', userError);
      throw userError;
    }

    // Check if we got user data
    if (!userData || userData.length === 0) {
      console.error('No user data found for ID:', auth.user.id);
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      );
    }

    // Get the first matching user record
    const user = userData[0];

    // Update last sign in time
    const { error: updateError } = await supabase
      .from('users')
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq('id', auth.user.id);

    if (updateError) {
      console.error('Error updating last sign in time:', updateError);
      // Continue anyway, this isn't critical
    }

    return NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        role: user.role,
        chessUsername: user.chess_username
      },
      session: auth.session
    });

  } catch (error) {
    console.error('Error in user authentication:', error);
    return NextResponse.json(
      { error: 'Authentication failed: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}