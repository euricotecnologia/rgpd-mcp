#!/usr/bin/env python3
"""Extracts the authentic GDPR text (Regulation (EU) 2016/679) per official EU language
from the Publications Office (Cellar) XHTML renditions into structured JSON.

Usage: python -I tools/extract_gdpr.py
Input : tools/source/gdpr/<iso639-2>.xhtml   (downloaded by tools/fetch_gdpr.sh)
Output: data/gdpr/<iso639-1>.json + data/gdpr/manifest.json
No text is written by hand: everything comes from the Official Journal rendition.
"""
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "source" / "gdpr"
OUT = ROOT / "data" / "gdpr"

# ISO 639-2 (Cellar Accept-Language) -> ISO 639-1
LANGS = {
    "bul": "bg", "spa": "es", "ces": "cs", "dan": "da", "deu": "de", "est": "et",
    "ell": "el", "eng": "en", "fra": "fr", "gle": "ga", "hrv": "hr", "ita": "it",
    "lav": "lv", "lit": "lt", "hun": "hu", "mlt": "mt", "nld": "nl", "pol": "pl",
    "por": "pt", "ron": "ro", "slk": "sk", "slv": "sl", "fin": "fi", "swe": "sv",
}
VOID = {"col", "br", "hr", "img", "meta", "link", "input"}


class Node:
    __slots__ = ("tag", "attrs", "kids", "parent")

    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.kids, self.parent = tag, dict(attrs), [], parent


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", [], None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.kids.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.kids.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.kids.append(data)


def text_of(n):
    if isinstance(n, str):
        return n
    if n.tag == "br":
        return " "
    s = "".join(text_of(k) for k in n.kids)
    if n.tag == "span" and "oj-super" in n.attrs.get("class", ""):
        s = {"o": "º", "a": "ª"}.get(s.strip(), s)
    return s


def norm(s):
    return re.sub(r"\s+", " ", s.replace(" ", " ")).strip()


def lines(n):
    """Flatten a node into logical text lines (paragraphs; table rows -> 'label text')."""
    out = []
    if isinstance(n, str):
        return out
    if n.tag == "p":
        t = norm(text_of(n))
        if t:
            out.append(t)
    elif n.tag == "table":
        for tr in find_all(n, "tr"):
            if nearest(tr, "table") is not n:
                continue
            cells = [c for c in tr.kids if not isinstance(c, str) and c.tag in ("td", "th")]
            cl = [lines(c) for c in cells]
            if len(cl) == 2 and len(cl[0]) == 1 and cl[1]:
                first = cl[0][0] + " " + cl[1][0]
                out.append(first)
                out.extend(cl[1][1:])
            else:
                for c in cl:
                    out.extend(c)
    else:
        for k in n.kids:
            out.extend(lines(k))
    return out


def find_all(n, tag):
    r = []
    for k in n.kids:
        if isinstance(k, str):
            continue
        if k.tag == tag:
            r.append(k)
        r.extend(find_all(k, tag))
    return r


def nearest(n, tag):
    p = n.parent
    while p is not None and p.tag != tag:
        p = p.parent
    return p


def walk(n):
    for k in n.kids:
        if isinstance(k, str):
            continue
        yield k
        yield from walk(k)


def parse(path):
    tree = Tree()
    tree.feed(path.read_text(encoding="utf-8"))
    arts, recs, chapters = {}, {}, {}
    for n in walk(tree.root):
        i = n.attrs.get("id", "")
        if n.tag == "div" and re.fullmatch(r"art_\d+", i):
            num = i[4:]
            heading = ""
            body = []
            for k in n.kids:
                if isinstance(k, str):
                    continue
                if k.attrs.get("id") == i + ".tit_1":
                    heading = " ".join(lines(k))
                elif k.tag == "p" and "oj-ti-art" in k.attrs.get("class", ""):
                    continue
                else:
                    body.extend(lines(k))
            arts[num] = {"title": heading, "paragraphs": body}
        elif n.tag == "div" and re.fullmatch(r"rct_\d+", i):
            ls = lines(n)
            recs[i[4:]] = re.sub(r"^\(\d+\)\s*", "", " ".join(ls))
        elif n.tag == "div" and re.fullmatch(r"cpt_[IVX]+", i):
            t = [k for k in n.kids if not isinstance(k, str) and k.attrs.get("id") == i + ".tit_1"]
            if t:
                chapters[i[4:]] = " ".join(lines(t[0]))
    return arts, recs, chapters


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    ok = True
    for iso2, code in LANGS.items():
        pass
    for iso3, iso1 in LANGS.items():
        p = SRC / f"{iso3}.xhtml"
        arts, recs, chapters = parse(p)
        if len(arts) != 99 or len(recs) != 173 or len(chapters) != 11:
            print(f"!! {iso1}: articles={len(arts)} recitals={len(recs)} chapters={len(chapters)}", file=sys.stderr)
            ok = False
        empty = [k for k, v in arts.items() if not v["title"] or not v["paragraphs"]]
        if empty:
            print(f"!! {iso1}: articles without title/body: {empty}", file=sys.stderr)
            ok = False
        data = {
            "celex": "32016R0679",
            "eli": "http://data.europa.eu/eli/reg/2016/679/oj",
            "language": iso1,
            "chapters": chapters,
            "articles": dict(sorted(arts.items(), key=lambda kv: int(kv[0]))),
            "recitals": dict(sorted(recs.items(), key=lambda kv: int(kv[0]))),
        }
        (OUT / f"{iso1}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        manifest[iso1] = {
            "source": "https://publications.europa.eu/resource/cellar/3e485e15-11bd-11e6-ba9a-01aa75ed71a1",
            "acceptLanguage": iso3,
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            "articles": len(arts),
            "recitals": len(recs),
        }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print("OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
