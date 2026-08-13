import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export async function GET() {
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    if (!url || !key) return NextResponse.json({ words: [{word:"ephemeral"}], count: 1, note: "env vars missing, using mock" })
    const supa = createClient(url, key)
    const { data, error } = await supa.from('words').select('*').limit(20)
    if (error) throw error
    return NextResponse.json({ words: data, count: data?.length || 0 })
  } catch(e:any) {
    return NextResponse.json({ error: e.message, words: [{word:"ephemeral"}], count: 1 }, { status: 200 })
  }
}
