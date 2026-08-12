import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export default async function handler(req, res) {
  if (req.method!== "GET") return res.status(405).json({ error: "method_not_allowed" });
  try {
    const { data: words, error } = await supabase.from("words").select("id, word, status, word_content(word, part_of_speech, simple_meaning, synonyms, antonyms, examples)").eq("status", "published").order("word").limit(30);
    if (error) throw error;
    return res.status(200).json({ words });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
