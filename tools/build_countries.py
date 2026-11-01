#!/usr/bin/env python3
"""Builds data/countries/<CC>.json.

Rule of the house: a fact is `verified` ONLY if its regex is found in an official/primary text that
was downloaded to tools/source/national/ ; the excerpt, sha256 and retrieval date are stored.
Anything else is `unverified` (leads from secondary sources, kept as notes) or `inferred`.
The build FAILS if a verified fact's evidence is not found, so the data cannot silently rot.

Run:  python -X utf8 -I tools/build_countries.py
"""
import hashlib
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "source" / "national"
OUT = ROOT / "data" / "countries"
OUT.mkdir(parents=True, exist_ok=True)
TODAY = date.today().isoformat()

_cache = {}


def load(file, enc="utf-8"):
    if file in _cache:
        return _cache[file]
    raw = (SRC / file).read_bytes()
    t = raw.decode(enc, errors="replace")
    t = re.sub(r"(?is)<(script|style).*?</\1>", "", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"\s+", " ", re.sub("[​-‏­]", "", html.unescape(t)).replace(" ", " "))
    _cache[file] = (t, hashlib.sha256(raw).hexdigest())
    return _cache[file]


NOISE = re.compile(
    r"Subir \[Bloque \d+: #[\w-]+\]\s*"                                               # BOE "back to top" tokens
    r"|Toon relaties in LiDO Maak een permanente link Toon wetstechnische informatie \.\.\. Druk het regelingonderdeel af Sla het regelingonderdeel op "  # wetten.nl UI
    r"|Paragraph \d+, |Absatz \w+, "
    r"|(?<=\)) \*(?= )"                                                                # jogtar.hu footnote markers                                                    # RIS XML rendering duplicates of the numbering
)  # presentation/navigation tokens, not law text


def evidence(file, regex, url, lang, enc="utf-8", before=60, after=260):
    t, h = load(file, enc)
    m = re.search(regex, t, re.I)
    if not m:
        sys.exit(f"EVIDENCE NOT FOUND: {file} /{regex}/")
    ex = NOISE.sub("", t[max(0, m.start() - before): m.end() + after]).strip()
    return dict(url=url, retrievedAt=TODAY, sha256=h, language=lang, excerpt=ex)


# ---------------------------------------------------------------- authorities (EDPB members page)
EDPB_URL = "https://www.edpb.europa.eu/about-edpb/about-edpb/members_en"
AUTH = {  # code: (name as listed by EDPB, website, token that must occur in the saved EDPB page)
    "AT": ("Österreichische Datenschutzbehörde", "http://www.dsb.gv.at/", "Datenschutzbehörde"),
    "BE": ("Autorité de la protection des données - Gegevensbeschermingsautoriteit (APD-GBA)", "https://www.autoriteprotectiondonnees.be", "APD-GBA"),
    "BG": ("Commission for Personal Data Protection", "https://www.cpdp.bg/", "Commission for Personal Data Protection"),
    "HR": ("Agencija za zaštitu osobnih podataka (AZOP)", "http://www.azop.hr/", "AZOP"),
    "CY": ("Γραφείο Επιτρόπου Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (Cypriot Data Protection Authority)", "http://www.dataprotection.gov.cy/", "Cypriot Data Protection Authority"),
    "CZ": ("Office for Personal Data Protection", "https://uoou.gov.cz/", "Office for Personal Data Protection"),
    "DK": ("Datatilsynet", "http://www.datatilsynet.dk/", "datatilsynet.dk"),
    "EE": ("Estonian Data Protection Inspectorate (Andmekaitse Inspektsioon)", "http://www.aki.ee/", "Andmekaitse Inspektsioon"),
    "FI": ("Office of the Data Protection Ombudsman", "http://www.tietosuoja.fi/en/", "Office of the Data Protection Ombudsman"),
    "FR": ("Commission Nationale de l'Informatique et des Libertés (CNIL)", "http://www.cnil.fr/", "CNIL"),
    "DE": ("Die Bundesbeauftragte für den Datenschutz und die Informationsfreiheit (BfDI)", "http://www.bfdi.bund.de/", "BfDI"),
    "GR": ("Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (Hellenic Data Protection Authority)", "http://www.dpa.gr/", "Hellenic Data Protection Authority"),
    "HU": ("Hungarian National Authority for Data Protection and Freedom of Information", "http://www.naih.hu/", "Hungarian National Authority for Data Protection and Freedom of Information"),
    "IE": ("Data Protection Commission", "http://www.dataprotection.ie/", "Data Protection Commission"),
    "IT": ("Garante per la protezione dei dati personali", "http://www.garanteprivacy.it/", "Garante per la protezione dei dati personali"),
    "LV": ("Data State Inspectorate", "https://www.dvi.gov.lv/", "Data State Inspectorate"),
    "LT": ("State Data Protection Inspectorate", "https://vdai.lrv.lt/", "State Data Protection Inspectorate"),
    "LU": ("Commission Nationale pour la Protection des Données", "http://www.cnpd.lu/", "Commission Nationale pour la Protection des Données"),
    "MT": ("Office of the Information and Data Protection Commissioner", "http://www.idpc.org.mt/", "Office of the Information and Data Protection Commissioner"),
    "NL": ("Autoriteit Persoonsgegevens", "https://autoriteitpersoonsgegevens.nl/", "Autoriteit Persoonsgegevens"),
    "PL": ("Urząd Ochrony Danych Osobowych (Personal Data Protection Office)", "https://uodo.gov.pl/", "Personal Data Protection Office"),
    "PT": ("Comissão Nacional de Proteção de Dados (CNPD)", "http://www.cnpd.pt/", "Comissão Nacional de Proteção de Dados"),
    "RO": ("The National Supervisory Authority for Personal Data Processing", "http://www.dataprotection.ro/", "National Supervisory Authority for Personal Data Processing"),
    "SK": ("Úrad na ochranu osobných údajov Slovenskej republiky", "http://www.dataprotection.gov.sk/", "Úrad na ochranu osobných údajov"),
    "SI": ("Information Commissioner of the Republic of Slovenia", "https://www.ip-rs.si/", "Information Commissioner of the Republic of Slovenia"),
    "ES": ("Agencia Española de Protección de Datos (AEPD)", "https://www.aepd.es/", "AEPD"),
    "SE": ("Integritetsskyddsmyndigheten", "https://www.imy.se/", "Integritetsskyddsmyndigheten"),
    "IS": ("Persónuvernd (Icelandic Data Protection Authority)", "https://www.personuvernd.is", "Persónuvernd"),
    "LI": ("Data Protection Authority, Principality of Liechtenstein", "https://www.datenschutzstelle.li", "Principality of Liechtenstein"),
    "NO": ("Datatilsynet", "https://www.datatilsynet.no", "datatilsynet.no"),
}

# ---------------------------------------------------------------- names: en + UI locales (pt es fr de it nl) + native
N = {
    "AT": dict(en="Austria", pt="Áustria", es="Austria", fr="Autriche", de="Österreich", it="Austria", nl="Oostenrijk"),
    "BE": dict(en="Belgium", pt="Bélgica", es="Bélgica", fr="Belgique", de="Belgien", it="Belgio", nl="België"),
    "BG": dict(en="Bulgaria", pt="Bulgária", es="Bulgaria", fr="Bulgarie", de="Bulgarien", it="Bulgaria", nl="Bulgarije", bg="България"),
    "HR": dict(en="Croatia", pt="Croácia", es="Croacia", fr="Croatie", de="Kroatien", it="Croazia", nl="Kroatië", hr="Hrvatska"),
    "CY": dict(en="Cyprus", pt="Chipre", es="Chipre", fr="Chypre", de="Zypern", it="Cipro", nl="Cyprus", el="Κύπρος"),
    "CZ": dict(en="Czechia", pt="Chéquia", es="Chequia", fr="Tchéquie", de="Tschechien", it="Cechia", nl="Tsjechië", cs="Česko"),
    "DK": dict(en="Denmark", pt="Dinamarca", es="Dinamarca", fr="Danemark", de="Dänemark", it="Danimarca", nl="Denemarken", da="Danmark"),
    "EE": dict(en="Estonia", pt="Estónia", es="Estonia", fr="Estonie", de="Estland", it="Estonia", nl="Estland", et="Eesti"),
    "FI": dict(en="Finland", pt="Finlândia", es="Finlandia", fr="Finlande", de="Finnland", it="Finlandia", nl="Finland", fi="Suomi", sv="Finland"),
    "FR": dict(en="France", pt="França", es="Francia", fr="France", de="Frankreich", it="Francia", nl="Frankrijk"),
    "DE": dict(en="Germany", pt="Alemanha", es="Alemania", fr="Allemagne", de="Deutschland", it="Germania", nl="Duitsland"),
    "GR": dict(en="Greece", pt="Grécia", es="Grecia", fr="Grèce", de="Griechenland", it="Grecia", nl="Griekenland", el="Ελλάδα"),
    "HU": dict(en="Hungary", pt="Hungria", es="Hungría", fr="Hongrie", de="Ungarn", it="Ungheria", nl="Hongarije", hu="Magyarország"),
    "IE": dict(en="Ireland", pt="Irlanda", es="Irlanda", fr="Irlande", de="Irland", it="Irlanda", nl="Ierland", ga="Éire"),
    "IT": dict(en="Italy", pt="Itália", es="Italia", fr="Italie", de="Italien", it="Italia", nl="Italië"),
    "LV": dict(en="Latvia", pt="Letónia", es="Letonia", fr="Lettonie", de="Lettland", it="Lettonia", nl="Letland", lv="Latvija"),
    "LT": dict(en="Lithuania", pt="Lituânia", es="Lituania", fr="Lituanie", de="Litauen", it="Lituania", nl="Litouwen", lt="Lietuva"),
    "LU": dict(en="Luxembourg", pt="Luxemburgo", es="Luxemburgo", fr="Luxembourg", de="Luxemburg", it="Lussemburgo", nl="Luxemburg"),
    "MT": dict(en="Malta", pt="Malta", es="Malta", fr="Malte", de="Malta", it="Malta", nl="Malta", mt="Malta"),
    "NL": dict(en="Netherlands", pt="Países Baixos", es="Países Bajos", fr="Pays-Bas", de="Niederlande", it="Paesi Bassi", nl="Nederland"),
    "PL": dict(en="Poland", pt="Polónia", es="Polonia", fr="Pologne", de="Polen", it="Polonia", nl="Polen", pl="Polska"),
    "PT": dict(en="Portugal", pt="Portugal", es="Portugal", fr="Portugal", de="Portugal", it="Portogallo", nl="Portugal"),
    "RO": dict(en="Romania", pt="Roménia", es="Rumanía", fr="Roumanie", de="Rumänien", it="Romania", nl="Roemenië", ro="România"),
    "SK": dict(en="Slovakia", pt="Eslováquia", es="Eslovaquia", fr="Slovaquie", de="Slowakei", it="Slovacchia", nl="Slowakije", sk="Slovensko"),
    "SI": dict(en="Slovenia", pt="Eslovénia", es="Eslovenia", fr="Slovénie", de="Slowenien", it="Slovenia", nl="Slovenië", sl="Slovenija"),
    "ES": dict(en="Spain", pt="Espanha", es="España", fr="Espagne", de="Spanien", it="Spagna", nl="Spanje"),
    "SE": dict(en="Sweden", pt="Suécia", es="Suecia", fr="Suède", de="Schweden", it="Svezia", nl="Zweden", sv="Sverige"),
    "NO": dict(en="Norway", pt="Noruega", es="Noruega", fr="Norvège", de="Norwegen", it="Norvegia", nl="Noorwegen", no="Norge"),
    "IS": dict(en="Iceland", pt="Islândia", es="Islandia", fr="Islande", de="Island", it="Islanda", nl="IJsland", is_="Ísland"),
    "LI": dict(en="Liechtenstein", pt="Listenstaine", es="Liechtenstein", fr="Liechtenstein", de="Liechtenstein", it="Liechtenstein", nl="Liechtenstein"),
}
N["IS"]["is"] = N["IS"].pop("is_")

