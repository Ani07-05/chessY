import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // Create a response object that we'll modify and return
  const res = NextResponse.next();
  
  // Create a Supabase client configured for middleware
  const supabase = createMiddlewareClient({ req, res });
  
  // Get user session
  const { data: { session } } = await supabase.auth.getSession();
  
  // Define protected routes
  const protectedRoutes = ['/dashboard', '/profile', '/settings', '/admin'];
  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route));
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');
  const isAuthPage = req.nextUrl.pathname === '/auth';

  // Don't redirect for API routes, static files, or favicon
  if (
    req.nextUrl.pathname.startsWith('/api') || 
    req.nextUrl.pathname.startsWith('/_next') || 
    req.nextUrl.pathname.includes('.') ||
    req.nextUrl.pathname === '/favicon.ico'
  ) {
    return res;
  }

  // For protected routes without a session, redirect to auth page
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL('/auth', req.url);
    // Save the original URL to redirect back after login
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // For auth page with active session, redirect to dashboard or specified redirect path
  if (isAuthPage && session) {
    const redirectPath = req.nextUrl.searchParams.get('redirect') || '/dashboard';
    return NextResponse.redirect(new URL(redirectPath, req.url));
  }

  // For admin routes, check if user has superadmin role
  if (isAdminRoute && session) {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }

      if (userData?.role !== 'superadmin') {
        // User doesn't have admin privileges
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    } catch (err) {
      console.error('Middleware error checking admin role:', err);
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * But include:
     * - All routes under /dashboard, /profile, /settings, /admin
     * - The /auth route
     */
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/auth',
    '/api/:path*'
  ]
};