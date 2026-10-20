"""Export an offline single HTML from the editable source files."""
from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
for name in ['vocabulary.js','learning.js','ascent.js','memory.js','comfort.js','app.js']:
    content=(root/name).read_text(encoding='utf-8').replace('</script','<\\/script')
    html=re.sub(r'<script src="'+re.escape(name)+r'(?:\?[^"\s]*)?"></script>',lambda _:f'<script>\n{content}\n</script>',html)
notice='''<!-- Vocabulary: NGSL (Browne, Culligan, Phillips) and TSL (Browne, Culligan),
CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
https://www.newgeneralservicelist.com/new-general-service-list
https://www.newgeneralservicelist.com/toeic-service-list
Dictionary: ECDICT https://github.com/skywind3000/ECDICT
MIT license:\n'''+(root/'data/sources/ECDICT-LICENSE.txt').read_text(encoding='utf-8')+'\n-->\n'
html=html.replace('<html lang="zh-CN">',notice+'<html lang="zh-CN">')
html=html.replace('href="data/SOURCES.md"','href="https://www.newgeneralservicelist.com/toeic-service-list"')
out=root/'托业英语跳一跳.html'
out.write_text(html,encoding='utf-8')
print(f'Built {out.name}: {out.stat().st_size:,} bytes')