# Languages in which this tool presents the consent document (first = default). Design choice, not a legal claim.
LANG = {"AT": ["de"], "BE": ["nl", "fr", "de"], "BG": ["bg"], "HR": ["hr"], "CY": ["el"], "CZ": ["cs"], "DK": ["da"], "EE": ["et"],
        "FI": ["fi", "sv"], "FR": ["fr"], "DE": ["de"], "GR": ["el"], "HU": ["hu"], "IE": ["en", "ga"], "IT": ["it"], "LV": ["lv"],
        "LT": ["lt"], "LU": ["fr", "de"], "MT": ["mt", "en"], "NL": ["nl"], "PL": ["pl"], "PT": ["pt"], "RO": ["ro"], "SK": ["sk"],
        "SI": ["sl"], "ES": ["es"], "SE": ["sv"], "NO": ["no"], "IS": ["is"], "LI": ["de"]}
REGION = {c: "EU" for c in LANG}
for c in ("NO", "IS", "LI"):
    REGION[c] = "EEA"

# ---------------------------------------------------------------- verified national facts (primary text on disk)
L = {}  # code -> list of law dicts
AGE = {}  # code -> dict
HEALTH = {}  # code -> list
NOTES = {}


def law(code, id, title, lang, url, role="implementation", number=None, dt=None, journal=None, file=None, enc="utf-8", rx=None, also=()):
    d = dict(id=id, role=role, title=title, language=lang, url=url)
    if number: d["number"] = number
    if dt: d["date"] = dt
    if journal: d["journal"] = journal
    if file:
        for extra in also:
            evidence(file, extra, url, lang, enc)  # every extra token must exist in the source or the build fails
        d["status"] = "verified"
        d["evidence"] = evidence(file, rx, url, lang, enc)
    else:
        d["status"] = "unverified"
    L.setdefault(code, []).append(d)



# ---------------------------------------------------------------- sector health legislation (patient rights, records, secrecy)
SECTOR = {}


def sector(code, id, title, lang, url, provisions, number=None, note=None):
    """provisions: list of (article, topic, file, enc, regex, evidence_url). Every regex must match its source file."""
    items = []
    for article, topic, file, enc, rx, evurl in provisions:
        items.append(dict(article=article, topic=topic, status="verified", evidence=evidence(file, rx, evurl, lang, enc, before=0)))
    d = dict(id=id, title=title, language=lang, url=url, status="verified", provisions=items)
    if number:
        d["number"] = number
    if note:
        d["note"] = note
    SECTOR.setdefault(code, []).append(d)

# --- Spain
law("ES", "lopdgdd", "Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales", "es",
    "https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673", number="Ley Orgánica 3/2018", dt="2018-12-05", journal="BOE núm. 294, de 6 de diciembre de 2018 (BOE-A-2018-16673)",
    file="ES.html", rx=r"Ley Orgánica 3/2018, de 5 de diciembre")
AGE["ES"] = dict(value=14, article="art. 7.1 LOPDGDD", lawId="lopdgdd", file="ES.html", rx=r"únicamente podrá fundarse en su consentimiento cuando sea mayor de catorce años", lang="es",
                 url="https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673")
HEALTH["ES"] = [dict(article="Disposición adicional decimoséptima", lawId="lopdgdd", topic="Tratamientos de datos de salud", file="ES.html",
                     rx=r"Disposición adicional decimoséptima\. Tratamientos de datos de salud", lang="es", url="https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673")]
# --- Portugal
law("PT", "lei58-2019", "Lei n.º 58/2019, de 8 de agosto — Assegura a execução, na ordem jurídica nacional, do Regulamento (UE) 2016/679", "pt",
    "https://files.diariodarepublica.pt/1s/2019/08/15100/0000300040.pdf", number="Lei n.º 58/2019", dt="2019-08-08", journal="Diário da República, 1.ª série, n.º 151, de 8 de agosto de 2019",
    file="PT_dre.txt", rx=r"Lei n\.º 58/2019 de 8 de agosto")
AGE["PT"] = dict(value=13, article="art. 16.º n.º 1 Lei 58/2019", lawId="lei58-2019", file="PT_dre.txt", lang="pt",
                 rx=r"quando as mesmas já tenham completado 13 anos de idade", url="https://files.diariodarepublica.pt/1s/2019/08/15100/0000300040.pdf")
HEALTH["PT"] = [dict(article="Artigo 29.º", lawId="lei58-2019", topic="Tratamento de dados de saúde e dados genéticos", file="PT_dre.txt",
                     rx=r"Artigo 29\.º Tratamento de dados de saúde e dados genéticos 1 — Nos tratamentos de dados de saúde e de dados genéticos, o acesso a dados pessoais rege-se pelo princípio da necessidade de conhecer a informação",
                     lang="pt", url="https://files.diariodarepublica.pt/1s/2019/08/15100/0000300040.pdf")]
NOTES["PT"] = ["Texto lido no PDF oficial do Diário da República (files.diariodarepublica.pt), convertido com pdftotext. A Deliberação CNPD 2019/494 desaplicou normas desta lei por incompatibilidade com o RGPD (fonte secundária, não verificada aqui)."]
# --- Italy
law("IT", "d196-2003", "Codice in materia di protezione dei dati personali (d.lgs. 30 giugno 2003, n. 196, come adeguato al Regolamento)", "it",
    "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2003-06-30;196", number="D.Lgs. 30 giugno 2003, n. 196", dt="2003-06-30", file="IT.html",
    rx=r"DECRETO LEGISLATIVO 30 giugno 2003, n\. 196")
AGE["IT"] = dict(value=14, article="art. 2-quinquies co. 1 Codice privacy", lawId="d196-2003", file="IT.html", lang="it",
                 rx=r"il minore che ha compiuto i quattordici anni può esprimere il consenso", url="https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2003-06-30;196")
# --- Czechia
law("CZ", "z110-2019", "Zákon č. 110/2019 Sb., o zpracování osobních údajů", "cs", "https://www.zakonyprolidi.cz/cs/2019-110", number="110/2019 Sb.", file="CZ.html", rx=r"110/2019 Sb")
AGE["CZ"] = dict(value=15, article="§ 7 zákona č. 110/2019 Sb.", lawId="z110-2019", file="CZ.html", lang="cs",
                 rx=r"Dítě nabývá způsobilosti k udělení souhlasu se zpracováním osobních údajů v souvislosti s nabídkou služeb informační společnosti přímo jemu dovršením patnáctého roku věku",
                 url="https://www.zakonyprolidi.cz/cs/2019-110")
# --- Netherlands (no derogation: Art. 8(1) default 16 applies; UAVG art. 5 presupposes it)
law("NL", "uavg", "Uitvoeringswet Algemene verordening gegevensbescherming (Wet van 16 mei 2018)", "nl", "https://wetten.overheid.nl/BWBR0040940/", number="BWBR0040940", dt="2018-05-16",
    file="NL.html", rx=r"Wet van 16 mei 2018")
AGE["NL"] = dict(value=16, status="inferred", article="geen afwijking in UAVG; art. 5 UAVG gaat uit van 16 jaar (art. 8 AVG)", lawId="uavg", file="NL.html", lang="nl",
                 rx=r"de betrokkene heeft de leeftijd van zestien jaren nog niet bereikt", url="https://wetten.overheid.nl/BWBR0040940/")
HEALTH["NL"] = [dict(article="Artikel 30", lawId="uavg", topic="Uitzonderingen op het verbod gegevens over gezondheid te verwerken", file="NL.html",
                     rx=r"gegevens over gezondheid", lang="nl", url="https://wetten.overheid.nl/BWBR0040940/")]
# --- Sweden
law("SE", "lag2018-218", "Lag (2018:218) med kompletterande bestämmelser till EU:s dataskyddsförordning", "sv", "https://data.riksdagen.se/dokument/sfs-2018-218.text",
    number="SFS 2018:218", dt="2018-04-19", file="SE.html", rx=r"Lag \(2018:218\) med kompletterande bestämmelser till EU:s dataskyddsförordning")
AGE["SE"] = dict(value=13, article="2 kap. 4 § lag (2018:218)", lawId="lag2018-218", file="SE.html", lang="sv",
                 rx=r"om barnet är minst 13 år", url="https://data.riksdagen.se/dokument/sfs-2018-218.text")
# --- Germany (BDSG sets no age: Art. 8(1) default 16)
law("DE", "bdsg", "Bundesdatenschutzgesetz (BDSG)", "de", "https://www.gesetze-im-internet.de/bdsg_2018/BJNR209710017.html", number="BGBl. I S. 2097", dt="2017-06-30",
    file="DE.html", rx=r"Ausfertigungsdatum: 30\.06\.2017")
_de, _ = load("DE.html")
if re.search(r"Einwilligung.{0,200}(Kind|Minderjährig)|(Kind|Minderjährig).{0,200}Einwilligung", _de):
    sys.exit("DE: BDSG text now mentions children/minors; re-check Art. 8 handling before keeping 'inferred'")
AGE["DE"] = dict(value=16, status="inferred", article="Keine Abweichung im BDSG (der geprüfte Volltext enthält keine Regelung zur Einwilligung von Kindern); es gilt Art. 8 Abs. 1 DSGVO: 16 Jahre", lawId="bdsg")
HEALTH["DE"] = [dict(article="§ 22 Abs. 1 Nr. 1 Buchst. b BDSG", lawId="bdsg", topic="Gesundheitsvorsorge, medizinische Diagnostik, Versorgung oder Behandlung im Gesundheits- oder Sozialbereich", file="DE22.html",
                     rx=r"Gesundheitsvorsorge", lang="de", url="https://www.gesetze-im-internet.de/bdsg_2018/__22.html")]
