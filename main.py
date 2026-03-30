import webview
import threading
import os
import sys
from server import init_db, WordHandler, PORT
import socketserver

def start_server():
    init_db()
    with socketserver.TCPServer(("127.0.0.1", PORT), WordHandler) as httpd:
        httpd.serve_forever()

if __name__ == "__main__":
    # Start the backend server in a separate thread
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()

    # Create the pywebview window
    # In production, this would point to the local server
    webview.create_window('WordFlow Desktop', f'http://127.0.0.1:{PORT}')
    webview.start()
