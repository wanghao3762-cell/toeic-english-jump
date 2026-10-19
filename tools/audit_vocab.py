"""Reproducible vocabulary audit against the actual downloaded source rows."""
import csv
import hashlib
import json
from pathlib import Path
from build_vocab import rows

ROOT = Path(__file__).resolve().parents[1]

def main():
    vocab = json.loads((ROOT/'data/vocabulary.json').read_text(encoding='utf-8'))
    manifest = json.loads((ROOT/'data/manifest.json').read_text(encoding='utf-8'))
    lookup = {w['w']: w for w in vocab}
    missing, mismatch = {}, []
    for source, filename, field, rankfield in [('NGSL','ngsl.csv','Lemma','SFI Rank'),('TSL','tsl.csv','Word','TSL Rank')]:
        original = rows(filename)
        expected = {r[field].strip().lower():int(r[rankfield]) for r in original}
        missing[source] = sorted(set(expected)-set(lookup))
        for word, rank in expected.items():
            if word in lookup and (lookup[word]['source']!=source or lookup[word]['rank']!=rank):
                mismatch.append(word)
    supplement = [r[0].lower() for r in csv.reader((ROOT/'data/sources/ngsl-supplement.csv').read_text(encoding='utf-8-sig').splitlines()) if r]
    missing['NGSL-SUP'] = sorted(set(supplement)-set(lookup))
    extensions = json.loads((ROOT/'data/extensions.json').read_text(encoding='utf-8'))
    missing['PROJECT'] = sorted(set(extensions)-set(lookup))
    hash_mismatch = [name for name, expected in manifest['sha256'].items() if hashlib.sha256((ROOT/'data/sources'/name).read_bytes()).hexdigest()!=expected]
    fields = {key:[w['w'] for w in vocab if not w.get(key)] for key in ['meaning','phonetic','pos','definition','answer']}
    cards = [w for w in vocab if w.get('memory')]
    broken_links = [[w['w'], key] for w in cards for key in w['memory']['related'] if key not in lookup]
    report = {'total':len(vocab),'unique':len(lookup),'counts':manifest['counts'],'missingSourceLemmas':missing,'rankOrSourceMismatch':mismatch,'hashMismatch':hash_mismatch,'missingFields':fields,'memory':{'curated':len(cards),'dictionaryOnly':len(vocab)-len(cards),'scenes':sorted({w['memory']['scene'] for w in cards}),'brokenLinks':broken_links},'limits':['Source coverage is not an exhaustive ETS required-word list or score guarantee.','Nonempty dictionary fields do not prove sense or phonetic accuracy; full human review remains unfinished.','Source lemmas do not include every inflected form; 20 project additions are explicitly labelled.','Only the curated subset has original bilingual examples, collocations and shared scene illustrations.']}
    (ROOT/'qa/vocabulary-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if len(vocab)!=len(lookup) or any(missing.values()) or mismatch or hash_mismatch or any(fields.values()) or broken_links:
        raise SystemExit('Vocabulary audit failed.')

if __name__=='__main__':
    main()