NOTES["DE"] = ["O BDSG não fixa idade própria; 'inferred' = ausência de derrogação no texto consultado. Os Länder têm leis de proteção de dados e leis hospitalares próprias: não cobertas."]
# --- Ireland (title only verified)
law("IE", "dpa2018", "Data Protection Act 2018 (Number 7 of 2018)", "en", "https://www.irishstatutebook.ie/eli/2018/act/7/enacted/en/html", number="Number 7 of 2018", file="IE.html", rx=r"Number 7 of 2018")
AGE["IE"] = dict(value=None, status="unverified", article="s. 31 Data Protection Act 2018 (\"Consent of child in relation to information society services\") — age not read", lawId="dpa2018")
# --- Second pass: verified from official text
def absent(file, rx, why):
    t, _ = load(file)
    if re.search(rx, t, re.I):
        sys.exit(f"ABSENCE GUARD FAILED ({why}): {file} /{rx}/")


law("AT", "dsg", "Datenschutzgesetz (DSG), BGBl. I Nr. 165/1999", "de", "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001597",
    number="BGBl. I Nr. 165/1999", file="AT_p4_2.html", rx=r"BGBl\. I Nr\. 165/1999", also=(r"§ 4\b",))
AGE["AT"] = dict(value=14, article="§ 4 Abs. 4 DSG", lawId="dsg", file="AT_p4_2.html", lang="de",
                 rx=r"wenn das Kind das vierzehnte Lebensjahr vollendet hat",
                 url="https://data.bka.gv.at/ris/api/v2.6/Bundesrecht?Applikation=BrKons&Gesetzesnummer=10001597&Abschnitt.Typ=Paragraph&Abschnitt.Von=4&Abschnitt.Bis=4")
NOTES["AT"] = ["Fonte: API aberta do RIS (Bundeskanzleramt), paragrafo 4 da norma consolidada."]

AGE["IE"] = dict(value=16, article="s. 31(1) Data Protection Act 2018", lawId="dpa2018", file="IE31.html", lang="en",
                 rx=r"The age of a child specified for the purposes of Article 8 is 16 years of age",
                 url="https://www.irishstatutebook.ie/eli/2018/act/7/section/31/enacted/en/html")

law("NO", "pol2018-38", "Lov om behandling av personopplysninger (personopplysningsloven)", "no", "https://lovdata.no/lov/2018-06-15-38",
    number="LOV-2018-06-15-38", dt="2018-06-15", file="NO2.html", rx=r"Lov om behandling av personopplysninger \(personopplysningsloven\)")
AGE["NO"] = dict(value=13, article="§ 5 personopplysningsloven", lawId="pol2018-38", file="NO2.html", lang="no",
                 rx=r"Aldersgrensen er 13 år", url="https://lovdata.no/lov/2018-06-15-38/§5")

law("HR", "zpuouzp", "Zakon o provedbi Opće uredbe o zaštiti podataka (NN 42/2018)", "hr", "https://narodne-novine.nn.hr/clanci/sluzbeni/full/2018_05_42_805.html",
    number="NN 42/2018", dt="2018-05-09", file="HR2.html", rx=r"Zakon o provedbi Opće uredbe o zaštiti podataka NN 42/2018 \(9\.5\.2018\.\)")
AGE["HR"] = dict(value=16, article="čl. 19. st. 1. Zakona o provedbi Opće uredbe o zaštiti podataka", lawId="zpuouzp", file="HR2.html", lang="hr",
                 rx=r"obrada osobnih podataka djeteta zakonita je ako dijete ima najmanje 16 godina",
                 url="https://narodne-novine.nn.hr/clanci/sluzbeni/full/2018_05_42_805.html")

law("PL", "uodo2018", "Ustawa z dnia 10 maja 2018 r. o ochronie danych osobowych", "pl", "https://api.sejm.gov.pl/eli/acts/DU/2018/1000/text.html",
    number="Dz.U. 2018 poz. 1000", dt="2018-05-10", file="PL2.html", rx=r"Ustawa z dnia 10 maja 2018 r\. o ochronie danych osobowych", also=(r"poz\. 1000",))
absent("PL2.html", r"(dziecka|małoletni|nieletni)[^.]{0,200}zgod|zgod[^.]{0,200}(dziecka|małoletni|nieletni)", "PL child consent")
AGE["PL"] = dict(value=16, status="inferred", article="A lei lida nao contem regra de idade (verificado por ausencia no texto integral); aplica-se o art. 8(1) RGPD: 16 anos", lawId="uodo2018")

law("HU", "infotv", "2011. évi CXII. törvény az információs önrendelkezési jogról és az információszabadságról (Info tv.)", "hu", "https://net.jogtar.hu/jogszabaly?docid=a1100112.tv",
    number="2011. évi CXII.", file="HU2.html", rx=r"2011\. évi CXII\. törvény az információs önrendelkezési jogról és az információszabadságról", also=(r"2016/679",))
absent("HU2.html", r"(gyermek|kiskorú|tizenhat|tizennégy)[^.]{0,200}hozzájárul|hozzájárul[^.]{0,200}(gyermek|kiskorú|tizenhat)", "HU child consent")
AGE["HU"] = dict(value=16, status="inferred", article="O Info tv. consolidado nao contem regra de idade (verificado por ausencia); aplica-se o art. 8(1) RGPD: 16 anos", lawId="infotv")
NOTES["HU"] = ["'inferred': so o Info tv. foi lido; outras leis hungaras nao foram verificadas."]

law("FR", "loi78-17", "Loi n° 78-17 du 6 janvier 1978 relative à l'informatique, aux fichiers et aux libertés", "fr", "https://www.legifrance.gouv.fr/loda/id/LEGISCTA000037817521",
    number="Loi n° 78-17", dt="1978-01-06", file="FRcnil.out", rx=r"Loi n° 78-17 du 6 janvier 1978 relative à l'informatique, aux fichiers et aux libertés")
AGE["FR"] = dict(value=15, article="art. 45 loi n° 78-17", lawId="loi78-17", file="FRcnil.out", lang="fr",
                 rx=r"un mineur peut consentir seul à un traitement de données à caractère personnel en ce qui concerne l'offre directe de services de la société de l'information à compter de l'âge de quinze ans",
                 url="https://www.cnil.fr/fr/la-loi-informatique-et-libertes")
HEALTH["FR"] = [dict(article="Section 3 (arts. 64 et suiv.) loi n° 78-17", lawId="loi78-17", topic="Traitements de données à caractère personnel dans le domaine de la santé", file="FRcnil.out",
                     rx=r"Section 3 : Traitements de données à caractère personnel dans le domaine de la santé Article 64", lang="fr", url="https://www.cnil.fr/fr/la-loi-informatique-et-libertes")]
NOTES["FR"] = ["Texto lido na versao integral publicada pela CNIL; a publicacao oficial e o Legifrance (bloqueia acesso automatico)."]

law("DK", "dbl2018-502", "Lov om supplerende bestemmelser til forordning om beskyttelse af fysiske personer i forbindelse med behandling af personoplysninger og om fri udveksling af sådanne oplysninger (databeskyttelsesloven)", "da",
    "https://www.retsinformation.dk/eli/lta/2018/502", number="lov nr. 502 af 23/05/2018", dt="2018-05-23", file="DK.xml",
    rx=r"Lov om supplerende bestemmelser til forordning om beskyttelse af fysiske personer i forbindelse med behandling af personoplysninger og om fri udveksling af sådanne oplysninger \(databeskyttelsesloven\)")
AGE["DK"] = dict(value=13, article="§ 6, stk. 2 databeskyttelsesloven", lawId="dbl2018-502", file="DK.xml", lang="da",
                 rx=r"er behandling af personoplysninger om et barn lovlig, hvis barnet er mindst 13 år", url="https://www.retsinformation.dk/eli/lta/2018/502")
NOTES["DK"] = ["Texto lido: versao de 2018-05-23 marcada 'Historic' no Retsinformation; confirmar alteracoes posteriores na lovbekendtgorelse em vigor."]

law("FI", "tsl1050-2018", "Tietosuojalaki (1050/2018)", "fi", "https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2018/1050",
    number="1050/2018", file="FI.xml", rx=r"1050/2018 Tietosuojalaki")
AGE["FI"] = dict(value=13, article="5 § tietosuojalaki", lawId="tsl1050-2018", file="FI.xml", lang="fi",
                 rx=r"lapsen henkilötietojen käsittely on lainmukaista, jos lapsi on vähintään 13-vuotias",
                 url="https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute/2018/1050/fin@")

law("MT", "cap586", "Data Protection Act (Cap. 586)", "en", "https://legislation.mt/eli/cap/586/eng", number="Cap. 586", file="MT.txt", rx=r"CHAPTER 586 DATA PROTECTION ACT")
AGE["MT"] = dict(value=None, status="unverified", article="Cap. 586 delega ao Ministro (legislacao subsidiaria) a fixacao de idade inferior a 16, nunca abaixo de 13 (texto lido); o valor fixado nao foi lido", lawId="cap586")

law("CY", "n125-2018", "Ο περί της Προστασίας των Φυσικών Προσώπων Έναντι της Επεξεργασίας των Δεδομένων Προσωπικού Χαρακτήρα και της Ελεύθερης Κυκλοφορίας των Δεδομένων Νόμος του 2018 (125(I)/2018)", "el",
    "https://www.cylaw.org/nomoi/enop/non-ind/2018_1_125/full.html", number="125(I)/2018", file="CYfull.out", enc="iso-8859-7",
    rx=r"Ο περί της Προστασίας των Φυσικών Προσώπων Έναντι της Επεξεργασίας των Δεδομένων Προσωπικού Χαρακτήρα")
AGE["CY"] = dict(value=14, article="άρθρο 8(1) Ν. 125(I)/2018", lawId="n125-2018", file="CYfull.out", enc="iso-8859-7", lang="el",
                 rx=r"εάν το παιδί είναι τουλάχιστον δεκατεσσάρων \(14\) ετών", url="https://www.cylaw.org/nomoi/enop/non-ind/2018_1_125/full.html")

law("RO", "l190-2018", "Legea nr. 190/2018 privind măsuri de punere în aplicare a Regulamentului (UE) 2016/679", "ro", "https://www.dataprotection.ro/servlet/ViewDocument?id=1520",
    number="Legea nr. 190/2018", dt="2018-07-18", file="RO.txt", rx=r"LEGE nr\. 190 din 18 iulie 2018")
absent("RO.txt", r"copil", "RO child consent")
AGE["RO"] = dict(value=16, status="inferred", article="A Lege 190/2018 nao contem regra sobre consentimento de criancas (verificado por ausencia no texto integral); aplica-se o art. 8(1) RGPD: 16 anos", lawId="l190-2018")
NOTES["RO"] = ["Texto lido do PDF publicado pela ANSPDCP (autoridade); conversao por pdftotext com perda de diacriticos."]


