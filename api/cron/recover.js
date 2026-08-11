import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

export default async function handler(req, res) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (req.headers.authorization !== expected) {
    return res.status(401).json({ error: "unauthorized"   }

  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: jobs, error } = await supabase
      .from("generation_jobs")
      .select("*")
      .in("status", ["generating", "validating"])
      .lt("updated_at", cutoff);

    if (error) throw error;

    const recovered = [];
    const movedToReview = [];

    for (const job of jobs || []) {
      if (job.attempts >= job.max_attempts) {
        await supabase.from("generation_jobs").update({
          status: "review",
          last_error: "Recovered after timeout; max attempts reached"
        }).eq("id", job.id);

        if (job.word) {
          await supabase.from("words").update({
            status: "review",
            last_error: "Generation timed out repeatedly"
          }).eq("word", job.word);
        }
        movedToReview.push(job.word);
      } else {
        await supabase.from("generation_jobs").update({
          status: "pending",
          last_error: "Recovered after stale job timeout"
        }).eq("id", job.id);

        if (job.word) {
          await supabase.from("words").update({
            status: "pending",          }).eq("word", job.word);
        }
        recovered.push(job.word);
      }
    }

    return res.status(200).json({ ok: true, recovered, moved_to_review: movedToReview });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
