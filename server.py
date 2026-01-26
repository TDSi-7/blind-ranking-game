#!/usr/bin/env python3
"""
Simple HTTP server for the Game Hub
Run this script and open http://localhost:8000 in your browser
"""

import http.server
import socketserver
import webbrowser
import os
import socket
from pathlib import Path

# Try ports starting from 8000, incrementing if unavailable
START_PORT = 8000
MAX_PORT_ATTEMPTS = 10

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def log_message(self, format, *args):
        # Custom log format
        print(f"[{self.log_date_time_string()}] {format % args}")

def is_port_available(port):
    """Check if a port is available"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('', port))
            return True
        except (OSError, socket.error):
            return False

def find_available_port(start_port, max_attempts):
    """Find an available port starting from start_port"""
    for i in range(max_attempts):
        port = start_port + i
        if is_port_available(port):
            return port
    return None

def main():
    # Change to the script's directory
    os.chdir(Path(__file__).parent)
    
    # Find an available port
    port = find_available_port(START_PORT, MAX_PORT_ATTEMPTS)
    
    if port is None:
        print("=" * 60)
        print("ERROR: Could not find an available port!")
        print(f"Tried ports {START_PORT} to {START_PORT + MAX_PORT_ATTEMPTS - 1}")
        print("Please close other servers or try again later.")
        print("=" * 60)
        return
    
    if port != START_PORT:
        print(f"Note: Port {START_PORT} was in use, using port {port} instead")
    
    Handler = MyHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", port), Handler) as httpd:
            url = f"http://localhost:{port}"
            print("=" * 60)
            print(f"Game Hub Server running!")
            print(f"Open your browser and go to: {url}")
            print("=" * 60)
            print(f"Press Ctrl+C to stop the server")
            print("=" * 60)
            
            # Try to open browser automatically
            try:
                webbrowser.open(url)
            except:
                pass
            
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n\nServer stopped. Goodbye!")
    except OSError as e:
        print("=" * 60)
        print(f"ERROR: Could not start server on port {port}")
        print(f"Error: {e}")
        print("\nTry:")
        print("1. Close any other servers using this port")
        print("2. Run: lsof -ti:8000 | xargs kill (to kill process on port 8000)")
        print("3. Or use a different port by modifying START_PORT in server.py")
        print("=" * 60)

if __name__ == "__main__":
    main()