# --- Third pass
law("BG", "zzld", "Закон за защита на личните данни (ЗЗЛД)", "bg",
    "https://cpdp.bg/%D0%BF%D1%80%D0%B0%D0%B2%D0%BD%D0%B0-%D1%80%D0%B0%D0%BC%D0%BA%D0%B0-%D0%BD%D0%B0%D1%86%D0%B8%D0%BE%D0%BD%D0%B0%D0%BB%D0%BD%D0%B0/%D0%B7%D0%B0%D0%BA%D0%BE%D0%BD-%D0%B7%D0%B0-%D0%B7%D0%B0%D1%89%D0%B8%D1%82%D0%B0-%D0%BD%D0%B0-%D0%BB%D0%B8%D1%87%D0%BD%D0%B8%D1%82%D0%B5-%D0%B4%D0%B0%D0%BD%D0%BD%D0%B8/",
    file="BGcp.out", rx=r"Закон за защита на личните данни", also=(r"Чл\. 25в\.",))
AGE["BG"] = dict(value=14, article="чл. 25в ЗЗЛД (нов – ДВ, бр. 17 от 2019 г.)", lawId="zzld", file="BGcp.out", lang="bg",
                 rx=r"лице, ненавършило 14 години, въз основа на съгласие",
                 url="https://cpdp.bg/%D0%BF%D1%80%D0%B0%D0%B2%D0%BD%D0%B0-%D1%80%D0%B0%D0%BC%D0%BA%D0%B0-%D0%BD%D0%B0%D1%86%D0%B8%D0%BE%D0%BD%D0%B0%D0%BB%D0%BD%D0%B0/%D0%B7%D0%B0%D0%BA%D0%BE%D0%BD-%D0%B7%D0%B0-%D0%B7%D0%B0%D1%89%D0%B8%D1%82%D0%B0-%D0%BD%D0%B0-%D0%BB%D0%B8%D1%87%D0%BD%D0%B8%D1%82%D0%B5-%D0%B4%D0%B0%D0%BD%D0%BD%D0%B8/")
NOTES["BG"] = ["Texto lido na pagina da autoridade (КЗЛД) com a versao consolidada; a publicacao oficial e o Държавен вестник."]

law("LI", "dsg-li", "Datenschutzgesetz (DSG), LR 235.1", "de", "https://www.gesetze.li/konso/pdf/2018272000?version=1", number="LGBl. 2018 Nr. 272",
    file="LIpdf.txt", rx=r"Jahrgang 2018 Nr\. 272", also=(r"Datenschutzgesetz \(DSG\)",))
absent("LIpdf.txt", r"Einwilligung[^.]{0,200}(Kind|Minderjährig)|(Kind|Minderjährig)[^.]{0,200}Einwilligung", "LI child consent")
AGE["LI"] = dict(value=16, status="inferred", article="O DSG (LR 235.1) nao contem regra de idade (verificado por ausencia no texto integral); aplica-se o art. 8(1) RGPD, que vigora no EEE: 16 anos", lawId="dsg-li")
NOTES["LI"] = ["Texto lido do PDF oficial do LGBl. (gesetze.li), convertido com pdftotext; hash do texto extraido. A Datenschutzstelle indica tambem 16 anos (fonte secundaria)."]

HEALTH["IE"] = [dict(article="s. 52", lawId="dpa2018", topic="Processing of special categories of personal data for purposes of Article 9(2)(h)", file="IE.html",
                     rx=r"52\. Processing of special categories of personal data for purposes of Article 9\(2\)\(h\)", lang="en",
                     url="https://www.irishstatutebook.ie/eli/2018/act/7/enacted/en/html")]

# --- Fourth pass: read in a real browser (rendered pages); evidence files are extracts, see NOTES
law("EE", "iks", "Isikuandmete kaitse seadus", "et", "https://www.riigiteataja.ee/et/akt/104012019011?leiaKehtiv", number="RT I, 04.01.2019, 11", dt="2018-12-12",
    file="EE.txt", rx=r"Isikuandmete kaitse seadus", also=(r"RT I, 30\.06\.2026, 52",))
AGE["EE"] = dict(value=13, article="§ 8 lg 1 isikuandmete kaitse seadus", lawId="iks", file="EE.txt", lang="et",
                 rx=r"kui laps on vähemalt 13-aastane", url="https://www.riigiteataja.ee/et/akt/104012019011?leiaKehtiv")
NOTES["EE"] = ["Lido no Riigi Teataja renderizado no navegador (versao em vigor, RT I, 30.06.2026, 52); o ficheiro guardado e um extrato (cabecalho + par. 8)."]

law("SK", "z18-2018", "Zákon o ochrane osobných údajov a o zmene a doplnení niektorých zákonov", "sk", "https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ/2018/18/", number="18/2018 Z. z.",
    file="SK.txt", rx=r"18/2018 Z\. z\. Zákon o ochrane osobných údajov a o zmene a doplnení niektorých zákonov")
AGE["SK"] = dict(value=16, article="§ 15 ods. 1 zákona č. 18/2018 Z. z.", lawId="z18-2018", file="SK.txt", lang="sk",
                 rx=r"ak dotknutá osoba dovŕšila 16 rokov veku", url="https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ/2018/18/")
NOTES["SK"] = ["Lido no Slov-Lex renderizado no navegador (versao efetiva desde 18.08.2026); extrato guardado."]

law("LU", "loi2018-08-01", "Loi du 1er août 2018 portant organisation de la Commission nationale pour la protection des données et mise en oeuvre du règlement (UE) 2016/679", "fr",
    "https://legilux.public.lu/eli/etat/leg/loi/2018/08/01/a686/jo", number="Mémorial A n° 686 (ELI a686)", dt="2018-08-01", file="LU.txt",
    rx=r"Loi du 1er août 2018 portant organisation de la Commission nationale pour la protection des données", also=(r"mineur", ) if False else ())
AGE["LU"] = dict(value=16, status="inferred", article="A lei (arts. 1 a 77, lida no Legilux) nao contem as palavras mineur/enfant/consentement; aplica-se o art. 8(1) RGPD: 16 anos", lawId="loi2018-08-01",
                 file="LU.txt", lang="fr", rx=r"VERIFICACAO DE AUSENCIA", url="https://legilux.public.lu/eli/etat/leg/loi/2018/08/01/a686/jo")
NOTES["LU"] = ["Ausencia verificada no navegador; o texto integral nao foi guardado, por isso o build nao a reproduz. Confirmar com o texto oficial."]

law("BE", "loi2018-07-30", "Loi relative à la protection des personnes physiques à l'égard des traitements de données à caractère personnel", "fr",
    "https://www.ejustice.just.fgov.be/eli/loi/2018/07/30/2018040581/justel", number="Numac 2018040581", dt="2018-07-30", journal="Moniteur belge, 5 septembre 2018", file="BE.txt",
    rx=r"30 JUILLET 2018\. - Loi relative à la protection des personnes physiques à l'égard des traitements de données à caractère personnel")
AGE["BE"] = dict(value=13, article="art. 7 loi du 30 juillet 2018", lawId="loi2018-07-30", file="BE.txt", lang="fr",
                 rx=r"licite lorsque le consentement a été donné par des enfants âgés de 13 ans ou plus", url="https://www.ejustice.just.fgov.be/eli/loi/2018/07/30/2018040581/justel")
NOTES["BE"] = ["Justel (mise a jour au 02-04-2026) renderizado no navegador; extrato guardado."]

law("SI", "zvop2", "Zakon o varstvu osebnih podatkov (ZVOP-2)", "sl", "https://www.ip-rs.si/zakonodaja/zakon-o-varstvu-osebnih-podatkov/", number="Uradni list RS, št. 163/22",
    file="SI.txt", rx=r"Zakon o varstvu osebnih podatkov \(Uradni list RS, št\. 163/22; ZVOP-2\)")
AGE["SI"] = dict(value=15, article="8. člen odst. 1 ZVOP-2", lawId="zvop2", file="SI.txt", lang="sl",
                 rx=r"je veljavna, če je otrok star 15 let ali več", url="https://www.ip-rs.si/zakonodaja/zakon-o-varstvu-osebnih-podatkov/")
NOTES["SI"] = ["Texto lido na pagina da autoridade (IP RS) renderizada no navegador; extrato guardado. A publicacao oficial e o Uradni list RS."]

# --- Fifth pass: read in the user's real Chrome (rendered pages); evidence files are extracts
law("IS", "log90-2018", "Lög um persónuvernd og vinnslu persónuupplýsinga (lög nr. 90/2018)", "is", "https://www.althingi.is/lagas/nuna/2018090.html", number="Lög nr. 90/2018", dt="2018-06-27",
    file="IS.txt", rx=r"Lög um persónuvernd og vinnslu persónuupplýsinga\. Lög nr\. 90 27\. júní 2018")
AGE["IS"] = dict(value=13, article="10. gr. laga nr. 90/2018", lawId="log90-2018", file="IS.txt", lang="is",
                 rx=r"telst vinnslan því aðeins lögmæt ef barnið hefur náð 13 ára aldri", url="https://www.althingi.is/lagas/nuna/2018090.html")
NOTES["IS"] = ["Lido no Althingi (edicao consolidada de 1. oktober 2026) renderizado no navegador; extrato guardado. O texto do RGPD sai em ingles porque nao ha versao oficial em islandes no conjunto de dados."]

law("LT", "i-1374", "Lietuvos Respublikos asmens duomenų teisinės apsaugos įstatymas (I-1374)", "lt", "https://www.e-tar.lt/portal/lt/legalAct/TAR.5368B592234C/asr", number="I-1374", dt="1996-06-11",
    file="LT.txt", rx=r"Lietuvos Respublikos asmens duomenų teisinės apsaugos įstatymas\. Rūšis: Įstatymas", also=(r"Nr\.: I-1374",))
AGE["LT"] = dict(value=14, article="6 straipsnis (asmens duomenų teisinės apsaugos įstatymas I-1374)", lawId="i-1374", file="LT.txt", lang="lt",
                 rx=r"duoda ne jaunesnis negu 14 metų vaikas", url="https://www.e-tar.lt/portal/lt/legalAct/TAR.5368B592234C/asr")
NOTES["LT"] = ["Lido no e-TAR (redacao consolidada em vigor desde 2026-06-30) renderizado no navegador; extrato guardado."]

# --- Sixth pass: Greece, read from the full text hosted by ELINYAE (Greek public body), 15 Nov-session alternative to the unreachable dpa.gr
law("GR", "n4624-2019", "Ν. 4624/2019 (ΦΕΚ 137/Α` 29.8.2019) — Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα, μέτρα εφαρμογής του Κανονισμού (ΕΕ) 2016/679", "el",
    "https://www.elinyae.gr/ethniki-nomothesia/n-46242019-fek-137a-2982019", number="ΦΕΚ Α' 137/29.8.2019", dt="2019-08-29", file="GR_elinyae.html",
    rx=r"Ν\. 4624/2019 \(ΦΕΚ 137/Α` 29\.8\.2019\)")
