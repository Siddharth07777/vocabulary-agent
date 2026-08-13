export function isValidWord(word: string) {
  return typeof word === 'string' && word.trim().length > 0 && word.trim().length < 50
}
export function validator(word: string) { return isValidWord(word) }
export default { isValidWord, validator }
