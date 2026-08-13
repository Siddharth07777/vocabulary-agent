export const MAX_RETRIES = 3
export const QUALITY_THRESHOLD = 0.7

export function isValidWord(word: string) {
  return typeof word === 'string' && word.trim().length > 0 && word.trim().length < 50
}
export function validator(word: string) { return isValidWord(word) }

export function validateDeterministic({ word, meaning, synonyms, antonyms, examples, mcqs }: any) {
  let score = 0
  if (meaning && meaning.length > 10) score += 0.3
  if (synonyms && synonyms.length >= 2) score += 0.3
  if (antonyms && antonyms.length >= 1) score += 0.2
  if (examples && examples.length >= 1) score += 0.1
  if (mcqs && mcqs.length >= 1) score += 0.1
  return { score, valid: score >= QUALITY_THRESHOLD }
}

export async function batchSemanticVerify(word: string, synonyms: string[] = [], antonyms: string[] = []) {
  const validSynonyms = synonyms.filter(s => s && s.toLowerCase() !== word.toLowerCase())
  const validAntonyms = antonyms.filter(a => a && a.toLowerCase() !== word.toLowerCase())
  return { validSynonyms, validAntonyms }
}
export async function semanticVerify() { return true }

export default { isValidWord, validator, validateDeterministic, batchSemanticVerify, MAX_RETRIES, QUALITY_THRESHOLD }
