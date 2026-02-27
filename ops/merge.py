import re
import os

target_path = os.path.join(os.path.dirname(__file__), 'CEO_DASHBOARD.html')
template_path = os.path.join(os.path.dirname(__file__), 'dashboard_template.html')

with open(target_path, 'r', encoding='utf-8') as f:
    content = f.read()

# TASKS 変数の配列抽出
match = re.search(r'(const TASKS = \[[\s\S]+?const PRIORITY_LABELS = [^;]+;)', content)
if not match:
    print("Data block not found!")
    exit(1)

data_block = match.group(1)

with open(template_path, 'r', encoding='utf-8') as f:
    template_content = f.read()

# プレースホルダ置換
final_html = template_content.replace('// DATA_BLOCK_PLACEHOLDER', data_block)

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(final_html)

print("Successfully rebuilt CEO_DASHBOARD.html with python script.")
