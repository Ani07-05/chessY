import { NextResponse } from 'next/server';
import { createUser } from '../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password, role, chess_username } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Create the user
    const userData = await createUser({
      email,
      password,
      role,
      chess_username
    });

    return NextResponse.json(userData);

  } catch (error) {
    console.error('Error in user registration:', error);
    return NextResponse.json(
      { error: 'Registration failed: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}