"""Build the offline vocabulary from downloaded, attributed source data.

No network requests here. Fetch sources listed in data/SOURCES.md first.
The generated vocabulary has project-defined learning stages, NOT official
CEFR labels for individual words. Raw rank remains available on every entry.
"""
import csv
import hashlib
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data' / 'sources'
# Seven beginner pronouns are simplified to their introductory senses.
# Three accented TSL forms are absent from this dictionary snapshot.
# These short Chinese glosses are project-authored corrections.
OVERRIDES = {
    'i': {'meaning':'pron. 我','phonetic':'ai','pos':'pron','definition':'The person who is speaking.'},
    'you': {'meaning':'pron. 你；你们','phonetic':'ju:','pos':'pron','definition':'The person or people being spoken to.'},
    'he': {'meaning':'pron. 他','phonetic':'hi:','pos':'pron','definition':'A male person mentioned earlier.'},
    'we': {'meaning':'pron. 我们','phonetic':'wi:','pos':'pron','definition':'The speaker and one or more other people.'},
    'she': {'meaning':'pron. 她','phonetic':'ʃi:','pos':'pron','definition':'A female person mentioned earlier.'},
    'it': {'meaning':'pron. 它','phonetic':'it','pos':'pron','definition':'A thing, animal, or situation mentioned earlier.'},
    'they': {'meaning':'pron. 他们；她们；它们','phonetic':'ðei','pos':'pron','definition':'People or things mentioned earlier.'},
    'r\u00e9sum\u00e9': {'meaning':'n. 简历；履历','phonetic':'','pos':'n','definition':''},
    'caf\u00e9': {'meaning':'n. 咖啡馆；小餐馆','phonetic':'','pos':'n','definition':''},
    'entr\u00e9e': {'meaning':'n. 主菜（美式）；前菜（英式）','phonetic':'','pos':'n','definition':''},
}

def rows(name):
    raw = (SOURCES / name).read_bytes()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = raw.decode('cp1252')
    return list(csv.DictReader(io.StringIO(text)))

def main():
    source_words = []
    seen = set()
    for kind, filename, field, rank_field in [('NGSL','ngsl.csv','Lemma','SFI Rank'),('TSL','tsl.csv','Word','TSL Rank')]:
        for row in rows(filename):
            word = row[field].strip().lower()
            if not word or word in seen:
                continue
            seen.add(word)
            rank = int(row[rank_field])
            stage = (1 if rank <= 500 else 2 if rank <= 1200 else 3) if kind=='NGSL' else (4 if rank <= 650 else 5)
            source_words.append({'w':word,'rank':rank,'source':kind,'stage':stage})
    wanted = {x['w'] for x in source_words}
    # The official supplementary file has no header or frequency ranks.
    # Merge homographs (March/may) rather than silently dropping their calendar sense.
    supplement = list(csv.reader((SOURCES/'ngsl-supplement.csv').read_text(encoding='utf-8-sig').splitlines()))
    supplement_words = [r[0].strip().lower() for r in supplement if r]
    for number, word in enumerate(supplement_words, 1):
        if word not in seen:
            source_words.append({'w':word,'rank':None,'source':'NGSL-SUP','stage':1,'supplementIndex':number})
            seen.add(word)
    wanted = {x['w'] for x in source_words}
    corrections = json.loads((ROOT/'data/lexical-corrections.json').read_text(encoding='utf-8'))
    extensions = json.loads((ROOT/'data/extensions.json').read_text(encoding='utf-8'))
    for word in extensions:
        if word not in seen:
            source_words.append({'w':word,'rank':None,'source':'PROJECT','stage':4})
            seen.add(word)
    wanted = {x['w'] for x in source_words}
    memory = json.loads((ROOT/'data/memory-content.json').read_text(encoding='utf-8'))
    dictionary = {}
    with (SOURCES / 'ecdict.csv').open(encoding='utf-8-sig', newline='') as stream:
        for row in csv.DictReader(stream):
            word = row['word'].lower()
            if word in wanted:
                dictionary[word] = row
    missing = []
    for word in source_words:
        row = dictionary.get(word['w'], {})
        raw = row.get('translation','').replace('\\n','\n')
        senses = [x.strip() for x in raw.splitlines() if re.search('[\u4e00-\u9fff]', x)]
        word['meaning'] = '；'.join(senses[:3])
        word['fullMeaning'] = raw
        word['phonetic'] = row.get('phonetic','')
        word['pos'] = row.get('pos','').split('/')[0].split(':')[0]
        if not word['pos'] and senses:
            match = re.match(r'([a-z]+)\.',senses[0])
            if match:
                word['pos'] = match.group(1)
        word['definition'] = row.get('definition','').replace('\\n','\n').split('\n')[0]
        if word['w'] in OVERRIDES:
            word.update(OVERRIDES[word['w']])
            word['glossSource'] = 'project correction'
        if word['w'] in corrections:
            word.update(corrections[word['w']])
            word['glossSource'] = 'project correction; pronunciation is a reference variant'
        if word['w'] in extensions:
            word['meaning'] = extensions[word['w']]
            word['pos'] = 'n' if word['w'] not in ['catalogue','subsidiary'] else 'n/v' if word['w']=='catalogue' else 'n/adj'
            word['glossSource'] = 'project-authored business-form supplement'
        if word['w'] in supplement_words:
            word['supplement'] = True
        if word['w'] in memory:
            scene, en, zh, chunk, related = memory[word['w']]
            word['memory'] = {'scene':scene,'en':en,'zh':zh,'chunk':chunk,'related':related,'origin':'project-authored'}
        if not word['meaning']:
            missing.append(word['w'])
        # Input handles diacritics as their ASCII equivalents; keep the original label.
        import unicodedata
        word['answer'] = ''.join(c for c in unicodedata.normalize('NFKD',word['w']) if not unicodedata.combining(c)).replace('’',"'")
    # Start with useful, concrete words instead of the highest-frequency function words.
    first = 'I you we he she they it name work day time go come get make see know want need help office book call read write'.lower().split()
    first_rank = {w:i for i,w in enumerate(first)}
    source_words.sort(key=lambda x:(x['stage'],3 if x['source']=='PROJECT' else 2 if x['source']=='NGSL-SUP' else 0 if x['w'] in first_rank else 1,first_rank.get(x['w'],x['rank'] or x.get('supplementIndex',0))))
    manifest={'version':2,'counts':{s:sum(x['source']==s for x in source_words) for s in ['NGSL','TSL','NGSL-SUP','PROJECT']},'supplementRows':len(supplement_words),'supplementMerged':sum(w in {x['w'] for x in source_words if x['source']!='NGSL-SUP'} for w in supplement_words),'stages':{str(i):sum(x['stage']==i for x in source_words) for i in range(1,6)},'missingTranslations':missing,'missingFields':{key:[w['w'] for w in source_words if not w.get(key)] for key in ['phonetic','pos','definition']},'memoryCoverage':sum('memory' in w for w in source_words),'sha256':{f:hashlib.sha256((SOURCES/f).read_bytes()).hexdigest() for f in ['ngsl.csv','tsl.csv','ngsl-supplement.csv','ecdict.csv']}}
    (ROOT/'data'/'vocabulary.json').write_text(json.dumps(source_words,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'vocabulary.js').write_text('// Generated by tools/build_vocab.py; attribution: data/SOURCES.md\nwindow.TOEIC_VOCABULARY = '+json.dumps(source_words,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    (ROOT/'data'/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
    if missing:
        raise SystemExit('Missing translations must be resolved before release.')

if __name__=='__main__':
    main()
