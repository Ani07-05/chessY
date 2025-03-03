import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET() {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ isSuperAdmin: false }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const isSuperAdmin = userData?.role === 'superadmin';

    return NextResponse.json({ isSuperAdmin });
  } catch (error) {
    console.error('Error checking superadmin status:', error);
    return NextResponse.json({ isSuperAdmin: false }, { status: 500 });
  }
}