from agent.validator import validate_content, QUALITY_THRESHOLD
import os

MAX_RETRIES = 2

def generate_word_payload(word: str, llm_output: dict):
    from agent.gemini_validator import batch_semantic_verify
    attempt = 0
    while attempt < MAX_RETRIES:
        attempt += 1
        result = validate_content(word, llm_output)
        # Gemini is optional - never crash on it
        if os.getenv("GEMINI_API_KEY"):
            try:
                syns = llm_output.get("synonyms", [])
                ants = llm_output.get("antonyms", [])
                valid_syns, valid_ants, _ = batch_semantic_verify(word, syns, ants)
                llm_output["synonyms"] = valid_syns
                llm_output["antonyms"] = valid_ants
                result = validate_content(word, llm_output)
            except Exception as e:
                print(f"Validator fallback: {e}")

        print(f"Attempt {attempt}: score {result['score']}%")
        if result["score"] >= QUALITY_THRESHOLD:
            return {"status": "ready", "score": result["score"], "data": llm_output, "checks": result["checks"]}
    return {"status": "failed", "score": result["score"], "data": llm_output, "checks": result["checks"]}
