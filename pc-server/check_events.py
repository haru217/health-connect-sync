import sys
sys.path.append('.')
from app.db import db
with db() as conn:
    rows = conn.execute("SELECT local_date, consumed_at, alias, count FROM nutrition_events WHERE alias='vitamin_d'").fetchall()
    for r in rows:
        print(dict(r))
