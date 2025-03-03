import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET() {
  try {
    // Check if user is superadmin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (userData?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch analytics data
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact' });

    const { data: activeStreams } = await supabase
      .from('streams')
      .select('*')
      .eq('status', 'active');

    // Get recent logins from the users table instead of auth.users
    const { data: recentLogins } = await supabase
      .from('users')
      .select('created_at as last_sign_in_at')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeStreams: activeStreams?.length || 0,
      recentLogins: recentLogins || []
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Get request body
    const body = await request.json().catch(() => ({}));
    const { channelId } = body;
    
    // Check authentication and authorization
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (userData?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create or update stream status
    const { data: stream } = await supabase
      .from('streams')
      .upsert({
        user_id: session.user.id,
        youtube_url: channelId || '',
        title: 'Live Stream',
        status: 'active',
        started_at: new Date().toISOString(),
        is_live: true
      })
      .select()
      .single();

    // Notify all users about the stream
    await supabase
      .from('notifications')
      .insert({
        type: 'stream_started',
        message: 'A new live stream has started!',
        stream_id: stream.id
      });

    return NextResponse.json({ success: true, stream });
  } catch (error) {
    console.error('Error managing stream:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}