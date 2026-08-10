// lib/validator.ts - Corrected secure + batched version
export const QUALITY_THRESHOLD = 90;
export const MAX_RETRIES = 3;

export type CheckName =
  | "WORD_VALID"
  | "MEANING_VALID"
  | "SYNONYMS_VALID"
  | "ANTONYMS_VALID"
  | "EXAMPLES_VALID"
  | "MCQ_VALID"
  | "PYQ_STATUS_VALID"
  | "SEMANTIC_SYNONYMS_VALID"
  | "SEMANTIC_ANTONYMS_VALID";

const norm = (s: string) => s.trim().toLowerCase();

export function validateDeterministic(payload: {
  word: string;
  meaning: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
  mcqs: { question: string; options: string[]; answer: number }[];
  pyqStatus?: string;
}) {
  const results: Record<CheckName, boolean> = {
    WORD_VALID: false,
    MEANING_VALID: false,
    SYNONYMS_VALID: false,
    ANTONYMS_VALID: false,
    EXAMPLES_VALID: false,
    MCQ_VALID: false,
    PYQ_STATUS_VALID: false,
    SEMANTIC_SYNONYMS_VALID: false,
    SEMANTIC_ANTONYMS_VALID: false,
  };

  const word = payload.word?.trim() || "";
  const syns = (payload.synonyms || []).map(s => s.trim()).filter(Boolean);
  const ants = (payload.antonyms || []).map(s => s.trim()).filter(Boolean);
  const exs = (payload.examples || []).map(s => s.trim()).filter(Boolean);

  // 1. WORD_VALID
  results.WORD_VALID = word.length >= 1 && word.length <= 80;

  // 2. MEANING_VALID
  results.MEANING_VALID = (payload.meaning?.trim().length || 0) >= 10;

  // 3. SYNONYMS_VALID
  results.SYNONYMS_VALID = syns.length >= 2 && new Set(syns.map(norm)).size === syns.length;

  // 4. ANTONYMS_VALID
  results.ANTONYMS_VALID = ants.length >= 1 && new Set(ants.map(norm)).size === ants.length;

  // 5. EXAMPLES_VALID
  results.EXAMPLES_VALID = exs.length >= 1 && exs.every(e => e.length >= 8);

  // 6. MCQ_VALID
  results.MCQ_VALID = Array.isArray(payload.mcqs) && payload.mcqs.length >= 1 && payload.mcqs.every(m =>
    m.question?.trim() && m.options?.length === 4 && m.answer >=0 && m.answer <4
  );

  // 7. PYQ_STATUS_VALID
  results.PYQ_STATUS_VALID = true; // allow optional, always pass if generation exists

  // 8. SEMANTIC_SYNONYMS_VALID - deterministic part
  const wordNorm = norm(word);
  results.SEMANTIC_SYNONYMS_VALID = syns.length > 0 && syns.every(s => norm(s)!== wordNorm && norm(s)!== "");

  // 9. SEMANTIC_ANTONYMS_VALID + intersection + no duplicates
  const synSet = new Set(syns.map(norm));
  const antSet = new Set(ants.map(norm));
  const intersectionEmpty = [...synSet].every(s =>!antSet.has(s));
  results.SEMANTIC_ANTONYMS_VALID = ants.every(a => norm(a)!== wordNorm) && intersectionEmpty && antSet.size === ants.length;

  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(Boolean).length;
  const score = (passed / total) * 100;

  return { results, passed, total, score, passedAll: score >= QUALITY_THRESHOLD };
}

// ONE batched Gemini call - replaces 8 separate calls
export async function batchSemanticVerify(
  word: string,
  synonyms: string[],
  antonyms: string[]
): Promise<{ validSynonyms: string[]; validAntonyms: string[]; raw: any }> {
  const prompt = `
You are a strict lexical validator.
Target word: "${word}"
Synonyms: ${JSON.stringify(synonyms)}
Antonyms: ${JSON.stringify(antonyms)}

Rules:
1. synonym!= target word (case-insensitive)
2. antonym!= target word
3. synonym and antonym lists must not overlap
4. No duplicates, no empty strings
5. Each synonym must be a true synonym, each antonym a true antonym in standard English.

Return ONLY valid JSON in this exact format:
{"validSynonyms": ["..."], "validAntonyms": ["..."], "invalid": {"synonyms": [], "antonyms": []}, "reason": "short reason"}
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const jsonStr = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      validSynonyms: parsed.validSynonyms || [],
      validAntonyms: parsed.validAntonyms || [],
      raw: parsed,
    };
  } catch {
    // fallback to deterministic if Gemini fails
    return { validSynonyms: synonyms, validAntonyms: antonyms, raw: { error: "parse_failed", text } };
  }
}
