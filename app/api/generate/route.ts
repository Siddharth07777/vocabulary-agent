import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateDeterministic, batchSemanticVerify, QUALITY_THRESHOLD, MAX_RETRIES } from "@/lib/validator";

async function generateWithGemini(word: string) {
  const prompt = `
Generate for word "${word}":
- meaning: concise definition (15-30 words)
- synonyms: 4 true synonyms
- antonyms: 3 true antonyms
- examples: 2 example sentences using the word
- mcqs: 2 MCQs, each 4 options, 1 correct answer index
Return ONLY JSON: {"meaning":"...","synonyms":[],"antonyms":[],"examples":[],"mcqs":[{"question":"...","options":["","","",""],"answer":0}]}
`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
  );
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function POST(req: Request) {
  const { word_id } = await req.json();
  if (!word_id) return NextResponse.json({ error: "word_id required" }, { status: 400 });

  const { data: wordRow } = await supabaseAdmin.from("words").select("*").eq("id", word_id).single();
  if (!wordRow) return NextResponse.json({ error: "word not found" }, { status: 404 });

  let attempt = 0;
  let bestResult: any = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    const gen = await generateWithGemini(wordRow.word);

    const deterministic = validateDeterministic({
      word: wordRow.word,
      meaning: gen.meaning,
      synonyms: gen.synonyms,
      antonyms: gen.antonyms,
      examples: gen.examples,
      mcqs: gen.mcqs,
    });

    const semantic = await batchSemanticVerify(wordRow.word, gen.synonyms, gen.antonyms);

    const finalSyns = semantic.validSynonyms;
    const finalAnts = semantic.validAntonyms;

    const score = deterministic.score;
    if (score >= QUALITY_THRESHOLD && finalSyns.length >= 2 && finalAnts.length >= 1) {
      // Save to your tables using SERVICE_ROLE (allowed by RLS)
      await supabaseAdmin.from("word_content").upsert({ word_id, meaning: gen.meaning, examples: gen.examples });
      await supabaseAdmin.from("mcqs").insert(gen.mcqs.map((m: any) => ({ word_id,...m })));
      await supabaseAdmin.from("words").update({ status: "ready" }).eq("id", word_id);
      await supabaseAdmin.from("generation_jobs").insert({ word_id, status: "completed", score, attempts: attempt });
      return NextResponse.json({ status: "ready", score, attempts: attempt, synonyms: finalSyns, antonyms: finalAnts });
    }
    bestResult = { gen, deterministic, semantic };
  }

  await supabaseAdmin.from("generation_jobs").insert({ word_id, status: "failed", score: bestResult?.deterministic?.score || 0, attempts: MAX_RETRIES });
  return NextResponse.json({ status: "failed", bestResult }, { status: 422 });
}
