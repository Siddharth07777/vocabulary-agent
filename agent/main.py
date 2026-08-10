import os, json, requests

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def generate_initial(word: str):
    # If key exists, ask Gemini for REAL definition
    if GEMINI_API_KEY:
        prompt = f'For word "{word}" return ONLY JSON: {{"word":"{word}","meaning":"short meaning","definition":"detailed","synonyms":["3 words"],"antonyms":["2 words"],"examples":["sentence1 with {word}","sentence2"],"mcq":{{"question":"What does {word} mean?","options":["a","b","c","d"],"answer":"a"}},"pyqs":[{{"source_type":"PYQ_STYLE","exam_year":None,"exam_name":None}}]}}'
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
            r = requests.post(url, json={"contents":[{"parts":[{"text":prompt}]}]}, timeout=15)
            r.raise_for_status()
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"].replace("```json","").replace("```","").strip()
            data = json.loads(text)
            print(f"Gemini generated real meaning for {word}")
            return data
        except Exception as e:
            print(f"Gemini gen failed, using mock: {e}")

    # Fallback mock
    return {
        "word": word,
        "meaning": f"mock meaning for {word}",
        "definition": f"mock definition for {word}",
        "synonyms": ["subside","lessen","diminish"],
        "antonyms": ["intensify","increase"],
        "examples": [f"The {word} example 1.", f"The {word} example 2."],
        "mcq": {"question": f"What does {word} mean?","options":["a","b","c","d"],"answer":"a"},
        "pyqs": [{"source_type":"PYQ_STYLE","exam_year":None,"exam_name":None}]
    }

def run_word(word: str):
    from agent.generator import generate_word_payload
    from agent.publisher import publish
    print(f"-> Generating initial for: {word}")
    llm_out = generate_initial(word)
    result = generate_word_payload(word, llm_out)
    print(f"Result: {result['status']} score {result['score']}")
    if result["status"] == "ready":
        path = publish(word, result["data"])
        print(f"✅ PUBLISHED: {path}")

if __name__ == "__main__":
    import sys
    run_word(sys.argv[1] if len(sys.argv)>1 else "abate")