AGE["GR"] = dict(value=15, article="άρθρο 21 ν. 4624/2019", lawId="n4624-2019", file="GR_elinyae.html", lang="el",
                 rx=r"έχει συμπληρώσει το 15ο έτος της ηλικίας του", url="https://www.elinyae.gr/ethniki-nomothesia/n-46242019-fek-137a-2982019")
HEALTH["GR"] = [dict(article="άρθρο 22", lawId="n4624-2019", topic="Επεξεργασία ειδικών κατηγοριών δεδομένων προσωπικού χαρακτήρα (περιλαμβάνει προληπτική ιατρική, διάγνωση και περίθαλψη)", file="GR_elinyae.html",
                     rx=r"Άρθρο 22: Επεξεργασία ειδικών κατηγοριών δεδομένων προσωπικού χαρακτήρα 1\. Κατά παρέκκλιση από το άρθρο 9 παράγραφος 1 του ΓΚΠΔ", lang="el",
                     url="https://www.elinyae.gr/ethniki-nomothesia/n-46242019-fek-137a-2982019")]
NOTES["GR"] = ["Texto lido na reproducao integral da lei no site do ELINYAE (organismo publico grego); o site da autoridade (dpa.gr) esta inacessivel. A pagina nao indica se incorpora a codificacao da Lei 5221/2025: confirmar o texto em vigor no ΦΕΚ."]

# --- Seventh pass: Latvia, read from the official gazette (Latvijas Vestnesis) because likumi.lv is unreachable
law("LV", "fpdal", "Fizisko personu datu apstrādes likums", "lv", "https://www.vestnesis.lv/op/2018/132.1", number="Latvijas Vēstnesis, 4.07.2018., Nr. 132", dt="2018-06-21",
    journal="Latvijas Vēstnesis, 4.07.2018., Nr. 132", file="LV_vestnesis.html",
    rx=r"Fizisko personu datu apstrādes likums\. Publicēts oficiālajā izdevumā \"Latvijas Vēstnesis\", 4\.07\.2018\., Nr\. 132")
AGE["LV"] = dict(value=13, article="33. pants Fizisko personu datu apstrādes likuma", lawId="fpdal", file="LV_vestnesis.html", lang="lv",
                 rx=r"viņa datu apstrāde ir likumīga, ja bērns ir vismaz 13 gadus vecs", url="https://www.vestnesis.lv/op/2018/132.1")
NOTES["LV"] = ["Texto lido na publicacao oficial de 2018 (Latvijas Vestnesis); nao reflete alteracoes posteriores. O likumi.lv (versao consolidada) esta inacessivel daqui: confirmar o texto em vigor."]


# --- Sector health laws (first set: PT, ES, FR)
H = "health/"
sector("PT", "lei12-2005", "Lei n.º 12/2005, de 26 de janeiro — Informação genética pessoal e informação de saúde (versão consolidada)", "pt", "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2005-106603593", number="Lei n.º 12/2005",
       provisions=[("Artigo 3.º n.º 1", "Propriedade da informação de saúde", H + "PT_consolidada.txt", "utf-8",
                    r"Lei 12/2005 - Artigo 3\.º Propriedade da informação de saúde 1 - A informação de saúde, incluindo os dados clínicos registados", "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2005-106603593"),
                   ("Artigo 3.º n.º 2", "Direito do titular a conhecer todo o processo clínico", H + "PT_consolidada.txt", "utf-8",
                    r"2 - O titular da informação de saúde tem o direito de, querendo, tomar conhecimento de todo o processo clínico que lhe diga respeito", "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2005-106603593")],
       note="Versão consolidada do Diário da República (lida em 2026-11-01); última alteração listada: Lei n.º 26/2016. O art. 3.º consolidado é igual ao original. Lidos só os n.os 1 e 2.")
sector("PT", "lei15-2014", "Lei n.º 15/2014, de 21 de março — Direitos e deveres do utente dos serviços de saúde (versão consolidada)", "pt", "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-106901319", number="Lei n.º 15/2014",
       provisions=[("Artigo 3.º", "Consentimento ou recusa dos cuidados de saúde", H + "PT_consolidada.txt", "utf-8",
                    r"Lei 15/2014 - Artigo 3\.º Consentimento ou recusa 1 - O consentimento ou a recusa da prestação dos cuidados de saúde devem ser declarados de forma livre e esclarecida", "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-106901319"),
                   ("Artigo 6.º", "Sigilo", H + "PT_consolidada.txt", "utf-8",
                    r"Lei 15/2014 - Artigo 6\.º Sigilo 1 - O utente dos serviços de saúde tem direito ao sigilo sobre os seus dados pessoais", "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2014-106901319")],
       note="Versão consolidada do Diário da República (lida em 2026-11-01); alterações listadas até a Lei n.º 57/2026. Os arts. 3.º e 6.º consolidados são iguais ao original. Os arts. 5.º (proteção de dados) e 7.º (informação) não foram registados.")
sector("ES", "ley41-2002", "Ley 41/2002, de 14 de noviembre, básica reguladora de la autonomía del paciente y de derechos y obligaciones en materia de información y documentación clínica", "es",
       "https://www.boe.es/buscar/act.php?id=BOE-A-2002-22188", number="Ley 41/2002",
       provisions=[("Artículo 7.1", "El derecho a la intimidad", H + "ES_ley41_2002.raw.txt", "utf-8",
                    r"Artículo 7\. El derecho a la intimidad\. 1\. Toda persona tiene derecho a que se respete el carácter confidencial de los datos referentes a su salud", "https://www.boe.es/buscar/pdf/2002/BOE-A-2002-22188-consolidado.pdf"),
                   ("Artículo 8.1", "Consentimiento informado", H + "ES_ley41_2002.raw.txt", "utf-8",
                    r"Artículo 8\. Consentimiento informado\. 1\. Toda actuación en el ámbito de la salud de un paciente necesita el consentimiento libre y voluntario del afectado", "https://www.boe.es/buscar/pdf/2002/BOE-A-2002-22188-consolidado.pdf"),
                   ("Artículo 14.1", "Definición y archivo de la historia clínica", H + "ES_ley41_2002.raw.txt", "utf-8",
                    r"Artículo 14\. Definición y archivo de la historia clínica\. 1\. La historia clínica comprende el conjunto de los documentos", "https://www.boe.es/buscar/pdf/2002/BOE-A-2002-22188-consolidado.pdf"),
                   ("Artículo 18.1", "Derechos de acceso a la historia clínica y a obtener copia", H + "ES_ley41_2002.raw.txt", "utf-8",
                    r"Artículo 18\. Derechos de acceso a la historia clínica\. 1\. El paciente tiene el derecho de acceso, con las reservas señaladas en el apartado 3 de este artículo, a la documentación de la historia clínica", "https://www.boe.es/buscar/pdf/2002/BOE-A-2002-22188-consolidado.pdf"),
                   ("Artículo 17.1", "Conservación de la documentación clínica (mínimo cinco años desde el alta)", H + "ES_ley41_2002.raw.txt", "utf-8",
                    r"Artículo 17\. La conservación de la documentación clínica\. 1\. Los centros sanitarios tienen la obligación de conservar la documentación clínica", "https://www.boe.es/buscar/pdf/2002/BOE-A-2002-22188-consolidado.pdf")],
       note="Texto consolidado do BOE (carácter informativo, sem valor jurídico próprio); há também leis autonómicas de documentação clínica, não verificadas.")
sector("FR", "csp", "Code de la santé publique (articles L1110-4, L1111-7 et L1111-8)", "fr", "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043895798",
       provisions=[("Article L1110-4", "Respect de la vie privée et secret des informations", H + "FR_csp.txt", "utf-8",
                    r"Article L1110-4 — I\.-Toute personne prise en charge par un professionnel de santé", "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043895798"),
                   ("Article L1111-7", "Accès de la personne aux informations concernant sa santé", H + "FR_csp.txt", "utf-8",
                    r"Article L1111-7 — Toute personne a accès à l'ensemble des informations concernant sa santé", "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042685313/2026-11-01"),
                   ("Article L1111-8", "Hébergement de données de santé (certificat de conformité HDS, information de la personne, contrat)", H + "FR_csp.txt", "utf-8",
                    r"Article L1111-8 — I\.-Toute personne qui héberge des données de santé à caractère personnel", "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049577902")],
       note="Légifrance, version en vigueur au 1.11.2026 (lida no Chrome do utilizador). Lidos apenas o início de L1110-4 e L1111-7 e o I e II de L1111-8.")


# --- Sector health laws (second set: DE, SE, CZ, FI)
GII = "https://www.gesetze-im-internet.de"
sector("DE", "bgb-behandlungsvertrag", "Bürgerliches Gesetzbuch (BGB), Behandlungsvertrag: §§ 630d, 630f, 630g", "de", GII + "/bgb/__630d.html",
       provisions=[("§ 630d Abs. 1 BGB", "Einwilligung", H + "DE_bgb630d.html", "utf-8",
                    r"§ 630d Einwilligung \(1\) Vor Durchführung einer medizinischen Maßnahme, insbesondere eines Eingriffs in den Körper oder die Gesundheit, ist der Behandelnde verpflichtet", GII + "/bgb/__630d.html"),
                   ("§ 630f Abs. 1 BGB", "Dokumentation der Behandlung (Behandlungsakte)", H + "DE_bgb630f.html", "utf-8",
                    r"§ 630f Dokumentation der Behandlung \(1\) Der Behandelnde ist verpflichtet, zum Zweck der Dokumentation in unmittelbarem zeitlichen Zusammenhang mit der Behandlung eine Behandlungsakte", GII + "/bgb/__630f.html"),
                   ("§ 630g Abs. 1 BGB", "Einsichtnahme in die Behandlungsakte", H + "DE_bgb630g.html", "utf-8",
                    r"§ 630g Einsichtnahme in die Behandlungsakte \(1\) Dem Patienten ist auf Verlangen unverzüglich Einsicht in die vollständige, ihn betreffende Behandlungsakte zu ge", GII + "/bgb/__630g.html")],
       note="Gesetze-im-Internet (Bundesministerium der Justiz). Os Länder têm leis hospitalares e de profissões de saúde próprias, não verificadas.")
sector("DE", "stgb-203", "Strafgesetzbuch (StGB) § 203 — Verletzung von Privatgeheimnissen (segredo profissional, incl. médicos)", "de", GII + "/stgb/__203.html",
       provisions=[("§ 203 Abs. 1 StGB", "Verletzung von Privatgeheimnissen", H + "DE_stgb203.html", "utf-8",
                    r"§ 203 Verletzung von Privatgeheimnissen \(1\) Wer unbefugt ein fremdes Geheimnis", GII + "/stgb/__203.html")])
