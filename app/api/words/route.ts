import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabase.from('words').select('*').limit(20)
    
    if (error) throw error
    return NextResponse.json({ words: data, count: data?.length || 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
