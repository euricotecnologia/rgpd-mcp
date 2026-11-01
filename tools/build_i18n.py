#!/usr/bin/env python3
"""Generates data/i18n/<lang>.json: UI *labels* only.
Every legal statement shown to the user is quoted from the official GDPR text (data/gdpr);
these strings are never used to state what the law says. Locales other than en are
labelled by `_review` in README until a native legal reviewer signs them off."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "i18n"
L = {}

L["en"] = dict(
    gdpr_short="GDPR", lbl_article="Article",
    title_notice="Personal data protection notice and consent",
    intro="Before continuing, please read how {controller} processes your personal data under Regulation (EU) 2016/679 and the law of {country}.",
    sec_controller="Controller", sec_dpo="Data Protection Officer", sec_purposes="Purposes and legal basis",
    sec_categories="Categories of personal data", sec_special="Special categories of personal data",
    sec_recipients="Recipients", sec_retention="Retention period", sec_transfers="Transfers outside the EU/EEA",
    sec_rights="Your rights", sec_authority="Supervisory authority", sec_law="Legal framework",
    sec_withdraw="Withdrawal of consent", sec_guardian="Holder of parental responsibility / legal representative",
    lbl_required="Required", lbl_optional="Optional", lbl_notice_ack="I have read and understood this information",
    lbl_consent="I consent", lbl_explicit="I give my explicit consent", lbl_basis="Legal basis",
    lbl_official_text="Official text", lbl_national="National law", lbl_show="Show text", lbl_hide="Hide text",
    lbl_guardian_name="Full name of the holder of parental responsibility / legal representative",
    lbl_guardian_rel="Relationship to the data subject",
    lbl_guardian_confirm="I confirm that I am the holder of parental responsibility or the legal representative",
    btn_confirm="Confirm my choices", btn_cancel="Cancel", btn_close="Close",
    msg_required="Please acknowledge the required item to continue.",
    msg_guardian="Please complete the guardian details.", msg_saved="Your choices have been recorded.",
    msg_unverified="Notice: the national-law data for this country is not fully verified yet. Only the official EU text below is presented as authoritative.",
    msg_ui_fallback="This interface is not yet available in the legal language of this country; labels are shown in English. The legal texts remain in the official language.",
    lbl_authority_site="Website", lbl_version="Version", lbl_data="Data", lbl_none="None",
    lbl_unchecked_hint="Optional items are unticked by default. Not ticking an item means you refuse it.",
)

L["pt"] = dict(
    gdpr_short="RGPD", lbl_article="Artigo",
    title_notice="Informação sobre proteção de dados pessoais e consentimento",
    intro="Antes de continuar, leia como {controller} trata os seus dados pessoais ao abrigo do Regulamento (UE) 2016/679 e da lei de {country}.",
    sec_controller="Responsável pelo tratamento", sec_dpo="Encarregado da proteção de dados",
    sec_purposes="Finalidades e fundamento jurídico", sec_categories="Categorias de dados pessoais",
    sec_special="Categorias especiais de dados pessoais", sec_recipients="Destinatários",
    sec_retention="Prazo de conservação", sec_transfers="Transferências para fora da UE/EEE",
    sec_rights="Os seus direitos", sec_authority="Autoridade de controlo", sec_law="Enquadramento legal",
    sec_withdraw="Retirada do consentimento", sec_guardian="Titular das responsabilidades parentais / representante legal",
    lbl_required="Obrigatório", lbl_optional="Facultativo", lbl_notice_ack="Li e compreendi esta informação",
    lbl_consent="Dou o meu consentimento", lbl_explicit="Dou o meu consentimento explícito",
    lbl_basis="Fundamento jurídico", lbl_official_text="Texto oficial", lbl_national="Lei nacional",
    lbl_show="Mostrar texto", lbl_hide="Ocultar texto",
    lbl_guardian_name="Nome completo do titular das responsabilidades parentais / representante legal",
    lbl_guardian_rel="Relação com o titular dos dados",
    lbl_guardian_confirm="Confirmo que sou o titular das responsabilidades parentais ou o representante legal",
    btn_confirm="Confirmar as minhas escolhas", btn_cancel="Cancelar", btn_close="Fechar",
    msg_required="Confirme o item obrigatório para continuar.",
    msg_guardian="Preencha os dados do representante.", msg_saved="As suas escolhas foram registadas.",
    msg_unverified="Aviso: os dados da lei nacional deste país ainda não estão totalmente verificados. Apenas o texto oficial da UE abaixo é apresentado como autoritativo.",
    msg_ui_fallback="Esta interface ainda não está disponível na língua jurídica deste país; os rótulos são apresentados em inglês. Os textos legais mantêm-se na língua oficial.",
    lbl_authority_site="Sítio na Internet", lbl_version="Versão", lbl_data="Dados", lbl_none="Nenhuma",
    lbl_unchecked_hint="Os itens facultativos vêm por assinalar. Não assinalar um item significa recusá-lo.",
)

L["es"] = dict(
    gdpr_short="RGPD", lbl_article="Artículo",
    title_notice="Información sobre protección de datos personales y consentimiento",
    intro="Antes de continuar, lea cómo {controller} trata sus datos personales conforme al Reglamento (UE) 2016/679 y a la legislación de {country}.",
    sec_controller="Responsable del tratamiento", sec_dpo="Delegado de protección de datos",
    sec_purposes="Finalidades y base jurídica", sec_categories="Categorías de datos personales",
    sec_special="Categorías especiales de datos personales", sec_recipients="Destinatarios",
    sec_retention="Plazo de conservación", sec_transfers="Transferencias fuera de la UE/EEE",
    sec_rights="Sus derechos", sec_authority="Autoridad de control", sec_law="Marco jurídico",
    sec_withdraw="Retirada del consentimiento", sec_guardian="Titular de la patria potestad / representante legal",
    lbl_required="Obligatorio", lbl_optional="Opcional", lbl_notice_ack="He leído y comprendido esta información",
    lbl_consent="Doy mi consentimiento", lbl_explicit="Doy mi consentimiento explícito",
    lbl_basis="Base jurídica", lbl_official_text="Texto oficial", lbl_national="Legislación nacional",
    lbl_show="Mostrar texto", lbl_hide="Ocultar texto",
    lbl_guardian_name="Nombre completo del titular de la patria potestad / representante legal",
    lbl_guardian_rel="Relación con el interesado",
    lbl_guardian_confirm="Confirmo que soy el titular de la patria potestad o el representante legal",
    btn_confirm="Confirmar mis elecciones", btn_cancel="Cancelar", btn_close="Cerrar",
    msg_required="Confirme el elemento obligatorio para continuar.",
    msg_guardian="Complete los datos del representante.", msg_saved="Sus elecciones han sido registradas.",
    msg_unverified="Aviso: los datos de la legislación nacional de este país aún no están totalmente verificados. Solo el texto oficial de la UE que figura a continuación se presenta como autorizado.",
    msg_ui_fallback="Esta interfaz aún no está disponible en la lengua jurídica de este país; las etiquetas se muestran en inglés. Los textos legales se mantienen en la lengua oficial.",
    lbl_authority_site="Sitio web", lbl_version="Versión", lbl_data="Datos", lbl_none="Ninguna",
    lbl_unchecked_hint="Los elementos opcionales aparecen sin marcar. No marcar un elemento significa rechazarlo.",
)

L["fr"] = dict(
    gdpr_short="RGPD", lbl_article="Article",
    title_notice="Information sur la protection des données personnelles et consentement",
    intro="Avant de continuer, veuillez lire comment {controller} traite vos données personnelles conformément au règlement (UE) 2016/679 et à la législation de {country}.",
    sec_controller="Responsable du traitement", sec_dpo="Délégué à la protection des données",
    sec_purposes="Finalités et base juridique", sec_categories="Catégories de données personnelles",
    sec_special="Catégories particulières de données personnelles", sec_recipients="Destinataires",
    sec_retention="Durée de conservation", sec_transfers="Transferts hors UE/EEE",
    sec_rights="Vos droits", sec_authority="Autorité de contrôle", sec_law="Cadre juridique",
    sec_withdraw="Retrait du consentement", sec_guardian="Titulaire de l'autorité parentale / représentant légal",
    lbl_required="Obligatoire", lbl_optional="Facultatif", lbl_notice_ack="J'ai lu et compris ces informations",
    lbl_consent="Je consens", lbl_explicit="Je donne mon consentement explicite",
    lbl_basis="Base juridique", lbl_official_text="Texte officiel", lbl_national="Droit national",
    lbl_show="Afficher le texte", lbl_hide="Masquer le texte",
    lbl_guardian_name="Nom complet du titulaire de l'autorité parentale / représentant légal",
    lbl_guardian_rel="Lien avec la personne concernée",
    lbl_guardian_confirm="Je confirme être le titulaire de l'autorité parentale ou le représentant légal",
    btn_confirm="Confirmer mes choix", btn_cancel="Annuler", btn_close="Fermer",
    msg_required="Veuillez confirmer l'élément obligatoire pour continuer.",
    msg_guardian="Veuillez renseigner les informations du représentant.", msg_saved="Vos choix ont été enregistrés.",
    msg_unverified="Avis : les données du droit national de ce pays ne sont pas encore entièrement vérifiées. Seul le texte officiel de l'UE ci-dessous est présenté comme faisant foi.",
    msg_ui_fallback="Cette interface n'est pas encore disponible dans la langue juridique de ce pays ; les libellés sont affichés en anglais. Les textes juridiques restent dans la langue officielle.",
    lbl_authority_site="Site web", lbl_version="Version", lbl_data="Données", lbl_none="Aucune",
    lbl_unchecked_hint="Les éléments facultatifs sont décochés par défaut. Ne pas cocher un élément signifie le refuser.",
)

L["de"] = dict(
    gdpr_short="DSGVO", lbl_article="Artikel",
    title_notice="Information zum Schutz personenbezogener Daten und Einwilligung",
    intro="Bitte lesen Sie vor dem Fortfahren, wie {controller} Ihre personenbezogenen Daten gemäß der Verordnung (EU) 2016/679 und dem Recht von {country} verarbeitet.",
    sec_controller="Verantwortlicher", sec_dpo="Datenschutzbeauftragter",
    sec_purposes="Zwecke und Rechtsgrundlage", sec_categories="Kategorien personenbezogener Daten",
    sec_special="Besondere Kategorien personenbezogener Daten", sec_recipients="Empfänger",
    sec_retention="Speicherdauer", sec_transfers="Übermittlungen außerhalb der EU/des EWR",
    sec_rights="Ihre Rechte", sec_authority="Aufsichtsbehörde", sec_law="Rechtsrahmen",
    sec_withdraw="Widerruf der Einwilligung", sec_guardian="Träger der elterlichen Verantwortung / gesetzlicher Vertreter",
    lbl_required="Erforderlich", lbl_optional="Freiwillig", lbl_notice_ack="Ich habe diese Informationen gelesen und verstanden",
    lbl_consent="Ich willige ein", lbl_explicit="Ich willige ausdrücklich ein",
    lbl_basis="Rechtsgrundlage", lbl_official_text="Amtlicher Text", lbl_national="Nationales Recht",
    lbl_show="Text anzeigen", lbl_hide="Text ausblenden",
    lbl_guardian_name="Vollständiger Name des Trägers der elterlichen Verantwortung / gesetzlichen Vertreters",
    lbl_guardian_rel="Beziehung zur betroffenen Person",
    lbl_guardian_confirm="Ich bestätige, dass ich Träger der elterlichen Verantwortung oder gesetzlicher Vertreter bin",
    btn_confirm="Meine Auswahl bestätigen", btn_cancel="Abbrechen", btn_close="Schließen",
    msg_required="Bitte bestätigen Sie den erforderlichen Punkt, um fortzufahren.",
    msg_guardian="Bitte füllen Sie die Angaben zum Vertreter aus.", msg_saved="Ihre Auswahl wurde gespeichert.",
    msg_unverified="Hinweis: Die Daten zum nationalen Recht dieses Landes sind noch nicht vollständig geprüft. Nur der nachstehende amtliche EU-Text wird als maßgeblich dargestellt.",
    msg_ui_fallback="Diese Oberfläche ist in der Rechtssprache dieses Landes noch nicht verfügbar; die Bezeichnungen werden auf Englisch angezeigt. Die Rechtstexte bleiben in der Amtssprache.",
    lbl_authority_site="Website", lbl_version="Version", lbl_data="Daten", lbl_none="Keine",
    lbl_unchecked_hint="Freiwillige Punkte sind standardmäßig nicht angekreuzt. Ein nicht angekreuzter Punkt bedeutet Ablehnung.",
)

L["it"] = dict(
    gdpr_short="GDPR", lbl_article="Articolo",
    title_notice="Informativa sulla protezione dei dati personali e consenso",
    intro="Prima di proseguire, leggi come {controller} tratta i tuoi dati personali ai sensi del regolamento (UE) 2016/679 e della normativa di {country}.",
    sec_controller="Titolare del trattamento", sec_dpo="Responsabile della protezione dei dati",
    sec_purposes="Finalità e base giuridica", sec_categories="Categorie di dati personali",
    sec_special="Categorie particolari di dati personali", sec_recipients="Destinatari",
    sec_retention="Periodo di conservazione", sec_transfers="Trasferimenti fuori dall'UE/SEE",
    sec_rights="I tuoi diritti", sec_authority="Autorità di controllo", sec_law="Quadro normativo",
    sec_withdraw="Revoca del consenso", sec_guardian="Titolare della responsabilità genitoriale / rappresentante legale",
    lbl_required="Obbligatorio", lbl_optional="Facoltativo", lbl_notice_ack="Ho letto e compreso queste informazioni",
    lbl_consent="Presto il mio consenso", lbl_explicit="Presto il mio consenso esplicito",
    lbl_basis="Base giuridica", lbl_official_text="Testo ufficiale", lbl_national="Normativa nazionale",
    lbl_show="Mostra il testo", lbl_hide="Nascondi il testo",
    lbl_guardian_name="Nome completo del titolare della responsabilità genitoriale / rappresentante legale",
    lbl_guardian_rel="Rapporto con l'interessato",
    lbl_guardian_confirm="Confermo di essere il titolare della responsabilità genitoriale o il rappresentante legale",
    btn_confirm="Conferma le mie scelte", btn_cancel="Annulla", btn_close="Chiudi",
    msg_required="Conferma la voce obbligatoria per proseguire.",
    msg_guardian="Compila i dati del rappresentante.", msg_saved="Le tue scelte sono state registrate.",
    msg_unverified="Avviso: i dati della normativa nazionale di questo paese non sono ancora del tutto verificati. Solo il testo ufficiale dell'UE riportato di seguito è presentato come autorevole.",
    msg_ui_fallback="Questa interfaccia non è ancora disponibile nella lingua giuridica di questo paese; le etichette sono mostrate in inglese. I testi giuridici restano nella lingua ufficiale.",
    lbl_authority_site="Sito web", lbl_version="Versione", lbl_data="Dati", lbl_none="Nessuna",
    lbl_unchecked_hint="Le voci facoltative sono deselezionate per impostazione predefinita. Non selezionare una voce significa rifiutarla.",
)

L["nl"] = dict(
    gdpr_short="AVG", lbl_article="Artikel",
    title_notice="Informatie over de bescherming van persoonsgegevens en toestemming",
    intro="Lees voordat u verdergaat hoe {controller} uw persoonsgegevens verwerkt op grond van Verordening (EU) 2016/679 en het recht van {country}.",
    sec_controller="Verwerkingsverantwoordelijke", sec_dpo="Functionaris voor gegevensbescherming",
    sec_purposes="Doeleinden en rechtsgrond", sec_categories="Categorieën persoonsgegevens",
    sec_special="Bijzondere categorieën persoonsgegevens", sec_recipients="Ontvangers",
    sec_retention="Bewaartermijn", sec_transfers="Doorgiften buiten de EU/EER",
    sec_rights="Uw rechten", sec_authority="Toezichthoudende autoriteit", sec_law="Wettelijk kader",
    sec_withdraw="Intrekking van toestemming", sec_guardian="Houder van het ouderlijk gezag / wettelijk vertegenwoordiger",
    lbl_required="Verplicht", lbl_optional="Optioneel", lbl_notice_ack="Ik heb deze informatie gelezen en begrepen",
    lbl_consent="Ik geef toestemming", lbl_explicit="Ik geef uitdrukkelijk toestemming",
    lbl_basis="Rechtsgrond", lbl_official_text="Officiële tekst", lbl_national="Nationaal recht",
    lbl_show="Tekst tonen", lbl_hide="Tekst verbergen",
    lbl_guardian_name="Volledige naam van de houder van het ouderlijk gezag / wettelijk vertegenwoordiger",
    lbl_guardian_rel="Relatie tot de betrokkene",
    lbl_guardian_confirm="Ik bevestig dat ik houder van het ouderlijk gezag of wettelijk vertegenwoordiger ben",
    btn_confirm="Mijn keuzes bevestigen", btn_cancel="Annuleren", btn_close="Sluiten",
    msg_required="Bevestig het verplichte item om verder te gaan.",
    msg_guardian="Vul de gegevens van de vertegenwoordiger in.", msg_saved="Uw keuzes zijn vastgelegd.",
    msg_unverified="Let op: de gegevens over het nationale recht van dit land zijn nog niet volledig geverifieerd. Alleen de onderstaande officiële EU-tekst wordt als gezaghebbend weergegeven.",
    msg_ui_fallback="Deze interface is nog niet beschikbaar in de juridische taal van dit land; labels worden in het Engels getoond. De juridische teksten blijven in de officiële taal.",
    lbl_authority_site="Website", lbl_version="Versie", lbl_data="Gegevens", lbl_none="Geen",
    lbl_unchecked_hint="Optionele items zijn standaard niet aangevinkt. Een item niet aanvinken betekent het weigeren.",
)

# Data-category labels (UI only; the legal definitions are quoted from Art. 4/9 official text).
CAT_ORDER = ["identification", "contact", "demographic", "financial", "location", "online_identifiers", "images",
             "health", "genetic", "biometric", "racial_ethnic", "political", "religious", "trade_union", "sex_life", "criminal"]
CAT = {
    "en": ["Identification data", "Contact details", "Demographic data", "Financial data", "Location data", "Online identifiers", "Images and video",
           "Data concerning health", "Genetic data", "Biometric data", "Racial or ethnic origin", "Political opinions", "Religious or philosophical beliefs", "Trade union membership", "Data concerning sex life or sexual orientation", "Criminal convictions and offences"],
    "pt": ["Dados de identificação", "Dados de contacto", "Dados demográficos", "Dados financeiros", "Dados de localização", "Identificadores em linha", "Imagens e vídeo",
           "Dados relativos à saúde", "Dados genéticos", "Dados biométricos", "Origem racial ou étnica", "Opiniões políticas", "Convicções religiosas ou filosóficas", "Filiação sindical", "Dados relativos à vida sexual ou orientação sexual", "Condenações penais e infrações"],
    "es": ["Datos de identificación", "Datos de contacto", "Datos demográficos", "Datos financieros", "Datos de localización", "Identificadores en línea", "Imágenes y vídeo",
           "Datos relativos a la salud", "Datos genéticos", "Datos biométricos", "Origen étnico o racial", "Opiniones políticas", "Convicciones religiosas o filosóficas", "Afiliación sindical", "Datos relativos a la vida sexual u orientación sexual", "Condenas e infracciones penales"],
    "fr": ["Données d'identification", "Coordonnées", "Données démographiques", "Données financières", "Données de localisation", "Identifiants en ligne", "Images et vidéo",
           "Données concernant la santé", "Données génétiques", "Données biométriques", "Origine raciale ou ethnique", "Opinions politiques", "Convictions religieuses ou philosophiques", "Appartenance syndicale", "Données concernant la vie sexuelle ou l'orientation sexuelle", "Condamnations pénales et infractions"],
    "de": ["Identifikationsdaten", "Kontaktdaten", "Demografische Daten", "Finanzdaten", "Standortdaten", "Online-Kennungen", "Bilder und Video",
           "Gesundheitsdaten", "Genetische Daten", "Biometrische Daten", "Rassische und ethnische Herkunft", "Politische Meinungen", "Religiöse oder weltanschauliche Überzeugungen", "Gewerkschaftszugehörigkeit", "Daten zum Sexualleben oder zur sexuellen Orientierung", "Strafrechtliche Verurteilungen und Straftaten"],
    "it": ["Dati identificativi", "Dati di contatto", "Dati demografici", "Dati finanziari", "Dati di ubicazione", "Identificativi online", "Immagini e video",
           "Dati relativi alla salute", "Dati genetici", "Dati biometrici", "Origine razziale o etnica", "Opinioni politiche", "Convinzioni religiose o filosofiche", "Appartenenza sindacale", "Dati relativi alla vita sessuale o all'orientamento sessuale", "Condanne penali e reati"],
    "nl": ["Identificatiegegevens", "Contactgegevens", "Demografische gegevens", "Financiële gegevens", "Locatiegegevens", "Online-identificatoren", "Beelden en video",
           "Gegevens over gezondheid", "Genetische gegevens", "Biometrische gegevens", "Ras of etnische afkomst", "Politieke opvattingen", "Religieuze of levensbeschouwelijke overtuigingen", "Lidmaatschap van een vakbond", "Gegevens met betrekking tot seksueel gedrag of seksuele gerichtheid", "Strafrechtelijke veroordelingen en strafbare feiten"],
}
for lang, labels in CAT.items():
    assert len(labels) == len(CAT_ORDER), lang
    for k, lab in zip(CAT_ORDER, labels):
        L[lang]["cat_" + k] = lab

keys = set(L["en"])
for lang, v in L.items():
    assert set(v) == keys, (lang, set(v) ^ keys)
    (OUT / f"{lang}.json").write_text(json.dumps(dict(sorted(v.items())), ensure_ascii=False, indent=1), encoding="utf-8")
print(len(keys), "keys x", len(L), "locales")