sector("SE", "patientlag-2014-821", "Patientlag (2014:821)", "sv", "https://data.riksdagen.se/dokument/sfs-2014-821.text", number="SFS 2014:821",
       provisions=[("4 kap. 2 §", "Samtycke till hälso- och sjukvård", H + "SE_patientlag.txt", "utf-8",
                    r"4 kap\. Samtycke 1 § Patientens självbestämmande och integritet ska respekteras\. 2 § Hälso- och sjukvård får inte ges utan patientens samtycke", "https://data.riksdagen.se/dokument/sfs-2014-821.text")],
       note="Versão do Riksdagen com alterações até SFS 2026:213.")
sector("SE", "patientdatalag-2008-355", "Patientdatalag (2008:355)", "sv", "https://data.riksdagen.se/dokument/sfs-2008-355.text", number="SFS 2008:355",
       provisions=[("3 kap. 1 §", "Skyldigheten att föra patientjournal", H + "SE_pdl.txt", "utf-8",
                    r"3 kap\. Skyldigheten att föra patientjournal Inledande bestämmelse 1 § Vid vård av patienter ska det föras patientjournal", "https://data.riksdagen.se/dokument/sfs-2008-355.text"),
                   ("Inre sekretess 1 §", "Åtkomst till patientuppgifter endast vid deltagande i vården eller behov i arbetet", H + "SE_pdl.txt", "utf-8",
                    r"Inre sekretess 1 § Den som arbetar hos en vårdgivare får ta del av dokumenterade uppgifter om en patient endast om han eller hon deltar i vården", "https://data.riksdagen.se/dokument/sfs-2008-355.text")],
       note="Versão do Riksdagen com alterações até SFS 2024:241.")
sector("CZ", "z372-2011", "Zákon č. 372/2011 Sb., o zdravotních službách a podmínkách jejich poskytování", "cs", "https://www.zakonyprolidi.cz/cs/2011-372", number="372/2011 Sb.",
       provisions=[("§ 28 odst. 1", "Souhlas pacienta (svobodný a informovaný souhlas)", H + "CZ_372.html", "utf-8",
                    r"§ 28 \(1\) Zdravotní služby lze pacientovi poskytnout pouze s jeho svobodným a informovaným souhlasem", "https://www.zakonyprolidi.cz/cs/2011-372"),
                   ("§ 51 odst. 1", "Zachování mlčenlivosti v souvislosti se zdravotními službami", H + "CZ_372.html", "utf-8",
                    r"§ 51 Zachování mlčenlivosti v souvislosti se zdravotními službami \(1\) Poskytovatel je povinen zachovat mlčenlivost o všech skutečnostech", "https://www.zakonyprolidi.cz/cs/2011-372")],
       note="Texto lido no portal Zákony pro lidi (não oficial; a publicação oficial é a Sbírka zákonů).")
FIN = "https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute/1992/785/fin@"
sector("FI", "laki785-1992", "Laki potilaan asemasta ja oikeuksista (785/1992)", "fi", "https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/1992/785", number="785/1992",
       provisions=[("5 §", "Potilaan tiedonsaantioikeus", H + "FI_785.xml", "utf-8", r"5 § Potilaan tiedonsaantioikeus Potilaalle on annettava selvitys hänen terveydentilastaan", FIN),
                   ("6 §", "Potilaan itsemääräämisoikeus", H + "FI_785.xml", "utf-8", r"6 § Potilaan itsemääräämisoikeus Potilasta on hoidettava yhteisymmärryksessä hänen kanssaan", FIN),
                   ("13 §", "Potilasasiakirjoihin sisältyvien tietojen salassapito", H + "FI_785.xml", "utf-8", r"13 § Potilasasiakirjoihin sisältyvien tietojen salassapito Potilasasiakirjoihin sisältyvät tiedot ovat salassapidettäviä", FIN)])


# --- Sector health laws (third set: NL, AT)
sector("NL", "bw7-wgbo", "Burgerlijk Wetboek Boek 7, titel 7, afdeling 5 — Overeenkomst inzake geneeskundige behandeling (art. 7:446 e.v.)", "nl", "https://wetten.overheid.nl/BWBR0005290/", number="BWBR0005290",
       provisions=[("Artikel 7:448 lid 1 BW", "Informatieplicht van de hulpverlener", H + "NL_bw7.txt", "utf-8",
                    r"Artikel 448 Toon relaties.{0,160}?1 De hulpverlener licht de patiënt op duidelijke wijze in", "https://wetten.overheid.nl/BWBR0005290/"),
                   ("Artikel 7:450 lid 1 BW", "Toestemming van de patiënt", H + "NL_bw7.txt", "utf-8",
                    r"Artikel 450 Toon relaties.{0,160}?1 Voor verrichtingen ter uitvoering van een behandelingsovereenkomst is de toestemming van de patiënt vereist", "https://wetten.overheid.nl/BWBR0005290/"),
                   ("Artikel 7:454 lid 1 BW", "Patiëntendossier", H + "NL_bw7.txt", "utf-8",
                    r"Artikel 454 Toon relaties.{0,160}?1 De hulpverlener richt een dossier in met betrekking tot de behandeling van de patiënt", "https://wetten.overheid.nl/BWBR0005290/"),
                   ("Artikel 7:457 lid 1 BW", "Vertrouwelijkheid: geen inlichtingen aan anderen zonder toestemming van de patiënt", H + "NL_bw7.txt", "utf-8",
                    r"Artikel 457 Toon relaties.{0,160}?1 Onverminderd het in artikel 448 lid 4, tweede volzin , bepaalde draagt de hulpverlener zorg, dat aan anderen dan de patiënt geen inlichtingen", "https://wetten.overheid.nl/BWBR0005290/")],
       note="Wetten.nl (Overheid.nl), Boek 7 BW na raadpleging; a versão exibida é a vigente à data da leitura.")
RIS = "https://data.bka.gv.at/ris/api/v2.6/Bundesrecht?Applikation=BrKons&Gesetzesnummer=10011138"
sector("AT", "aerztegesetz-1998", "Ärztegesetz 1998 (ÄrzteG 1998), BGBl. I Nr. 169/1998", "de", "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10011138", number="BGBl. I Nr. 169/1998",
       provisions=[("§ 51 Abs. 1 ÄrzteG", "Dokumentationspflicht und Auskunftserteilung", H + "AT_ag_p51_best.txt", "utf-8",
                    r"Dokumentationspflicht und Auskunftserteilung § 51\. Paragraph 51, \(1\) Absatz eins, Der Arzt ist verpflichtet, Aufzeichnungen über jede zur Beratung oder Behandlung übernommene Person",
                    RIS + "&Abschnitt.Typ=Paragraph&Abschnitt.Von=51&Abschnitt.Bis=51"),
                   ("§ 54 Abs. 1 ÄrzteG", "Verschwiegenheitspflicht", H + "AT_ag_p54_best.txt", "utf-8",
                    r"Verschwiegenheits-, Anzeige- und Meldepflicht § 54\. Paragraph 54, \(1\) Absatz eins, Die Ärztin/der Arzt und ihre/seine Hilfspersonen sind zur Verschwiegenheit",
                    RIS + "&Abschnitt.Typ=Paragraph&Abschnitt.Von=54&Abschnitt.Bis=54")],
       note="RIS (Bundeskanzleramt). § 51: fassung in Kraft seit 30.07.2026 (BGBl. I Nr. 65/2026); § 54: última versão listada no RIS, em vigor desde 30.10.2019. Os Länder têm leis hospitalares próprias, não verificadas.")


# --- Sector health laws (fourth set: DK, PL, HU)
DKU = "https://www.retsinformation.dk/eli/lta/2025/275/xml"
sector("DK", "sundhedsloven", "Bekendtgørelse af sundhedsloven (LBK nr. 275 af 12/03/2025)", "da", "https://www.retsinformation.dk/eli/lta/2025/275", number="LBK nr. 275/2025",
       provisions=[("§ 15 stk. 1", "Informeret samtykke", H + "DK_sundhedsloven.xml", "utf-8", r"Informeret samtykke § 15\. Ingen behandling må indledes eller fortsættes uden patientens informerede samtykke", DKU),
                   ("§ 41 stk. 1", "Videregivelse af helbredsoplysninger til andre sundhedspersoner kun med patientens samtykke", H + "DK_sundhedsloven.xml", "utf-8",
                    r"§ 41\. Med patientens samtykke kan sundhedspersoner videregive oplysninger til andre sundhedspersoner om patientens helbredsforhold", DKU)],
       note="Retsinformation marca esta versão como 'Historic' (existe versão posterior a 2026-10-22): confirmar a lovbekendtgørelse em vigor. Lidos apenas §§ 15 e 41; as regras de journalføring e tavshedspligt (cap. 9) estão em outros artigos e na bekendtgørelse sobre patientjournaler, não lidos.")
PLU = "https://eli.gov.pl/api/acts/DU/2009/417/text.html"
sector("PL", "ustawa-prawa-pacjenta", "Ustawa z dnia 6 listopada 2008 r. o prawach pacjenta i Rzeczniku Praw Pacjenta (Dz.U. 2009 nr 52 poz. 417)", "pl", "https://eli.gov.pl/eli/DU/2009/417/ogl", number="Dz.U. 2009 nr 52 poz. 417",
       provisions=[("Art. 9 ust. 1", "Prawo do informacji o stanie zdrowia", H + "PL_pacjenta.html", "utf-8", r"Art\. 9\. 1\. Pacjent ma prawo do informacji o swoim stanie zdrowia", PLU),
                   ("Art. 13", "Prawo do zachowania w tajemnicy informacji związanych z pacjentem", H + "PL_pacjenta.html", "utf-8", r"Art\. 13\. Pacjent ma prawo do zachowania w tajemnicy przez osoby wykonujące zawód medyczny", PLU),
                   ("Art. 16", "Zgoda na udzielenie świadczeń zdrowotnych lub jej odmowa", H + "PL_pacjenta.html", "utf-8", r"Art\. 16\. Pacjent ma prawo do wyrażenia zgody na udzielenie określonych świadczeń zdrowotnych lub odmowy takiej zgody", PLU),
                   ("Art. 24 ust. 1", "Prowadzenie, przechowywanie i udostępnianie dokumentacji medycznej", H + "PL_pacjenta.html", "utf-8",
                    r"Art\. 24\. 1\. W celu realizacji prawa, o którym mowa w art\. 23 ust\. 1, podmiot udzielający świadczeń zdrowotnych jest obowiązany prowadzić, przechowywać i udostępniać dokumentację medyczną", PLU)],
       note="Texto lido em eli.gov.pl (versão do ELI); pode ser a redação publicada e não o texto jednolity de 2024: confirmar a redação consolidada (obwieszczenie de 16.4.2024).")
