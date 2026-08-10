import os, json, requests

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def batch_semantic_verify(word: str, synonyms: list, antonyms: list):
    if not GEMINI_API_KEY:
        return synonyms, antonyms, {"fallback": "no key - offline mode"}

    json_example = '{"validSynonyms": [], "validAntonyms": []}'
    prompt = f'Word: {word} Syns: {synonyms} Ants: {antonyms} Return {json_example}'

    # Try only 1 best model with short timeout
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    try:
        r = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=8)
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        clean = text.replace("```json","").replace("```","").strip()
        data = json.loads(clean)
        print(f"Gemini OK using {url.split('/')[-2]}")
        return data.get("validSynonyms", synonyms), data.get("validAntonyms", antonyms), {"ok": True}
    except Exception as e:
        print(f"Gemini skip (offline): {str(e)[:100]}")
        return synonyms, antonyms, {"fallback": str(e)[:100]}
