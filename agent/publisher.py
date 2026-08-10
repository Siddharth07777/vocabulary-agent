from __future__ import annotations
import hashlib, json, os, tempfile
from pathlib import Path

GENERATED = Path("/data/data/com.termux/files/home/vocabulary-agent/generated")
GENERATED.mkdir(parents=True, exist_ok=True)

def content_hash(data: dict) -> str:
    # remove old hash before hashing
    clean = {k:v for k,v in data.items() if k != "content_hash"}
    raw = json.dumps(clean, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

def atomic_write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_path, path)
    except Exception:
        try: os.unlink(temp_path)
        except: pass
        raise

def publish(word: str, data: dict) -> Path:
    data["content_hash"] = content_hash(data)
    output = GENERATED / f"{word.lower()}.json"

    if output.exists():
        try:
            existing = json.loads(output.read_text(encoding="utf-8"))
            # check both formats: validation.score or score
            existing_score = existing.get("validation", {}).get("score", existing.get("score", 0))
            existing_hash = existing.get("content_hash")
            # Don't overwrite a perfect 100% file with same hash
            if existing_score >= 90 and existing_hash == data["content_hash"]:
                print(f"Skip {word}: already {existing_score}% with same hash")
                return output
        except Exception:
            pass

    atomic_write_json(output, data)
    return output
