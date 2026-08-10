import { createClient } from "@supabase/supabase-js";

const MODEL = "gemini-2.5-flash-lite";
const MAX_RETRIES = 3;
const QUALITY_THRESHOLD = 90;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geminiWithBackoff(prompt, schema) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing");
  }
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${MODEL}:generateContent?key=${apiKey}`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema }
        })
      });
      if (response.ok) {
        const body = await response.json();
        const text = body?.candidates?.[0]?.content?.parts?.map(x => x.text || "").join("").trim();
        if (!text) throw new Error("Gemini returned empty output");
        return JSON.parse(text);
      }
      const errorText = await response.text();
      lastError = new Error(`Gemini HTTP ${response.status}: ${errorText}`);
      if (response.status!== 429 && response.status!== 500 && response.status!== 502 && response.status!== 503) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;
    }
    const base = 1000 * (2 ** attempt);
    const jitter = Math.floor(Math.random() * 500);
    await sleep(base + jitter);
  }
  throw lastError || new Error("Gemini request failed");
}

const CONTENT_SCHEMA = {
  type: "object",
  properties: {
    word: { type: "string" },
    part_of_speech: { type: "string" },
    simple_meaning: { type: "string" },
    synonyms: { type: "array", items: { type: "string" } },
    antonyms: { type: "array", items: { type: "string" } },
    examples: { type: "array", items: { type: "string" } },
    mcqs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_answer: { type: "string" },
          explanation: { type: "string" }
        },
        required: ["question", "options", "correct_answer", "explanation"]
      }
    },
    pyqs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_answer: { type: "string" },
          explanation: { type: "string" },
          source_type: { type: "string" },
          exam_name: { type: ["string", "null"] },
          exam_year: { type: ["integer", "null"] }
        },
        required: ["question", "options", "correct_answer", "explanation", "source_type", "exam_name", "exam_year"]
      }
    }
  },
  required: ["word", "part_of_speech", "simple_meaning", "synonyms", "antonyms", "examples", "mcqs", "pyqs"]
};

function norm(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function uniqueStrings(values) {
  if (!Array.isArray(values)) return false;
  const normalized = values.map(norm);
  return normalized.length === new Set(normalized).size;
}
function deterministicValidate(word, data) {
  const checks = {};
  const target = norm(word);
  checks.WORD_VALID = norm(data.word) === target;
  checks.MEANING_VALID = typeof data.simple_meaning === "string" && data.simple_meaning.trim().length >= 10;
  checks.SYNONYMS_VALID = Array.isArray(data.synonyms) && data.synonyms.length >= 2 && data.synonyms.length <= 12 && data.synonyms.every(x => typeof x === "string" && x.trim().length > 0) && uniqueStrings(data.synonyms) &&!data.synonyms.some(x => norm(x) === target);
  checks.ANTONYMS_VALID = Array.isArray(data.antonyms) && data.antonyms.length >= 2 && data.antonyms.length <= 12 && data.antonyms.every(x => typeof x === "string" && x.trim().length > 0) && uniqueStrings(data.antonyms) &&!data.antonyms.some(x => norm(x) === target);
  const synSet = new Set((data.synonyms || []).map(norm));
  const antSet = new Set((data.antonyms || []).map(norm));
  const overlap = [...synSet].filter(x => antSet.has(x));
  checks.SYN_ANT_CROSSCHECK = overlap.length === 0;
  checks.EXAMPLES_VALID = Array.isArray(data.examples) && data.examples.length >= 2 && data.examples.length <= 5 && data.examples.every(x => typeof x === "string" && x.trim().length >= 8);
  checks.MCQ_VALID = Array.isArray(data.mcqs) && data.mcqs.length >= 3 && data.mcqs.length <= 5 && data.mcqs.every(mcq => {
    const options = mcq?.options;
    return typeof mcq?.question === "string" && Array.isArray(options) && options.length === 4 && new Set(options.map(norm)).size === 4 && options.every(x => typeof x === "string" && x.trim()) && options.map(norm).includes(norm(mcq.correct_answer)) && typeof mcq.explanation === "string" && mcq.explanation.trim().length >= 5;
  });
  checks.PYQ_STATUS_VALID = Array.isArray(data.pyqs) && data.pyqs.length >= 1 && data.pyqs.every(q => q?.source_type === "PYQ_STYLE" && q?.exam_name == null && q?.exam_year == null);
  return { checks, overlap };
}
async function semanticBatchCheck(word, meaning, synonyms, antonyms) {
  const prompt = `
