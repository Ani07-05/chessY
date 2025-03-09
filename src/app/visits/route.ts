import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    await supabase
      .from('visits')
      .insert([{ created_at: new Date().toISOString() }]);
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 });
  }
}
