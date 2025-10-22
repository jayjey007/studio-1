
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin-app';

export async function POST(req: NextRequest) {
  const adminApp = await initializeAdminApp();
  if (!adminApp) {
    return NextResponse.json({ error: 'Firebase Admin SDK not initialized' }, { status: 500 });
  }

  const { auth } = adminApp;

  try {
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    const customToken = await auth.createCustomToken(uid);
    return NextResponse.json({ token: customToken });
  } catch (error: any) {
    console.error('Error creating custom token:', error);
    return NextResponse.json({ error: 'Failed to create custom token', details: error.message }, { status: 500 });
  }
}
