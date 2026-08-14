from __future__ import annotations
import json
import os
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

HOME = Path("/data/data/com.termux/files/home")
WATCH = HOME / "storage/shared/Vocabulary"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
VERCEL_GENERATE_URL = os.environ.get("VERCEL_GENERATE_URL", "https://vocabulary-agent.vercel.app/api/generate")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")

def trigger(folder: Path):
    word_file = folder / "word.txt"
    if not word_file.exists():
        return False
    text = word_file.read_text(encoding="utf-8").strip()
    if not text:
        return False
    word = folder.name.lower().strip()
    content_hash = hashlib.sha256((word + "\n" + text).encode("utf-8")).hexdigest()
    payload = {"word": word, "source_text": text, "content_hash": content_hash}
    req = Request(
        VERCEL_GENERATE_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "x-webhook-secret": WEBHOOK_SECRET},
        method="POST"
    )
    with urlopen(req, timeout=60):
        pass
    return True

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, x-webhook-secret")
        self.end_headers()

    def do_POST(self):
        if self.path != "/sync":
            self.send_response(404)
            self.end_headers()
            return
        triggered = 0
        if WATCH.exists():
            for folder in WATCH.iterdir():
                if not folder.is_dir():
                    continue
                try:
                    if trigger(folder):
                        triggered += 1
                except Exception as exc:
                    print(f"Sync failed for {folder}: {exc}")
        body = json.dumps({"ok": True, "triggered": triggered}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return  # quiet

def main():
    print(f"Local sync server: http://127.0.0.1:8000  WATCH={WATCH}")
    server = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
    server.serve_forever()

if __name__ == "__main__":
    main()