You are a strict vocabulary semantic validator.
Target word:
${word}
Simple meaning:
${meaning}
Synonyms:
${JSON.stringify(synonyms)}
Antonyms:
${JSON.stringify(antonyms)}
Check every synonym and every antonym.
Rules:
1. A synonym must genuinely express the same or substantially equivalent meaning in the supplied context.
2. An antonym must represent a meaningful opposite.
3. Do not accept merely related words.
4. Do not accept words that are only loosely associated.
5. Reject a synonym if it is actually an opposite.
6. Reject an antonym if it is merely related but not opposite.
7. Return ONLY JSON.
Schema:
{
  "invalid_synonyms": [],
  "invalid_antonyms": [],
  "reason": ""
}
`;
  const schema = {
    type: "object",
    properties: {
      invalid_synonyms: { type: "array", items: { type: "string" } },
      invalid_antonyms: { type: "array", items: { type: "string" } },
      reason: { type: "string" }
    },
    required: ["invalid_synonyms", "invalid_antonyms", "reason"]
  };
  return geminiWithBackoff(prompt, schema);
}
function qualityScore(deterministic, semantic) {
  const checks = {...deterministic.checks, SEMANTIC_SYNONYMS_VALID: semantic.invalid_synonyms.length === 0, SEMANTIC_ANTONYMS_VALID: semantic.invalid_antonyms.length === 0 };
  const total = Object.keys(checks).length;
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, score: Math.round((passed / total) * 100) };
}
function buildRepairPrompt(word, data, failed) {
  return `
Repair ONLY the failed sections.
Target:
${word}
Current JSON:
${JSON.stringify(data)}
Failed sections:
${JSON.stringify(failed)}
Do NOT rewrite correct sections.
Requirements:
- preserve correct meaning
- preserve correct examples
- preserve correct MCQs
- preserve correct PYQ_STYLE status
- repair only invalid synonyms/antonyms/MCQs/etc.
- never invent REAL_PYQ
- PYQ entries must remain PYQ_STYLE
- return the COMPLETE JSON object
- output JSON only
`;
}
async function processJob({ word, sourceText, contentHash }) {
  const { data: existingJob } = await supabase.from("generation_jobs").select("*").eq("content_hash", contentHash).maybeSingle();
  if (existingJob && existingJob.status === "published") return { ok: true, status: "already_published" };
  if (existingJob && existingJob.attempts >= existingJob.max_attempts) return { ok: false, status: "review" };
  if (!existingJob) {
    const { data: wordRow } = await supabase.from("words").select("id").eq("word", word).maybeSingle();
    const { data: job, error } = await supabase.from("generation_jobs").insert({ word, word_id: wordRow?.id || null, content_hash: contentHash, status: "pending", attempts: 0, max_attempts: MAX_RETRIES }).select().single();
    if (error) { if (error.code!== "23505") throw error; } else { console.log(`Created job ${job.id}`); }
  }
  const { data: job } = await supabase.from("generation_jobs").select("*").eq("content_hash", contentHash).single();
  if (job.status === "published") return { ok: true, status: "already_published" };
  if (job.attempts >= job.max_attempts) return { ok: false, status: "review" };
  const nextAttempt = job.attempts + 1;
  await supabase.from("generation_jobs").update({ status: "generating", attempts: nextAttempt, last_error: null }).eq("id", job.id);
  await supabase.from("words").update({ status: "generating", attempts: nextAttempt, last_error: null }).eq("word", word);
  let data;
  try {
    data = await geminiWithBackoff(`
