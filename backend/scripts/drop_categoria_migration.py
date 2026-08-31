import os
import shutil
import sqlite3
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE, 'instance', 'gestion_productividad_v1.db')
BACKUP_PATH = DB_PATH + '.' + datetime.utcnow().strftime('%Y%m%dT%H%M%SZ') + '.bak'

print('DB path:', DB_PATH)
if not os.path.exists(DB_PATH):
    print('Database file not found; aborting.')
    raise SystemExit(1)

print('Backing up DB to', BACKUP_PATH)
shutil.copy2(DB_PATH, BACKUP_PATH)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Disable foreign keys to allow table operations
cur.execute('PRAGMA foreign_keys = OFF;')

# Check if categoria_promocion exists
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='categoria_promocion';")
if cur.fetchone():
    print('categoria_promocion table exists and will be dropped.')
else:
    print('categoria_promocion table does not exist; continuing to adjust promocion table if needed.')

# Get promocion columns
cur.execute("PRAGMA table_info('promocion');")
cols = [r[1] for r in cur.fetchall()]
print('Existing promocion columns:', cols)

# Desired columns for promocion after migration
desired = ['id', 'nombre', 'tiempo_minutos', 'created_at', 'updated_at']

if set(desired).issubset(set(cols)):
    print('Promocion already has desired columns subset; proceeding to recreate table without categoria columns if needed.')
else:
    # Ensure tiempo_minutos exists
    if 'tiempo_minutos' not in cols:
        print('Adding tiempo_minutos column to promocion (nullable default 0).')
        cur.execute("ALTER TABLE promocion ADD COLUMN tiempo_minutos FLOAT NOT NULL DEFAULT 0;")
        conn.commit()

# Recreate promocion table without categoria fields
print('Recreating promocion table without categoria columns...')
cur.execute('BEGIN TRANSACTION;')
cur.execute('CREATE TABLE IF NOT EXISTS promocion_new (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, tiempo_minutos FLOAT NOT NULL DEFAULT 0, created_at DATETIME, updated_at DATETIME);')
# Copy existing data (ignore categoria fields)
cur.execute("INSERT OR REPLACE INTO promocion_new (id, nombre, tiempo_minutos, created_at, updated_at) SELECT id, nombre, COALESCE(tiempo_minutos, 0), created_at, updated_at FROM promocion;")
cur.execute('DROP TABLE promocion;')
cur.execute('ALTER TABLE promocion_new RENAME TO promocion;')

# Drop categoria_promocion if exists
cur.execute("DROP TABLE IF EXISTS categoria_promocion;")

cur.execute('COMMIT;')
conn.commit()
cur.execute('PRAGMA foreign_keys = ON;')
conn.close()

print('Migration complete. Backup at', BACKUP_PATH)
