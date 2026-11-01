"""Adds the 'manage / withdraw consent' labels to every UI locale. Run AFTER build_i18n.py, i18n_more_a.py, i18n_more_b.py.
Machine-drafted, not reviewed by native speakers (see data/i18n/_review.json). intro_manage is deliberately neutral:
the legal statement about withdrawal is shown from the official Art. 7 text, not from these strings."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "i18n"
KEYS = ["title_manage", "intro_manage", "lbl_granted", "lbl_not_granted", "btn_withdraw", "msg_withdrawn"]
T = {
    "en": ["Manage my consents", "Your current choices:", "Consent given", "No consent", "Withdraw consent", "Consent withdrawn."],
    "pt": ["Gerir os meus consentimentos", "As suas escolhas atuais:", "Consentimento dado", "Sem consentimento", "Retirar consentimento", "Consentimento retirado."],
    "es": ["Gestionar mis consentimientos", "Sus elecciones actuales:", "Consentimiento otorgado", "Sin consentimiento", "Retirar consentimiento", "Consentimiento retirado."],
    "fr": ["Gérer mes consentements", "Vos choix actuels :", "Consentement donné", "Pas de consentement", "Retirer le consentement", "Consentement retiré."],
    "de": ["Meine Einwilligungen verwalten", "Ihre aktuellen Entscheidungen:", "Einwilligung erteilt", "Keine Einwilligung", "Einwilligung widerrufen", "Einwilligung widerrufen."],
    "it": ["Gestisci i miei consensi", "Le tue scelte attuali:", "Consenso prestato", "Nessun consenso", "Revoca il consenso", "Consenso revocato."],
    "nl": ["Mijn toestemmingen beheren", "Uw huidige keuzes:", "Toestemming gegeven", "Geen toestemming", "Toestemming intrekken", "Toestemming ingetrokken."],
    "bg": ["Управление на съгласията ми", "Вашите текущи избори:", "Дадено съгласие", "Няма съгласие", "Оттегляне на съгласието", "Съгласието е оттеглено."],
    "cs": ["Správa mých souhlasů", "Vaše aktuální volby:", "Souhlas udělen", "Bez souhlasu", "Odvolat souhlas", "Souhlas byl odvolán."],
    "da": ["Administrer mine samtykker", "Dine nuværende valg:", "Samtykke givet", "Intet samtykke", "Træk samtykke tilbage", "Samtykke trukket tilbage."],
    "el": ["Διαχείριση των συγκαταθέσεών μου", "Οι τρέχουσες επιλογές σας:", "Συγκατάθεση δόθηκε", "Χωρίς συγκατάθεση", "Ανάκληση συγκατάθεσης", "Η συγκατάθεση ανακλήθηκε."],
    "et": ["Halda minu nõusolekuid", "Teie praegused valikud:", "Nõusolek antud", "Nõusolekut pole", "Võta nõusolek tagasi", "Nõusolek on tagasi võetud."],
    "fi": ["Hallitse suostumuksiani", "Nykyiset valintasi:", "Suostumus annettu", "Ei suostumusta", "Peruuta suostumus", "Suostumus peruutettu."],
    "hr": ["Upravljanje mojim privolama", "Vaši trenutačni odabiri:", "Privola dana", "Nema privole", "Povuci privolu", "Privola je povučena."],
    "hu": ["Hozzájárulásaim kezelése", "Jelenlegi választásai:", "Hozzájárulás megadva", "Nincs hozzájárulás", "Hozzájárulás visszavonása", "A hozzájárulás visszavonva."],
    "lt": ["Tvarkyti mano sutikimus", "Dabartiniai jūsų pasirinkimai:", "Sutikimas duotas", "Sutikimo nėra", "Atšaukti sutikimą", "Sutikimas atšauktas."],
    "lv": ["Pārvaldīt manas piekrišanas", "Jūsu pašreizējā izvēle:", "Piekrišana sniegta", "Nav piekrišanas", "Atsaukt piekrišanu", "Piekrišana atsaukta."],
    "mt": ["Immaniġġja l-kunsensi tiegħi", "L-għażliet attwali tiegħek:", "Kunsens mogħti", "L-ebda kunsens", "Irtira l-kunsens", "Il-kunsens ġie rtirat."],
    "pl": ["Zarządzaj moimi zgodami", "Twoje aktualne wybory:", "Zgoda wyrażona", "Brak zgody", "Wycofaj zgodę", "Zgoda została wycofana."],
    "ro": ["Gestionează consimțământurile mele", "Alegerile dumneavoastră actuale:", "Consimțământ dat", "Fără consimțământ", "Retrage consimțământul", "Consimțământul a fost retras."],
    "sk": ["Správa mojich súhlasov", "Vaše aktuálne voľby:", "Súhlas udelený", "Bez súhlasu", "Odvolať súhlas", "Súhlas bol odvolaný."],
    "sl": ["Upravljanje mojih privolitev", "Vaše trenutne izbire:", "Privolitev dana", "Brez privolitve", "Prekliči privolitev", "Privolitev je preklicana."],
    "sv": ["Hantera mina samtycken", "Dina nuvarande val:", "Samtycke lämnat", "Inget samtycke", "Återkalla samtycke", "Samtycket har återkallats."],
    "no": ["Administrer samtykkene mine", "Dine nåværende valg:", "Samtykke gitt", "Ikke samtykke", "Trekk tilbake samtykke", "Samtykket er trukket tilbake."],
    "is": ["Stjórna samþykkjum mínum", "Núverandi val þitt:", "Samþykki veitt", "Ekkert samþykki", "Afturkalla samþykki", "Samþykki afturkallað."],
}
files = sorted(p.stem for p in OUT.glob("??.json"))
assert set(files) == set(T), set(files) ^ set(T)
for lang, vals in T.items():
    assert len(vals) == len(KEYS)
    f = OUT / f"{lang}.json"
    d = json.loads(f.read_text(encoding="utf-8"))
    d.update(dict(zip(KEYS, vals)))
    f.write_text(json.dumps(dict(sorted(d.items())), ensure_ascii=False, indent=1), encoding="utf-8")
print("ok", len(T), "locales")