Create vocabulary study material for:
WORD:
${word}
USER INPUT:
${sourceText}
Rules:
- Meaning must be simple and accurate.
- Give 3-8 genuine synonyms.
- Give 3-8 genuine antonyms.
- Give 2-5 natural example sentences.
- Create 3-5 MCQs.
- Create 1-3 PYQ-style questions.
- PYQ-style means inspired by competitive-exam format.
- NEVER claim generated questions are real previous-year questions.
- Every pyq.source_type MUST be PYQ_STYLE.
- exam_name MUST be null.
- exam_year MUST be null.
- No prose outside JSON.
        `, CONTENT_SCHEMA);
    await supabase.from("generation_jobs").update({ status: "validating" }).eq("id", job.id);
    await supabase.from("words").update({ status: "validating" }).eq("word", word);
    let finalValidation = null;
    for (let repair = 0; repair <= MAX_RETRIES; repair++) {
      const deterministic = deterministicValidate(word, data);
      const semantic = await semanticBatchCheck(word, data.simple_meaning, data.synonyms, data.antonyms);
      const quality = qualityScore(deterministic, semantic);
      finalValidation = { score: quality.score, checks: quality.checks, semantic_reason: semantic.reason };
      if (quality.score >= QUALITY_THRESHOLD) break;
      if (repair >= MAX_RETRIES) break;
      const failed = Object.entries(quality.checks).filter(([, passed]) =>!passed).map(([name]) => name);
      data = await geminiWithBackoff(buildRepairPrompt(word, data, failed), CONTENT_SCHEMA);
    }
    if (!finalValidation || finalValidation.score < QUALITY_THRESHOLD) {
      await supabase.from("generation_jobs").update({ status: nextAttempt >= MAX_RETRIES? "review" : "failed", last_error: "Quality threshold not reached" }).eq("id", job.id);
      await supabase.from("words").update({ status: nextAttempt >= MAX_RETRIES? "review" : "failed", last_error: "Quality threshold not reached" }).eq("word", word);
      return { ok: false, status: "quality_failed", validation: finalValidation };
    }
    data.validation = finalValidation;
    const { data: wordRow, error: wordError } = await supabase.from("words").select("id").eq("word", word).single();
    if (wordError) throw wordError;
    const { data: contentRow, error: contentError } = await supabase.from("word_content").upsert({ word_id: wordRow.id, word: data.word, part_of_speech: data.part_of_speech, simple_meaning: data.simple_meaning, synonyms: data.synonyms, antonyms: data.antonyms, examples: data.examples, validation: data.validation, content_hash: contentHash }, { onConflict: "word_id" }).select().single();
    if (contentError) throw contentError;
    await supabase.from("mcqs").delete().eq("word_id", wordRow.id);
    const mcqRows = data.mcqs.map(mcq => ({ word_id: wordRow.id, question: mcq.question, options: mcq.options, correct_answer: mcq.correct_answer, explanation: mcq.explanation, source_type: "PYQ_STYLE" }));
    const pyqRows = data.pyqs.map(q => ({ word_id: wordRow.id, question: q.question, options: q.options, correct_answer: q.correct_answer, explanation: q.explanation, source_type: "PYQ_STYLE", exam_name: null, exam_year: null }));
    const { error: mcqError } = await supabase.from("mcqs").insert([...mcqRows,...pyqRows]);
    if (mcqError) throw mcqError;
    await supabase.from("generation_jobs").update({ status: "published", last_error: null }).eq("id", job.id);
    await supabase.from("words").update({ status: "published", last_error: null }).eq("word", word);
    return { ok: true, status: "published", word, validation: finalValidation, content_id: contentRow.id };
  } catch (error) {
    await supabase.from("generation_jobs").update({ status: nextAttempt >= MAX_RETRIES? "review" : "failed", last_error: String(error.message || error) }).eq("id", job.id);
    await supabase.from("words").update({ status: nextAttempt >= MAX_RETRIES? "review" : "failed", last_error: String(error.message || error) }).eq("word", word);
    throw error;
  }
}
export default async function handler(req, res) {
  if (req.headers["x-webhook-secret"]!== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (req.method!== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    const { word, source_text = "", content_hash } = req.body || {};
    if (typeof word!== "string" ||!word.trim() || typeof content_hash!== "string" ||!content_hash.trim()) {
      return res.status(400).json({ error: "invalid_request" });
    }
    const result = await processJob({ word: word.trim().toLowerCase(), sourceText: String(source_text), contentHash: content_hash.trim() });
    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
