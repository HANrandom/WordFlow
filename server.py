import http.server
import socketserver
import json
import sqlite3
import os
from urllib.parse import urlparse, parse_qs

PORT = 8000
CURRENT_DB = "words.db"

def get_db_conn():
    return sqlite3.connect(CURRENT_DB)

def init_db(db_file=None):
    target_db = db_file or CURRENT_DB
    conn = sqlite3.connect(target_db)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS levels (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            meaning TEXT NOT NULL,
            level INTEGER DEFAULT 0,
            createdAt INTEGER,
            FOREIGN KEY (level) REFERENCES levels (id)
        )
    ''')
    
    # Initial levels
    cursor.execute("SELECT COUNT(*) FROM levels")
    if cursor.fetchone()[0] == 0:
        levels = [
            (0, '未筛选'),
            (1, '记不太清'),
            (2, '知中文不知英文'),
            (3, '不会拼写'),
            (4, '已熟练掌握')
        ]
        cursor.executemany("INSERT INTO levels (id, name) VALUES (?, ?)", levels)
    
    conn.commit()
    conn.close()

class WordHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/levels':
            self.get_levels()
        elif parsed_path.path == '/api/words':
            self.get_words(parsed_path.query)
        elif parsed_path.path == '/api/stats':
            self.get_stats()
        elif parsed_path.path == '/api/databases':
            self.get_databases()
        elif parsed_path.path == '/api/databases/current':
            self.send_json({"current": CURRENT_DB})
        else:
            # Serve static files from 'dist' directory
            if parsed_path.path == '/':
                self.path = '/dist/index.html'
            else:
                self.path = '/dist' + parsed_path.path
            return super().do_GET()

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data)

        if self.path == '/api/words/import':
            self.import_words(data)
        elif self.path == '/api/words/update_level':
            self.update_word_level(data)
        elif self.path == '/api/words/batch_move':
            self.batch_move(data)
        elif self.path == '/api/words/batch_delete':
            self.batch_delete(data)
        elif self.path == '/api/levels/update':
            self.update_level(data)
        elif self.path == '/api/levels/add':
            self.add_level(data)
        elif self.path == '/api/levels/delete':
            self.delete_level(data)
        elif self.path == '/api/databases/create':
            self.create_database(data)
        elif self.path == '/api/databases/switch':
            self.switch_database(data)
        else:
            self.send_error(404)

    def get_levels(self):
        conn = get_db_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM levels ORDER BY id")
        levels = [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]
        conn.close()
        self.send_json(levels)

    def get_words(self, query_str):
        query = parse_qs(query_str)
        level = query.get('level', ['all'])[0]
        page = int(query.get('page', [0])[0])
        page_size = int(query.get('pageSize', [20])[0])

        conn = get_db_conn()
        cursor = conn.cursor()
        
        where_clause = ""
        params = []
        if level != 'all':
            where_clause = "WHERE level = ?"
            params.append(int(level))

        cursor.execute(f"SELECT COUNT(*) FROM words {where_clause}", params)
        total = cursor.fetchone()[0]

        cursor.execute(f"SELECT id, word, meaning, level, createdAt FROM words {where_clause} LIMIT ? OFFSET ?", 
                       params + [page_size, page * page_size])
        words = [{"id": r[0], "word": r[1], "meaning": r[2], "level": r[3], "createdAt": r[4]} for r in cursor.fetchall()]
        
        conn.close()
        self.send_json({"total": total, "words": words})

    def get_stats(self):
        conn = get_db_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT level, COUNT(*) FROM words GROUP BY level")
        stats = {row[0]: row[1] for row in cursor.fetchall()}
        conn.close()
        self.send_json(stats)

    def import_words(self, data):
        conn = get_db_conn()
        cursor = conn.cursor()
        words = [(w['word'], w['meaning'], w['level'], w['createdAt']) for w in data]
        cursor.executemany("INSERT INTO words (word, meaning, level, createdAt) VALUES (?, ?, ?, ?)", words)
        conn.commit()
        conn.close()
        self.send_json({"status": "ok", "count": len(words)})

    def update_word_level(self, data):
        conn = get_db_conn()
        cursor = conn.cursor()
        cursor.execute("UPDATE words SET level = ? WHERE id = ?", (data['level'], data['id']))
        conn.commit()
        conn.close()
        self.send_json({"status": "ok"})

    def batch_move(self, data):
        conn = get_db_conn()
        cursor = conn.cursor()
        ids = data['ids']
        level = data['level']
        cursor.execute(f"UPDATE words SET level = ? WHERE id IN ({','.join(['?']*len(ids))})", [level] + ids)
        conn.commit()
        conn.close()
        self.send_json({"status": "ok"})

    def batch_delete(self, data):
        conn = get_db_conn()
        cursor = conn.cursor()
        ids = data['ids']
        cursor.execute(f"DELETE FROM words WHERE id IN ({','.join(['?']*len(ids))})", ids)
        conn.commit()
        conn.close()
        self.send_json({"status": "ok"})

    def update_level(self, data):
        conn = get_db_conn()
        cursor = conn.cursor()
        cursor.execute("UPDATE levels SET name = ? WHERE id = ?", (data['name'], data['id']))
        conn.commit()
        conn.close()
        self.send_json({"status": "ok"})

    def add_level(self, data):
        conn = get_db_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(id) FROM levels")
        max_id = cursor.fetchone()[0] or 0
        new_id = max_id + 1
        cursor.execute("INSERT INTO levels (id, name) VALUES (?, ?)", (new_id, data['name']))
        conn.commit()
        conn.close()
        self.send_json({"status": "ok", "id": new_id})

    def delete_level(self, data):
        conn = get_db_conn()
        cursor = conn.cursor()
        level_id = data['id']
        # Move words to level 0 before deleting the level
        cursor.execute("UPDATE words SET level = 0 WHERE level = ?", (level_id,))
        cursor.execute("DELETE FROM levels WHERE id = ?", (level_id,))
        conn.commit()
        conn.close()
        self.send_json({"status": "ok"})

    def get_databases(self):
        dbs = [f for f in os.listdir('.') if f.endswith('.db')]
        self.send_json(dbs)

    def create_database(self, data):
        global CURRENT_DB
        name = data['name']
        if not name.endswith('.db'):
            name += '.db'
        init_db(name)
        CURRENT_DB = name
        self.send_json({"status": "ok", "current": CURRENT_DB})

    def switch_database(self, data):
        global CURRENT_DB
        name = data['name']
        if os.path.exists(name):
            CURRENT_DB = name
            self.send_json({"status": "ok", "current": CURRENT_DB})
        else:
            self.send_error(404, "Database not found")

    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

if __name__ == "__main__":
    init_db()
    print(f"Starting server on port {PORT}...")
    with socketserver.TCPServer(("0.0.0.0", PORT), WordHandler) as httpd:
        httpd.serve_forever()
