import sys
sys.path.append('.')
from datetime import datetime
from app.db import db
from app.prompt_gen import calc_nutrient_targets

with db() as conn:
    rows = conn.execute("SELECT * FROM nutrition_nutrients WHERE nutrient_key='vitamin_d3_mcg'").fetchall()
    for row in rows:
        print(dict(row))

print("Calculation results for today:")
res = calc_nutrient_targets(172, 70, 1985, 'male')
for r in res:
   if r['key'] == 'vitamin_d3_mcg':
       print(r)
