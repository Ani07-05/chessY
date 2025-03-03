import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Create a new user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) throw signUpError;

    // If this is the superadmin email, set their role
    if (email === 'paathabot@gmail.com') {
      await supabase
        .from('users')
        .update({ role: 'superadmin' })
        .eq('id', authData.user?.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in user registration:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}