import { createClient } from "@supabase/supabase-js";
export default async function handler(req, res) {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hasUrl || !hasKey) {
    return res.status(500).json({ error: "Missing env vars", hasUrl, hasKey, envKeys: Object.keys(process.env).filter(k=>k.includes('SUPABASE')) });
  }
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from("words").select("*").limit(5);
    if (error) throw error;
    return res.status(200).json({ words: data, count: data?.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
