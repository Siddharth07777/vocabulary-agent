import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const secret = req.headers.get("x-webhook-secret")
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "bad webhook secret" }, { status: 401 })
  }

  const body = await req.json().catch(()=>({}))
  const word = (body.word || "").toLowerCase().trim()
  const source_text = body.source_text || ""
  const content_hash = body.content_hash || ""

  if (!word) {
    return NextResponse.json({ error: "word required" }, { status: 400 })
  }

  // upsert word as pending - Gemini generation can happen later
  const { error } = await supabaseAdmin
    .from("words")
    .upsert({ word, status: "pending", source_text, content_hash }, { onConflict: "word" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, word, triggered: true })
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST with x-webhook-secret" })
}