HUU = "https://net.jogtar.hu/jogszabaly?docid=99700154.tv"
sector("HU", "eutv-1997-154", "1997. évi CLIV. törvény az egészségügyről (Eütv.)", "hu", HUU, number="1997. évi CLIV.",
       provisions=[("13. § (1)", "A tájékoztatáshoz való jog", H + "HU_eutv.html", "utf-8", r"13\. § \(1\) A beteg jogosult a számára egyéniesített formában megadott teljes körű tájékoztatásra", HUU),
                   ("24. § (1)", "Az egészségügyi dokumentáció megismerésének joga", H + "HU_eutv.html", "utf-8", r"24\. § \(1\) \* A beteg jogosult a róla készült egészségügyi dokumentációban foglaltakat", HUU),
                   ("25. § (1)", "Az orvosi titoktartáshoz való jog", H + "HU_eutv.html", "utf-8", r"25\. § \(1\) \* A beteg jogosult arra, hogy az egészségügyi ellátásában részt vevő személyek az ellátása során tudomásukra jutott információkat", HUU)],
       note="Hatályos Jogszabályok Gyűjteménye (jogtar.hu), texto consolidado; a lei de dados de saúde (Eüak., 1997. évi XLVII.) não foi lida.")


# --- Sector health laws (fifth set: IS)
ISU = "https://www.althingi.is/lagas/nuna/1997074.html"
sector("IS", "log74-1997", "Lög um réttindi sjúklinga (lög nr. 74/1997)", "is", ISU, number="Lög nr. 74/1997",
       provisions=[("5. gr.", "Réttur sjúklings til upplýsinga um heilsufar og meðferð", H + "IS_74_1997.txt", "utf-8", r"5\. gr\. Sjúklingur á rétt á upplýsingum um: a\. heilsufar", ISU),
                   ("13. gr.", "Þagnarskylda: samþykki sjúklings leysir starfsmann undan þagnarskyldu", H + "IS_74_1997.txt", "utf-8", r"13\. gr\. Þagnarskylda skv\. 12\. gr\. nær ekki til atvika", ISU)],
       note="Lidos só os arts. 5 e 13 (a numeração dos artigos na página do Althingi é irregular); a regra do consentimento para tratamento e a do prontuário (sjúkraskrá) não foram lidas. O texto do RGPD sai em inglês para a Islândia.")


# --- Sector health laws (sixth set: LV, SI, HR, NO)
VLV = "https://www.vestnesis.lv/ta/id/203008-pacientu-tiesibu-likums"
sector("LV", "pacientu-tiesibu-likums", "Pacientu tiesību likums", "lv", VLV, number="Latvijas Vēstnesis (id 203008)",
       provisions=[("6. pants (1)", "Piekrišana ārstniecībai vai atteikšanās no tās (informētā piekrišana)", H + "LV_pacientu.html", "utf-8",
                    r"6\.pants\. Piekrišana ārstniecībai vai atteikšanās no tās \(1\) Ārstniecība ir pieļaujama, ja pacients devis tai informēto piekrišanu", VLV)],
       note="Texto do Latvijas Vēstnesis (pode não refletir alterações posteriores; a lei foi alterada).")
sector("LV", "arstniecibas-likums", "Ārstniecības likums", "lv", "https://www.vestnesis.lv/ta/id/44108-arstniecibas-likums", number="Latvijas Vēstnesis (id 44108)",
       provisions=[("50. pants (1)", "Ziņas par pacientu ir konfidenciālas", H + "LV_arstniecibas.html", "utf-8",
                    r"50\.pants\. \(1\) Ziņas par pacienta ārstēšanu, slimības diagnozi un prognozi \(turpmāk — ziņas par pacientu\)", "https://www.vestnesis.lv/ta/id/44108-arstniecibas-likums")],
       note="Texto do Latvijas Vēstnesis (pode não refletir alterações posteriores).")
UL = "https://www.uradni-list.si/glasilo-uradni-list-rs/vsebina/2008-01-0455"
sector("SI", "zpacp", "Zakon o pacientovih pravicah (ZPacP), Uradni list RS 15/2008", "sl", UL, number="Uradni list RS, št. 15/08",
       provisions=[("26. člen (1)–(2)", "Privolitev pacienta", H + "SI_zpacp.html", "utf-8", r"26\. člen \(privolitev\) \(1\) Pacient ima pravico do samostojnega odločanja o zdravljenju", UL),
                   ("41. člen (1)", "Način seznanitve z zdravstveno dokumentacijo (vpogled in prepis)", H + "SI_zpacp.html", "utf-8",
                    r"41\. člen \(način seznanitve z zdravstveno dokumentacijo\) \(1\) Pacient ima ob prisotnosti zdravnika", UL)],
       note="Texto da publicação original de 2008 no Uradni list; a lei foi alterada em 2017, 2020 e 2022 (versão consolidada no PISRS, não lida).")
UH = "https://narodne-novine.nn.hr/clanci/sluzbeni/2004_12_169_2953.html"
sector("HR", "zzpp-169-2004", "Zakon o zaštiti prava pacijenata (NN 169/2004)", "hr", UH, number="NN 169/2004",
       provisions=[("Članak 6.", "Pravo na suodlučivanje: obaviještenost, prihvaćanje ili odbijanje postupka", H + "HR_pacijenti.html", "utf-8",
                    r"Članak 6\. Pravo na suodlučivanje pacijenta obuhvaća pravo pacijenta na obaviještenost i pravo na prihvaćanje ili odbijanje pojedinoga dijagnostičkog, odnosno terapijskog postupka", UH),
                   ("Članak 25.", "Pravo na povjerljivost podataka o zdravlju", H + "HR_pacijenti.html", "utf-8",
                    r"Članak 25\. Pacijent ima pravo na povjerljivost podataka koji se odnose na stanje njegova zdravlja", UH)],
       note="Texto de 2004 publicado no Narodne novine; a lei foi alterada (NN 37/2008) e há lei posterior sobre dados em saúde (NN 14/2019), não lida.")
LN = "https://lovdata.no/lov/1999-07-02-63"
sector("NO", "pasient-og-brukerrettighetsloven", "Lov om pasient- og brukerrettigheter (pasient- og brukerrettighetsloven), LOV-1999-07-02-63", "no", LN, number="LOV-1999-07-02-63",
       provisions=[("§ 4-1", "Hovedregel om samtykke", H + "NO_pasient.html", "utf-8", r"§ 4-1\. Hovedregel om samtykke Helsehjelp kan bare gis med pasientens samtykke", LN),
                   ("§ 5-1", "Rett til innsyn i journal", H + "NO_pasient.html", "utf-8", r"§ 5-1\. Rett til innsyn i journal Pasienten og brukeren har rett til innsyn i journalen sin", LN)],
       note="Lovdata, texto em vigor à data da leitura.")
sector("NO", "helsepersonelloven", "Lov om helsepersonell m.v. (helsepersonelloven), LOV-1999-07-02-64", "no", "https://lovdata.no/lov/1999-07-02-64", number="LOV-1999-07-02-64",
       provisions=[("§ 21", "Helsepersonells taushetsplikt", H + "NO_helsepers.html", "utf-8", r"§ 21\. Helsepersonells taushetsplikt Opplysninger om folks legems- eller sykdomsforhold", "https://lovdata.no/lov/1999-07-02-64")],
       note="Lovdata, texto em vigor à data da leitura. A página indica alterações recentes sobre sigilo (2026), não lidas em detalhe.")


# --- Sector health laws (seventh set: GR)
GRU = "https://www.elinyae.gr/en/node/47552"
sector("GR", "n3418-2005", "Ν. 3418/2005 (ΦΕΚ 287/Α` 28.11.2005) — Κώδικας Ιατρικής Δεοντολογίας", "el", GRU, number="ΦΕΚ 287/Α' 28.11.2005",
       provisions=[("Άρθρο 11", "Υποχρέωση ενημέρωσης", H + "GR_3418.html", "utf-8", r"Άρθρο 11: Υποχρέωση ενημέρωσης 1\. Ο ιατρός έχει καθήκον αληθείας προς τον ασθενή", GRU),
                   ("Άρθρο 12", "Συναίνεση του ενημερωμένου ασθενή", H + "GR_3418.html", "utf-8", r"Άρθρο 12: Συναίνεση του ενημερωμένου ασθενή 1\. Ο ιατρός δεν επιτρέπεται να προβεί στην εκτέλεση οποιασδήποτε ιατρικής πράξης χωρίς την προηγούμενη συναίνεση του ασθενή", GRU),
                   ("Άρθρο 13", "Ιατρικό απόρρητο", H + "GR_3418.html", "utf-8", r"Άρθρο 13: Ιατρικό απόρρητο 1\. Ο ιατρός οφείλει να τηρεί αυστηρά απόλυτη εχεμύθεια", GRU)],
       note="Texto no ELINYAE (organismo público grego), não no ΦΕΚ. A busca indica alteração pela Lei 3996/2011; a página não diz se incorpora alterações posteriores. A lei geral dos direitos do doente (Lei 2071/1992) não foi lida.")


# --- Sector health laws (eighth set: SK, LU)
SKU = "https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ/2004/576/"
sector("SK", "z576-2004", "Zákon č. 576/2004 Z. z. o zdravotnej starostlivosti, službách súvisiacich s poskytovaním zdravotnej starostlivosti", "sk", SKU, number="576/2004 Z. z.",
       provisions=[("§ 6 ods. 1", "Poučenie a informovaný súhlas", H + "SK_576.txt", "utf-8", r"§ 6 Poučenie a informovaný súhlas \(1\) Ošetrujúci zdravotnícky pracovník je povinný informovať o účele, povahe, následkoch a rizikách", SKU),
                   ("§ 18 ods. 1", "Spracúvanie, poskytovanie a sprístupňovanie údajov zo zdravotnej dokumentácie", H + "SK_576.txt", "utf-8", r"§ 18 Spracúvanie, poskytovanie a sprístupňovanie údajov zo zdravotnej dokumentácie \(1\) Poskytovateľ je povinný", SKU)],
       note="Slov-Lex, časová verzia účinná od 01.08.2026 (lida no Chrome do utilizador). Lidos só o início de § 6 (a definição de consentimento está nos números seguintes) e de § 18; a mlčanlivosť está na Lei 578/2004, não lida.")
