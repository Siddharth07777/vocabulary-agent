export const MAX_RETRIES = 3
export const QUALITY_THRESHOLD = 0.7

export function isValidWord(word: string) {
  return typeof word === 'string' && word.trim().length > 0 && word.trim().length < 50
}
export function validator(word: string) { return isValidWord(word) }
export function validateDeterministic(word: string) { return isValidWord(word) }
export async function batchSemanticVerify(words: any) { return { valid: true, results: words } }
export async function semanticVerify(word: string) { return true }

export default { isValidWord, validator, validateDeterministic, batchSemanticVerify, MAX_RETRIES, QUALITY_THRESHOLD }
