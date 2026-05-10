import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    await supabase.from('organizations').select('count').limit(1)

    return NextResponse.json({ status: 'ok', supabase: 'connected' })
  } catch {
    return NextResponse.json({ status: 'error', supabase: 'disconnected' }, { status: 503 })
  }
}
