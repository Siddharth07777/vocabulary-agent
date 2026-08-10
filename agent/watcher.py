from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from urllib.request import Request, urlopen

HOME = Path("/data/data/com.termux/files/home")
WATCH = HOME / "storage/shared/Vocabulary"
GEN = HOME / "vocabulary-agent/generated"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
VERCEL_GENERATE_URL = os.environ.get("VERCEL_GENERATE_URL", "")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")

POLL_SECONDS = 10
GEN.mkdir(parents=True, exist_ok=True)

def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def read_word(folder: Path):
    word_file = folder / "word.txt"
    if not word_file.exists():
        return None
    text = word_file.read_text(encoding="utf-8").strip()
    if not text:
        return None
    word = folder.name.strip().lower()
    return word, text

def supabase_headers():
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def get_existing_hash(word: str, content_hash: str) -> bool:
    if not SUPABASE_URL:
        return False
    url = f"{SUPABASE_URL}/rest/v1/words?word=eq.{word}&content_hash=eq.{content_hash}&select=id,status&limit=1"
    request = Request(url, headers=supabase_headers(), method="GET")
    try:
        with urlopen(request, timeout=10) as response:
            rows = json.loads(response.read())
            return bool(rows)
    except Exception as exc:
        print(f"Supabase lookup failed: {exc}")
        return False

def insert_word(word: str, source_text: str, content_hash: str, source_path: str):
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL missing")
    payload = {
        "word": word,
        "source_text": source_text,
        "content_hash": content_hash,
        "source_path": source_path,
        "status": "pending"
    }
    url = f"{SUPABASE_URL}/rest/v1/words"
    request = Request(url, data=json.dumps(payload).encode(), headers=supabase_headers(), method="POST")
    with urlopen(request, timeout=15) as response:
        return json.loads(response.read())

def trigger_generate(word: str, source_text: str, content_hash: str):
    payload = {"word": word, "source_text": source_text, "content_hash": content_hash}
    request = Request(
        VERCEL_GENERATE_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "x-webhook-secret": WEBHOOK_SECRET},
        method="POST"
    )
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read())

def scan_once():
    if not WATCH.exists():
        print(f"Watch folder missing: {WATCH}")
        return
    for folder in WATCH.iterdir():
        if not folder.is_dir():
            continue
        result = read_word(folder)
        if result is None:
            continue
        word, source_text = result
        content_hash = sha256_text(word + "\n" + source_text)
        print(f"FOUND: {word} [{content_hash[:12]}]")
        if get_existing_hash(word, content_hash):
            print(f"SKIP: {word} already known")
            continue
        try:
            insert_word(word, source_text, content_hash, str(folder))
            print(f"DB INSERT: {word}")
        except Exception as exc:
            print(f"DB insert skipped/failed: {exc}")
        try:
            result = trigger_generate(word, source_text, content_hash)
            print(f"GENERATE: {result}")
        except Exception as exc:
            print(f"GENERATION TRIGGER FAILED: {exc}")

def main():
    print("Vocabulary Agent watcher started")
    print(f"Watching: {WATCH}")
    while True:
        try:
            scan_once()
        except Exception as exc:
            print(f"WATCHER ERROR: {exc}")
        time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    main()
