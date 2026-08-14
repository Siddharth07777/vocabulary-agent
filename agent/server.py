from __future__ import annotations
import json, os, hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

HOME = Path("/data/data/com.termux/files/home")
WATCH = HOME / "storage/shared/Vocabulary"
VERCEL_GENERATE_URL = os.environ.get("VERCEL_GENERATE_URL", "https://vocabulary-agent.vercel.app/api/generate")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")

def trigger(folder: Path):
    word_file = folder / "word.txt"
    if not word_file.exists(): return False
    text = word_file.read_text(encoding="utf-8").strip()
    if not text: return False
    word = folder.name.lower().strip()
    content_hash = hashlib.sha256((word + "\n" + text).encode()).hexdigest()
    payload = {"word": word, "source_text": text, "content_hash": content_hash}
    req = Request(VERCEL_GENERATE_URL, data=json.dumps(payload).encode(), headers={"Content-Type":"application/json","x-webhook-secret":WEBHOOK_SECRET}, method="POST")
    try:
        with urlopen(req, timeout=60) as r:
            print(f"OK {folder.name} -> {r.read().decode()}")
    except HTTPError as e:
        body = e.read().decode()
        print(f"FAIL {folder.name} HTTP {e.code}: {body}")
        raise
    return True

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self.send_header("Access-Control-Allow-Origin","*"); self.send_header("Access-Control-Allow-Methods","POST, OPTIONS"); self.send_header("Access-Control-Allow-Headers","Content-Type, x-webhook-secret"); self.end_headers()
    def do_POST(self):
        if self.path != "/sync": self.send_response(404); self.end_headers(); return
        triggered=0
        if WATCH.exists():
            for folder in WATCH.iterdir():
                if not folder.is_dir(): continue
                try:
                    if trigger(folder): triggered+=1
                except Exception as exc: print(f"Sync failed for {folder}: {exc}")
        body=json.dumps({"ok":True,"triggered":triggered}).encode()
        self.send_response(200); self.send_header("Content-Type","application/json"); self.send_header("Access-Control-Allow-Origin","*"); self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): return

def main():
    print(f"Local sync server: http://127.0.0.1:8000 WATCH={WATCH}")
    ThreadingHTTPServer(("127.0.0.1",8000), Handler).serve_forever()
if __name__ == "__main__": main()