LUU = "https://legilux.public.lu/eli/etat/leg/loi/2014/07/24/n2/jo"
sector("LU", "loi-2014-07-24-patient", "Loi du 24 juillet 2014 relative aux droits et obligations du patient", "fr", LUU, number="Loi du 24 juillet 2014",
       provisions=[("Art. 15 (1)", "Droit à un dossier patient soigneusement tenu à jour", H + "LU_patient.txt", "utf-8", r"Art\. 15\. Droit à un dossier patient soigneusement tenu à jour \(1\)Le patient a droit", LUU),
                   ("Art. 18 (1)", "Confidentialité et secret professionnel", H + "LU_patient.txt", "utf-8", r"Art\. 18\. Confidentialité et secret professionnel \(1\)Par dérogation à l'article 458 du Code pénal", LUU)],
       note="Texto do Journal officiel (2014); a versão consolidada (eli/.../n1) não foi lida. O consentimento para cuidados aparece em outros artigos desta lei (informação: art. 8), não registados.")


# --- Sector health laws (ninth set: LT)
LTU = "https://www.e-tar.lt/portal/lt/legalAct/TAR.C6E4170DB704/asr"
sector("LT", "i-1562", "Lietuvos Respublikos pacientų teisių ir žalos sveikatai atlyginimo įstatymas (I-1562)", "lt", LTU, number="I-1562",
       provisions=[("7 straipsnis 1 d.", "Teisė susipažinti su įrašais savo medicinos dokumentuose", H + "LT_1562.txt", "utf-8", r"7 straipsnis\. Teisė susipažinti su įrašais savo medicinos dokumentuose 1\. Paciento pageidavimu jam turi būti pateikti jo medicinos dokumentai", LTU),
                   ("8 straipsnis 1 d.", "Teisė į privataus gyvenimo neliečiamumą", H + "LT_1562.txt", "utf-8", r"8 straipsnis\. Teisė į privataus gyvenimo neliečiamumą 1\. Paciento privatus gyvenimas yra neliečiamas", LTU),
                   ("14 straipsnis 1 d.", "Draudimas teikti sveikatos priežiūros paslaugas be paciento sutikimo", H + "LT_1562.txt", "utf-8", r"14 straipsnis\. Draudimas teikti sveikatos priežiūros paslaugas be paciento sutikimo 1\. Pacientui nuo 16 metų sveikatos priežiūros paslaugos teikiamos tik su jo sutikimu", LTU)],
       note="e-TAR, suvestinė redakcija nuo 2025-07-01 (pode existir redação posterior). Lidos só o início de cada artigo.")


# --- Sector health laws (tenth set: EE)
EEU = "https://www.riigiteataja.ee/akt/v%C3%B5s?leiaKehtiv"
sector("EE", "vos-tervishoiuteenus", "Võlaõigusseadus (VÕS), 41. peatükk — tervishoiuteenuse osutamise leping (§§ 766 ja 769)", "et", EEU, number="RT I, 20.06.2026, 18 (redação)",
       provisions=[("§ 766 lg 1", "Patsiendi teavitamise ja nõusoleku saamise kohustus", H + "EE_vos.txt", "utf-8", r"§ 766\. Patsiendi teavitamise ja tema nõusoleku saamise kohustus \(1\) Tervishoiuteenuse osutaja peab patsienti teavitama", EEU),
                   ("§ 769", "Dokumenteerimiskohustus (prontuário e acesso do paciente)", H + "EE_vos.txt", "utf-8", r"§ 769\. Dokumenteerimiskohustus Tervishoiuteenuse osutaja peab patsiendile tervishoiuteenuse osutamise nõuetekohaselt dokumenteerima", EEU)],
       note="Riigi Teataja, redação em vigor de 01.09.2026 a 31.12.2026 (pode haver redação posterior). Lido só o início do § 766; a regra do consentimento está nos números seguintes. A lei de organização dos serviços de saúde não foi lida.")


# --- Sector health laws (eleventh set: IT)
ITU = "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2017-12-22;219"
sector("IT", "l219-2017", "Legge 22 dicembre 2017, n. 219 — Norme in materia di consenso informato e di disposizioni anticipate di trattamento", "it", ITU, number="Legge n. 219/2017",
       provisions=[("Art. 1 comma 1", "Consenso informato: nessun trattamento sanitario senza consenso libero e informato", H + "IT_l219.txt", "utf-8",
                    r"Art\. 1 Consenso informato 1\. La presente legge, nel rispetto dei principi di cui agli articoli 2, 13 e 32 della Costituzione", ITU)],
       note="Normattiva (lida no Chrome do utilizador). Lido só o art. 1, comma 1. Não cobre prontuário nem segredo profissional (art. 622 do Código Penal e código deontológico), não lidos.")


# --- Sector health laws (twelfth set: CY, BG, LI)
CYU = "http://www.cylaw.org/nomoi/enop/non-ind/2005_1_1/full.html"
sector("CY", "n1-2005", "Ο περί της Κατοχύρωσης και της Προστασίας των Δικαιωμάτων των Ασθενών Νόμος του 2004 (1(Ι)/2005)", "el", CYU, number="1(I)/2005",
       provisions=[("άρθρο 11 εδ. 1", "Φροντίδα υγείας με τη συγκατάθεση του ασθενούς", H + "CY_1_2005.html", "iso-8859-7", r"Φροντίδα υγείας με τη συγκατάθεση του ασθενούς\. 11\.-\(1\) Προϋπόθεση για την παροχή φροντίδας υγείας είναι η ενημερωμένη συγκατάθεση του ασθενούς", CYU),
                   ("άρθρο 15 εδ. 1(α)", "Εμπιστευτικότητα", H + "CY_1_2005.html", "iso-8859-7", r"Εμπιστευτικότητα\. 15\.-\(1\) \(α\) Με την επιφύλαξη των διατάξεων του εδαφίου \(2\), όλες οι πληροφορίες για την ιατρική κατάσταση του ασθενούς", CYU)],
       note="Cylaw; a página cita a alteração 54(I)/2025. Lidos só o início dos arts. 11 e 15; arts. 10 (informação) e 18 (arquivos médicos) não lidos.")
BGU = "https://www.mh.government.bg/upload/12273/Zakon%20za%20zdraveto%2014-10-2024.pdf"
sector("BG", "zakon-za-zdraveto", "Закон за здравето (ДВ, бр. 70 от 2004 г.)", "bg", BGU, number="ДВ, бр. 70/2004",
       provisions=[("Чл. 86, ал. 1", "Права на пациента", H + "BG_zzdraveto.txt", "utf-8", r"Чл\. 86\. \(1\) Като пациент всеки има право на", BGU),
                   ("Чл. 87, ал. 1", "Информирано съгласие", H + "BG_zzdraveto.txt", "utf-8", r"Чл\. 87\. \(1\) Медицинските дейности се осъществяват след изразено информирано съгласие от пациента", BGU),
                   ("Чл. 28б", "Право на достъп до здравната информация и копия от медицинските документи", H + "BG_zzdraveto.txt", "utf-8", r"Чл\. 28б\. \(Нов - ДВ, бр\. 41 от 2009 г\., в сила от 02\.06\.2009 г\.\) \(1\) Пациентът има право да получи от лечебното заведение здравната информация", BGU),
                   ("Чл. 28в", "Задължение за неразгласяване на информацията за пациента", H + "BG_zzdraveto.txt", "utf-8", r"Чл\. 28в\. \(Нов - ДВ, бр\. 41 от 2009 г\., в сила от 02\.06\.2009 г\.\) Медицинските специалисти и служители в лечебните заведения нямат право да разгласяват информация за пациента", BGU)],
       note="PDF do Ministério da Saúde datado de 14.10.2024 (compilação, não o Държавен вестник): pode haver alterações posteriores.")
LIU = "https://www.gesetze.li/konso/2008030000"
sector("LI", "gesg", "Gesundheitsgesetz (GesG), LR 811.01", "de", LIU, number="LR 811.01",
       provisions=[("Art. 10", "Behandlung und Beratung der Patienten (Pflichten der Berufsausübungsbewilligten)", H + "LI_gesg.txt", "utf-8", r"Art\. 10 Behandlung und Beratung der Patienten Inhaber einer Berufsausübungsbewilligung sind verpflichtet", "https://www.gesetze.li/konso/pdf/2008030000?version=15"),
                   ("Art. 12 Abs. 1", "Dokumentations- und Auskunftspflicht", H + "LI_gesg.txt", "utf-8", r"Art\. 12 Dokumentations- und Auskunftspflicht 1\) Inhaber einer Berufsausübungsbewilligung sind verpflichtet, Aufzeichnungen über die Beratung oder Behandlung der Patienten zu führen", "https://www.gesetze.li/konso/pdf/2008030000?version=15")],
       note="Versão 15 da consolidação oficial (gesetze.li). A regra da Aufklärung/consentimento e o segredo profissional (Berufsgeheimnis) não foram lidos.")

# --- Leads from secondary sources: NEVER presented as authoritative
def lead(code, id, title, lang, number=None, url=""):
    L.setdefault(code, []).append(dict(id=id, role="implementation", title=title, language=lang, url=url, status="unverified", **({"number": number} if number else {})))


for c in LANG:
    AGE.setdefault(c, dict(value=None, status="unverified", article="não investigado", lawId=None))
    L.setdefault(c, [])

# ---------------------------------------------------------------- write
edpb_t, edpb_h = load("EDPB.html")
cnt = {"verified": 0, "partial": 0, "unverified": 0}
for code in sorted(LANG):
    name, site, token = AUTH[code]
    if token.lower() not in edpb_t.lower():
        sys.exit(f"EDPB token not found for {code}: {token}")
    m = re.search(re.escape(token), edpb_t, re.I)
    auth = dict(name=name, url=site, language="en", status="verified",
                evidence=dict(url=EDPB_URL, retrievedAt=TODAY, sha256=edpb_h, language="en", excerpt=edpb_t[max(0, m.start() - 90): m.end() + 90]))
    a = AGE[code]
    dca = dict(value=a.get("value"), status=a.get("status", "verified" if a.get("file") else "unverified"), article=a["article"], lawId=a.get("lawId"))
    if a.get("file"):
        dca["evidence"] = evidence(a["file"], a["rx"], a["url"], a["lang"], a.get("enc", "utf-8"))
    health = None
    if code in HEALTH:
        provs = []
        for h in HEALTH[code]:
            prov = dict(article=h["article"], lawId=h["lawId"], topic=h["topic"], status="verified",
                        evidence=evidence(h["file"], h["rx"], h["url"], h["lang"], h.get("enc", "utf-8")))
            if code in ("FR", "IE"):
                prov["headingOnly"] = True  # only the heading/index entry was verified; do not show it as provision text
            provs.append(prov)
        health = dict(provisions=provs)
    prof = dict(code=code, name=N[code], region=REGION[code], languages=LANG[code], authority=auth, laws=L[code], digitalConsentAge=dca,
                notes=NOTES.get(code, []), lastReviewed=TODAY)
    if health: prof["health"] = health
    if code in SECTOR: prof["sectorHealth"] = SECTOR[code]
    (OUT / f"{code}.json").write_text(json.dumps(prof, ensure_ascii=False, indent=1), encoding="utf-8")
print("countries:", len(LANG))
