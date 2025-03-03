import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  console.log('Middleware processing route:', req.nextUrl.pathname);
  
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({
            name,
            value,
            ...options
          });
        },
        remove: (name, options) => {
          res.cookies.delete({
            name,
            ...options
          });
        }
      },
      auth: {
        persistSession: true
      }
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session exists:', !!session);

  const protectedRoutes = [
    '/dashboard',
    '/profile',
    '/settings',
    '/admin'
  ];

  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route));
  console.log('Is protected route:', isProtectedRoute);

  if (isProtectedRoute) {
    if (!session) {
      const redirectUrl = new URL('/auth', req.url);
      redirectUrl.searchParams.set('redirect', req.nextUrl.pathname);
      console.log('Redirecting to:', redirectUrl.toString());
      return NextResponse.redirect(redirectUrl);
    }

    // Check user role for admin routes
    if (req.nextUrl.pathname.startsWith('/admin')) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      console.log('User role:', userData?.role);
      if (userData?.role !== 'superadmin') {
        console.log('Not a superadmin, redirecting to dashboard');
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }
  } else if (req.nextUrl.pathname === '/auth' && session) {
    // Redirect authenticated users away from auth page
    console.log('User already authenticated, redirecting to dashboard');
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

// Specify which routes should trigger this middleware
export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/settings/:path*', '/admin/:path*', '/auth'],
};