QUALITY_THRESHOLD = 75

def semantic_check_local(word, data):
    w = word.lower()
    syns = [s.lower() for s in data.get("synonyms", [])]
    ants = [a.lower() for a in data.get("antonyms", [])]
    if w in syns: return False, "word in synonyms"
    if w in ants: return False, "word in antonyms"
    if set(syns) & set(ants): return False, "overlap syn/ant"
    return True, "PASS"

def validate_content(word, data):
    checks = {}
    w = word.lower().strip()

    checks["WORD_VALID"] = isinstance(data.get("word"), str) and data.get("word","").lower() == w

    meaning = data.get("meaning") or data.get("definition") or ""
    checks["MEANING_VALID"] = isinstance(meaning, str) and len(meaning.strip()) >= 10

    syns = data.get("synonyms", [])
    checks["SYNONYMS_VALID"] = isinstance(syns, list) and len(syns) >= 2

    ants = data.get("antonyms", [])
    checks["ANTONYMS_VALID"] = isinstance(ants, list) and len(ants) >= 1

    exs = data.get("examples", [])
    checks["EXAMPLES_VALID"] = isinstance(exs, list) and len(exs) >= 1

    mcq = data.get("mcq", {})
    if isinstance(mcq, dict):
        checks["MCQ_VALID"] = bool(mcq.get("question") and mcq.get("options") and mcq.get("answer"))
    else:
        checks["MCQ_VALID"] = isinstance(mcq, list) and len(mcq) > 0

    # PYQ - accept BOTH formats: strict PYQ_STYLE list OR simple status
    pyqs = data.get("pyqs")
    pyq_ok = False
    if isinstance(pyqs, list) and len(pyqs) > 0:
        pyq_ok = True
        for q in pyqs:
            if q.get("source_type")!= "PYQ_STYLE": pyq_ok=False; break
            if q.get("exam_year") is not None: pyq_ok=False; break
            if q.get("exam_name") is not None: pyq_ok=False; break
    elif data.get("pyqStatus") or data.get("pyq_status") or data.get("pyq"):
        pyq_ok = True
    checks["PYQ_STATUS_VALID"] = pyq_ok

    semantic_ok, reason = semantic_check_local(word, data)
    checks["SEMANTIC_LOCAL_VALID"] = semantic_ok

    passed = sum(1 for v in checks.values() if v)
    total = len(checks)
    score = round((passed/total)*100)
    return {"passed": score >= QUALITY_THRESHOLD, "score": score, "checks": checks, "semantic_reason": reason}

def parse_json(text: str) -> dict:
    import json
    text = text.strip().replace("```json","").replace("```","")
    return json.loads(text)
