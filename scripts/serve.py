#!/usr/bin/env python3
"""
Lightweight development server for FLake website.
Serves static build directory while responding to health check endpoints
like /api/status cleanly without log spam.
"""

import http.server
import json
import os
import socketserver
import sys

def run_server(directory="_site", port=8000):
    abs_dir = os.path.abspath(directory)

    class DevHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=abs_dir, **kwargs)

        def do_GET(self):
            if self.path in ('/api/status', '/api/status/', '/api/health'):
                data = json.dumps({'status': 'ok', 'app': 'flake-lake-model'}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            super().do_GET()

        def log_message(self, format, *args):
            # Silence repetitive health check logs from /api/status
            if len(args) > 0 and any(h in str(args[0]) for h in ('/api/status', '/api/health')):
                return
            super().log_message(format, *args)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', port), DevHandler) as httpd:
        print(f"Serving FLake website from '{abs_dir}' on http://localhost:{port} ...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    dir_arg = sys.argv[1] if len(sys.argv) > 1 else "_site"
    port_arg = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
    run_server(dir_arg, port_arg)
