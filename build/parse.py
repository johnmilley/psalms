#!/usr/bin/env python3
"""Parse the 1662 BCP (Coverdale) Psalter HTML from eskimo.com into JSON."""
import html
import json
import re
import sys

SRC = ["source/psalms_%d.html" % i for i in range(1, 6)]

day_re = re.compile(
    r'<a name="Day(\d+)E?">[^<]*</a>\s*&nbsp;\s*(Morning|Evening) Prayer')
psalm_re = re.compile(r'<a name="(\d+)">Psalm \d+\s*</a>\s*</strong>\.?')
incipit_re = re.compile(r'<em>(.*?)</em>', re.S)
img_re = re.compile(r'<img[^>]*alt="([^"]*)"[^>]*>')
tag_re = re.compile(r'<[^>]+>')


def clean(text):
    text = tag_re.sub('', text)
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    # the transcription occasionally styles 'the LORD'; 1662 prints 'Lord'
    text = re.sub(r'\bLORD\b(?=[ ,;.:])', 'Lord', text)
    return text


def natural_case(text):
    """Convert a leading ALL-CAPS run ('BLESSED is', 'O LORD my', 'MY SOUL')
    to natural sentence case."""
    words = text.split(' ')
    out = []
    in_caps = True
    first_alpha = True
    for w in words:
        core = re.sub(r"[^A-Za-z']", '', w)
        if in_caps and core and core == core.upper():
            if core == 'O':
                out.append(w)
                # after 'O' the next word is lower-case ('O come, let us sing')
                # unless it is LORD/GOD, which keep their capital
                first_alpha = False
                continue
            if first_alpha or core in ('LORD', 'GOD'):
                fixed = re.sub(r"[A-Z']+", lambda m: m.group(0).capitalize(), w, count=1)
                # capitalise first letter, lower the rest of the caps run
                fixed = w[0] + w[1:].lower() if w else w
            else:
                fixed = w.lower()
            first_alpha = False
            out.append(fixed)
        else:
            in_caps = False
            out.append(w)
    return ' '.join(out)


def split_verse(text):
    """Split at the pointing colon."""
    if ' : ' in text:
        a, b = text.split(' : ', 1)
    elif ': ' in text:
        a, b = text.split(': ', 1)
    else:
        return text.strip(), None
    return a.strip(), b.strip()


# transcription fixes: verses where the 1662 division-colon was typed as ';'
# or where a stray colon crept in. Text per the standard 1662 psalter.
PATCHES = {
    (10, 4): ('The ungodly is so proud, that he careth not for God',
              'neither is God in all his thoughts.'),
    (14, 7): ('Destruction and unhappiness is in their ways, and the way of peace have they not known',
              'there is no fear of God before their eyes.'),
    (17, 3): ('Thou hast proved and visited mine heart in the night-season; thou hast tried me, and shalt find no wickedness in me',
              'for I am utterly purposed that my mouth shall not offend.'),
    (35, 20): ('And why? their communing is not for peace',
               'but they imagine deceitful words against them that are quiet in the land.'),
    (40, 6): ('O Lord my God, great are the wondrous works which thou hast done, like as be also thy thoughts which are to us-ward',
              'and yet there is no man that ordereth them unto thee.'),
    (45, 11): ('Hearken, O daughter, and consider, incline thine ear',
               "forget also thine own people, and thy father's house."),
    (67, 1): ('God be merciful unto us, and bless us',
              'and shew us the light of his countenance, and be merciful unto us.'),
    (77, 18): ('The voice of thy thunder was heard round about',
               'the lightnings shone upon the ground; the earth was moved, and shook withal.'),
    (115, 8): ('They that make them are like unto them',
               'and so are all such as put their trust in them.'),
}


