"""Shared helper for the additional UI-label locales. Machine-drafted by the project author:
NOT reviewed by native legal speakers (see data/i18n/_review.json)."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "i18n"
EN = json.loads((OUT / "en.json").read_text(encoding="utf-8"))
CAT_KEYS = ["identification", "contact", "demographic", "financial", "location", "online_identifiers", "images",
            "health", "genetic", "biometric", "racial_ethnic", "political", "religious", "trade_union", "sex_life", "criminal"]
BASE_KEYS = ["gdpr_short", "lbl_article", "title_notice", "intro", "sec_controller", "sec_dpo", "sec_purposes", "sec_categories",
             "sec_special", "sec_recipients", "sec_retention", "sec_transfers", "sec_rights", "sec_authority", "sec_law",
             "sec_withdraw", "sec_guardian", "lbl_required", "lbl_optional", "lbl_notice_ack", "lbl_consent", "lbl_explicit",
             "lbl_basis", "lbl_official_text", "lbl_national", "lbl_show", "lbl_hide", "lbl_guardian_name", "lbl_guardian_rel",
             "lbl_guardian_confirm", "btn_confirm", "btn_cancel", "btn_close", "msg_required", "msg_guardian", "msg_saved",
             "msg_unverified", "msg_ui_fallback", "lbl_authority_site", "lbl_version", "lbl_data", "lbl_none", "lbl_unchecked_hint"]


def write(lang, base: list, cats: list):
    """base: values in BASE_KEYS order; cats: values in CAT_KEYS order."""
    assert len(base) == len(BASE_KEYS), (lang, len(base), len(BASE_KEYS))
    assert len(cats) == len(CAT_KEYS), (lang, len(cats))
    d = dict(zip(BASE_KEYS, base))
    d.update({"cat_" + k: v for k, v in zip(CAT_KEYS, cats)})
    assert set(d) == set(EN), (lang, set(d) ^ set(EN))
    assert "{controller}" in d["intro"] and "{country}" in d["intro"], lang
    (OUT / f"{lang}.json").write_text(json.dumps(dict(sorted(d.items())), ensure_ascii=False, indent=1), encoding="utf-8")
    print(lang, "ok")
