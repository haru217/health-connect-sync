import sys
sys.path.append('.')
from app.prompt_gen import calc_nutrient_targets

print("Results for today:")
res = calc_nutrient_targets(172, 70, 1985, 'male')
for r in res:
   if r['key'] == 'vitamin_d3_mcg':
       print(r)

print("\nResults for 2026-02-23:")
res = calc_nutrient_targets(172, 70, 1985, 'male', '2026-02-23')
for r in res:
   if r['key'] == 'vitamin_d3_mcg':
       print(r)
       
print("\nResults for 2026-02-22:")
res = calc_nutrient_targets(172, 70, 1985, 'male', '2026-02-22')
for r in res:
   if r['key'] == 'vitamin_d3_mcg':
       print(r)