def parse():
    psalms = {}
    order = []
    cur_day = None
    cur_hour = None
    cur_psalm = None
    cur_section = None
    anomalies = []

    for path in SRC:
        raw = open(path, encoding='utf-8', errors='replace').read()
        # walk <p> blocks and day headings in document order
        events = []
        for m in day_re.finditer(raw):
            events.append((m.start(), 'day', m))
        # blocks run from each <p> to the next <p> (a </p> is missing in the
        # source before Psalm 10), trimmed at </p> when present
        starts = [m.start() for m in re.finditer(r'<p>', raw, re.I)]
        for i, s in enumerate(starts):
            end = starts[i + 1] if i + 1 < len(starts) else len(raw)
            block = raw[s + 3:end]
            cm = re.search(r'</p>', block, re.I)
            if cm:
                block = block[:cm.start()]
            events.append((s, 'para', block))
        events.sort(key=lambda e: e[0])

        for _, kind, m in events:
            if kind == 'day':
                cur_day = int(m.group(1))
                cur_hour = m.group(2)
                continue
            block = m
            pm = psalm_re.search(block)
            if pm:
                n = int(pm.group(1))
                # incipit: first <em> in the block (may be on the next line)
                im = incipit_re.search(block)
                latin = clean(im.group(1)) if im else ''
                cur_psalm = {
                    'n': n, 'latin': latin,
                    'day': cur_day, 'hour': cur_hour,
                    'sections': [],
                }
                psalms[n] = cur_psalm
                order.append(n)
                cur_section = {'latin': None, 'day': cur_day, 'hour': cur_hour,
                               'verses': []}
                cur_psalm['sections'].append(cur_section)
                # remove the header portion (everything through the incipit/center)
                body = block[pm.end():]
                # drop a possible trailing incipit line + closing centers
                body = re.sub(r'^.*?</center>', '', body, count=1, flags=re.S)
                body = re.sub(r'^\s*<center><em>.*?</em></center>', '', body, count=1, flags=re.S)
            else:
                # continuation section (Psalm 119)
                sm = re.search(r'^\s*<center><em>(.*?)</em></center>', block, re.S)
                if not sm or cur_psalm is None:
                    anomalies.append('orphan paragraph: %r' % block[:80])
                    continue
                cur_section = {'latin': clean(sm.group(1)), 'day': cur_day,
                               'hour': cur_hour, 'verses': []}
                cur_psalm['sections'].append(cur_section)
                body = block[sm.end():]

            # verses: split on <br>
            lines = re.split(r'<br\s*/?>', body, flags=re.I)
            for line in lines:
                # drop-cap reconstruction: alt letter + remainder
                line = img_re.sub(lambda mm: mm.group(1), line)
                text = clean(line)
                if not text:
                    continue
                vm = re.match(r'^(\d+)\.\s*(.*)$', text)
                if vm:
                    v = int(vm.group(1))
                    vt = vm.group(2)
                else:
                    # unnumbered opening verse: previous verse + 1 (1 at psalm start)
                    prev = 0
                    for s in cur_psalm['sections']:
                        for vv in s['verses']:
                            prev = max(prev, vv['v'])
                    v = prev + 1
                    vt = natural_case(text)
                if (cur_psalm['n'], v) in PATCHES:
                    a, b = PATCHES[(cur_psalm['n'], v)]
                else:
                    a, b = split_verse(vt)
                if b is None:
                    anomalies.append('Ps %d:%d no colon' % (cur_psalm['n'], v))
                if b and (':' in a or ':' in b):
                    anomalies.append('Ps %d:%d extra colon' % (cur_psalm['n'], v))
                # the transcription sometimes drops the final full stop
                tail = b if b is not None else a
                if tail and tail[-1].isalnum():
                    tail += '.'
                    if b is not None:
                        b = tail
                    else:
                        a = tail
                cur_section['verses'].append({'v': v, 'a': a, 'b': b})

    return psalms, order, anomalies


def validate(psalms, order):
    errs = []
    if sorted(order) != list(range(1, 151)):
        missing = set(range(1, 151)) - set(order)
        errs.append('missing psalms: %s' % sorted(missing))
    if len(order) != len(set(order)):
        errs.append('duplicate psalms')
    expected = {117: 2, 119: 176, 23: 6, 1: 7, 150: 6}
    for n, want in expected.items():
        if n in psalms:
            got = sum(len(s['verses']) for s in psalms[n]['sections'])
            if got != want:
                errs.append('Ps %d has %d verses, expected %d' % (n, got, want))
    # verse numbering must be 1..k contiguous
    for n, p in psalms.items():
        nums = [v['v'] for s in p['sections'] for v in s['verses']]
        if nums != list(range(1, len(nums) + 1)):
            errs.append('Ps %d verse numbering broken: %s...' % (n, nums[:10]))
    return errs


if __name__ == '__main__':
    psalms, order, anomalies = parse()
    errs = validate(psalms, order)
    total = sum(len(s['verses']) for p in psalms.values() for s in p['sections'])
    print('psalms: %d   verses: %d' % (len(order), total))
    print('sections in 119: %d' % len(psalms.get(119, {'sections': []})['sections']))
    for a in anomalies:
        print('ANOMALY:', a)
    for e in errs:
        print('ERROR:', e)
    data = [psalms[n] for n in sorted(psalms)]
    with open('build/psalms.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print('wrote build/psalms.json')
    sys.exit(1 if errs else 0)
