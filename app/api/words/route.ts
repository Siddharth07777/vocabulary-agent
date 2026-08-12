import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    return NextResponse.json({ error: "Missing env vars", hasUrl: !!url, hasKey: !!key }, { status: 500 });
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from("words").select("*").limit(10);
    if (error) throw error;
    return NextResponse.json({ words: data, count: data?.length, url_prefix: url.substring(0, 30) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
