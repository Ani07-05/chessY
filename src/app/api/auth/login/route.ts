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
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Get user role and details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, chess_username')
      .eq('id', auth.user.id)
      .single();

    if (userError) throw userError;

    // Update last sign in time
    await supabase
      .from('users')
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq('id', auth.user.id);

    return NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        role: userData.role,
        chessUsername: userData.chess_username
      },
      session: auth.session
    });

  } catch (error) {
    console.error('Error in user authentication:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}