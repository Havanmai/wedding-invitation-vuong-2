"""Local static server for the saved chungdoi.com page.

Serves the folder statically, and stubs the original site's
tracking/infrastructure endpoints so the saved page loads cleanly:

  /g9df/*  -> JS stub (first-party GTM container, tracking disabled)
  /api/*   -> JSON stub (geo lookup, error reporting, QR endpoint...)

Run:  python serve.py   then open  http://127.0.0.1:8123/vuong.html
"""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8123
HOST = "127.0.0.1"


class StubbedHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        stub = self._stub_response()
        if stub is not None:
            self._respond(*stub)
            return
        super().do_GET()

    def do_POST(self):
        stub = self._stub_response()
        if stub is not None:
            self._respond(*stub)
            return
        self.send_error(404)

    def _stub_response(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/g9df"):
            return (b"/* tracking stub - disabled on local copy */", "application/javascript")
        if path.startswith("/api/"):
            if path == "/api/geo":
                payload = {"country": "VN"}
                return (json.dumps(payload).encode(), "application/json")
            return (b"{}", "application/json")
        return None

    def _respond(self, body, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # keep the console window quiet


if __name__ == "__main__":
    print(f"Serving D:/Learn/Vuong")
    print(f"Open:  http://{HOST}:{PORT}/vuong.html")
    print("Keep this window open. Press Ctrl+C to stop.")
    ThreadingHTTPServer((HOST, PORT), StubbedHandler).serve_forever()
