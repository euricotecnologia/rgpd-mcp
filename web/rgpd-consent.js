/*!
 * <rgpd-consent-modal> — framework-agnostic GDPR consent dialog (Web Component, no dependencies).
 *
 * Usage (any stack that can show a web page: React, Angular, Vue, plain HTML, Java/JavaFX WebView,
 * Delphi TWebBrowser/CEF, Go/Rust templates, WebView2, Android/iOS WebView):
 *
 *   <script src="http://127.0.0.1:7433/widget/rgpd-consent.js"></script>
 *   <rgpd-consent-modal api-base="http://127.0.0.1:7433" document-id="..." subject-ref="p-8f3a"
 *                       parent-origin="https://app.example.com"></rgpd-consent-modal>
 *
 * Attributes
 *   api-base       base URL of the rgpd-mcp HTTP API (required unless `doc` property is set)
 *   document-id    id returned by POST /v1/consent-documents
 *   subject-ref    opaque pseudonymous id of the data subject (never a name / e-mail)
 *   channel        free label for the recording channel (optional)
 *   parent-origin  exact origin that receives window.parent.postMessage (iframe mode). If absent, no postMessage.
 *   capture-token  short-lived token returned by POST /v1/consent-documents ("capture": {...}); lets a browser/WebView
 *                  record the decision without holding the server API key
 *   open           when present the dialog opens as soon as the document is loaded
 *   mode           "manage" shows the patient's current consents with a one-click withdraw (Art. 7(3)); needs a capture-token for that document+subject
 *
 * Events (bubble, composed):  rgpd:ready  rgpd:decision {record}  rgpd:cancel  rgpd:error {message}  rgpd:withdrawn {itemIds}  rgpd:closed
 * Bridges for non-browser hosts (called with a JSON string):
 *   window.rgpdConsentBridge.onDecision(json) / .onCancel() / .onError(json)
 *   window.chrome.webview.postMessage(json)       (WebView2)
 *   window.webkit.messageHandlers.rgpd.postMessage(obj)  (WKWebView)
 */
(function () {
  "use strict";
  if (customElements.get("rgpd-consent-modal")) return;

  var CSS = [
    ":host{all:initial;font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--fg);",
    "--bg:#fff;--fg:#14181f;--muted:#4b5563;--line:#d5dae1;--accent:#0b57d0;--accent-fg:#fff;--warn:#7a4b00;--warn-bg:#fff4dc;--err:#b3261e}",
    "@media (prefers-color-scheme:dark){:host{--bg:#181b22;--fg:#eceff4;--muted:#aab2bf;--line:#363c48;--accent:#8ab4f8;--accent-fg:#0b1220;--warn:#ffd68a;--warn-bg:#3a2d12;--err:#f2b8b5}}",
    "dialog{border:1px solid var(--line);border-radius:12px;padding:0;max-width:min(760px,calc(100vw - 24px));width:100%;max-height:calc(100vh - 24px);background:var(--bg);color:var(--fg);box-shadow:0 12px 48px rgba(0,0,0,.35)}",
    "dialog::backdrop{background:rgba(10,14,22,.62)}",
    ".wrap{display:flex;flex-direction:column;max-height:calc(100vh - 24px)}",
    "header{padding:18px 22px 10px;border-bottom:1px solid var(--line)}",
    "h2{margin:0;font-size:1.25rem;line-height:1.3}",
    "header p{margin:6px 0 0;color:var(--muted)}",
    ".body{overflow:auto;padding:12px 22px;flex:1}",
    "details{border:1px solid var(--line);border-radius:8px;margin:8px 0;background:transparent}",
    "details>summary{cursor:pointer;padding:10px 12px;font-weight:600;min-height:24px}",
    "details>div{padding:0 12px 10px}",
    "details details{margin:6px 0}details details>summary{font-weight:500;font-size:.95rem}",
    ".law{white-space:pre-wrap;font-size:.92rem;color:var(--fg)}",
    ".law p{margin:.35em 0}",
    ".src{font-size:.8rem;color:var(--muted);word-break:break-all}",
    ".tag{display:inline-block;font-size:.75rem;border:1px solid var(--line);border-radius:999px;padding:0 8px;margin-left:6px;color:var(--muted)}",
    ".warn{background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:8px 12px;margin:8px 0;font-size:.9rem}",
    "footer{border-top:1px solid var(--line);padding:14px 22px;background:var(--bg)}",
    ".item{display:flex;gap:10px;align-items:flex-start;margin:10px 0;padding:8px;border-radius:8px}",
    ".item input[type=checkbox]{width:22px;height:22px;margin-top:2px;flex:none}",
    ".item label{cursor:pointer}",
    ".req{color:var(--muted);font-size:.8rem}",
    ".hint{color:var(--muted);font-size:.85rem;margin:4px 0 8px}",
    ".field{display:block;margin:8px 0}.field span{display:block;font-size:.9rem;margin-bottom:2px}",
    ".field input{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);font:inherit}",
    ".err{color:var(--err);min-height:1.4em;margin:6px 0;font-weight:600}",
    ".actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}",
    "button{font:inherit;min-height:44px;padding:0 18px;border-radius:8px;border:1px solid var(--accent);cursor:pointer}",
    "button.primary{background:var(--accent);color:var(--accent-fg)}",
    "button.secondary{background:transparent;color:var(--accent)}",
    "button:focus-visible,summary:focus-visible,input:focus-visible{outline:3px solid var(--accent);outline-offset:2px}",
    "@media (max-width:520px){header,.body,footer{padding-left:14px;padding-right:14px}.actions button{flex:1}}",
    "@media (prefers-reduced-motion:no-preference){dialog[open]{animation:in .15s ease-out}@keyframes in{from{opacity:0;transform:translateY(8px)}}}",
  ].join("");

  function el(tag, props, children) {
    var n = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === "text") n.textContent = props[k];
      else if (k === "class") n.className = props[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    }
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function emit(host, name, detail) {
    host.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true, composed: true }));
  }

  function bridge(host, kind, payload) {
    var json = JSON.stringify({ source: "rgpd-mcp", type: kind, payload: payload });
    try {
      var b = window.rgpdConsentBridge;
      if (b) {
        var fn = { decision: "onDecision", cancel: "onCancel", error: "onError", withdrawn: "onWithdrawn" }[kind];
        if (fn && b[fn]) b[fn](json);
      }
      if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage) window.chrome.webview.postMessage(json);
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.rgpd) window.webkit.messageHandlers.rgpd.postMessage(JSON.parse(json));
      var po = host.getAttribute("parent-origin");
      if (po && window.parent && window.parent !== window) window.parent.postMessage(JSON.parse(json), po);
    } catch (e) { /* bridges are best-effort */ }
  }

  function sectionEl(s, open) {
    var det = el("details", open ? { open: "" } : null);
    det.appendChild(el("summary", { text: s.heading }));
    var inner = el("div");
    (s.paragraphs || []).forEach(function (p) { inner.appendChild(el("p", { text: p })); });
    (s.legalRefs || []).forEach(function (r) {
      var rd = el("details");
      var sum = el("summary", { text: r.citation + (r.title && r.instrument === "GDPR" ? " \u2014 " + r.title : "") });
      if (r.verification && r.verification !== "verified") sum.appendChild(el("span", { class: "tag", text: r.verification }));
      rd.appendChild(sum);
      var c = el("div", { class: "law", lang: r.language });
      (r.text || []).forEach(function (t) { c.appendChild(el("p", { text: t })); });
      if (r.source) {
        var a = el("a", { href: r.source, target: "_blank", rel: "noopener noreferrer", text: r.source });
        c.appendChild(el("div", { class: "src" }, [a]));
      }
      rd.appendChild(c);
      inner.appendChild(rd);
    });
    det.appendChild(inner);
    return det;
  }

  class RgpdConsentModal extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._doc = null;
    }
    get doc() { return this._doc; }
    set doc(v) { this._doc = v; this._render(); }

    connectedCallback() {
      if (this._doc) return this._render();
      var base = (this.getAttribute("api-base") || "").replace(/\/$/, "");
      var id = this.getAttribute("document-id");
      if (!base || !id) return;
      var self = this;
      var headers = {};
      var key = this.getAttribute("api-key");
      if (key) headers["Authorization"] = "Bearer " + key;
      fetch(base + "/v1/consent-documents/" + encodeURIComponent(id), { headers: headers })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (d) { self.doc = d; })
        .catch(function (e) { emit(self, "rgpd:error", { message: String(e.message || e) }); bridge(self, "error", { message: String(e.message || e) }); });
    }

    open() { if (this._dlg && !this._dlg.open) this._dlg.showModal(); }
    close() { if (this._dlg && this._dlg.open) this._dlg.close(); }

    _headers() {
      var h = {};
      var ct = this.getAttribute("capture-token");
      if (ct) h["X-Capture-Token"] = ct;
      var key = this.getAttribute("api-key");
      if (key) h["Authorization"] = "Bearer " + key;
      return h;
    }

    /** Art. 7(3): withdrawing must be as easy as giving. One click per consent, no extra confirmation screens. */
    _renderManage() {
      var d = this._doc, self = this, S = d.strings || {};
      var base = (this.getAttribute("api-base") || "").replace(/\/$/, "");
      var subject = this.getAttribute("subject-ref") || "";
      var root = this.shadowRoot;
      root.textContent = "";
      root.appendChild(el("style", { text: CSS }));
      var dlg = el("dialog", { "aria-labelledby": "ttl" });
      this._dlg = dlg;
      var err = el("div", { class: "err", role: "alert", "aria-live": "assertive" });
      var ok = el("div", { class: "hint", role: "status", "aria-live": "polite" });
      var list = el("div");
      var body = el("div", { class: "body" }, [list]);
      var head = el("header", null, [el("h2", { id: "ttl", text: S.title_manage || "" }), el("p", { text: S.intro_manage || "" })]);
      (d.sections || []).filter(function (s) { return s.id === "withdraw"; }).forEach(function (s) { body.appendChild(sectionEl(s, true)); });
      var btnClose = el("button", { type: "button", class: "secondary", text: S.btn_close || "Close" });
      var foot = el("footer", null, [ok, err, el("div", { class: "actions" }, [btnClose])]);
      btnClose.addEventListener("click", function () { dlg.close("close"); });
      dlg.addEventListener("close", function () { emit(self, "rgpd:closed", {}); bridge(self, "closed", {}); });
      dlg.appendChild(el("div", { class: "wrap" }, [head, body, foot]));
      root.appendChild(dlg);

      function paint(items) {
        list.textContent = "";
        items.forEach(function (it) {
          var state = el("span", { class: "req", text: it.granted ? S.lbl_granted : S.lbl_not_granted });
          var row = el("div", { class: "item" }, [el("div", { style: "flex:1" }, [document.createTextNode(it.label + " "), state])]);
          if (it.granted) {
            var b = el("button", { type: "button", class: "primary", text: S.btn_withdraw || "Withdraw" });
            b.addEventListener("click", function () {
              err.textContent = ""; ok.textContent = ""; b.disabled = true;
              fetch(base + "/v1/consents/withdraw", {
                method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, self._headers()),
                body: JSON.stringify({ documentId: d.documentId, subjectRef: subject, itemIds: [it.itemId], channel: self.getAttribute("channel") || undefined }),
              }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
                .then(function () {
                  it.granted = false; paint(items); ok.textContent = S.msg_withdrawn || "";
                  emit(self, "rgpd:withdrawn", { documentId: d.documentId, itemIds: [it.itemId] });
                  bridge(self, "withdrawn", { documentId: d.documentId, itemIds: [it.itemId] });
                })
                .catch(function (e) { b.disabled = false; err.textContent = String(e.message || e); emit(self, "rgpd:error", { message: String(e.message || e) }); });
            });
            row.appendChild(b);
          }
          list.appendChild(row);
        });
      }
      fetch(base + "/v1/consents/status?subjectRef=" + encodeURIComponent(subject) + "&documentId=" + encodeURIComponent(d.documentId), { headers: this._headers() })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
        .then(function (j) { paint(j.items); emit(self, "rgpd:ready", { documentId: d.documentId }); if (self.hasAttribute("open")) self.open(); })
        .catch(function (e) { err.textContent = String(e.message || e); emit(self, "rgpd:error", { message: String(e.message || e) }); bridge(self, "error", { message: String(e.message || e) }); if (self.hasAttribute("open")) self.open(); });
    }

    _render() {
      var d = this._doc;
      if (!d) return;
      if (this.getAttribute("mode") === "manage") return this._renderManage();
      var self = this;
      var S = d.strings || {};
      var root = this.shadowRoot;
      root.textContent = "";
      root.appendChild(el("style", { text: CSS }));

      var dlg = el("dialog", { "aria-labelledby": "ttl", "aria-describedby": "intro" });
      this._dlg = dlg;
      var err = el("div", { class: "err", role: "alert", "aria-live": "assertive" });

      var head = el("header", null, [el("h2", { id: "ttl", text: d.title }), el("p", { id: "intro", text: d.intro })]);
      var body = el("div", { class: "body" });

      (d.issues || []).forEach(function (i) {
        if (i.code === "UI_FALLBACK" || i.code.indexOf("COUNTRY_DATA_") === 0) body.appendChild(el("div", { class: "warn", text: i.message }));
      });

      (d.sections || []).forEach(function (s, idx) { body.appendChild(sectionEl(s, idx < 3)); });

      var foot = el("footer");
      foot.appendChild(el("div", { class: "hint", text: S.lbl_unchecked_hint || "" }));
      var boxes = {};
      (d.items || []).forEach(function (it) {
        var id = "i_" + it.id.replace(/[^a-z0-9_-]/gi, "_");
        var cb = el("input", { type: "checkbox", id: id });
        boxes[it.id] = cb;
        var lab = el("label", { for: id }, [document.createTextNode(it.label + " ")]);
        lab.appendChild(el("span", { class: "req", text: "(" + (it.required ? S.lbl_required : S.lbl_optional) + ")" }));
        foot.appendChild(el("div", { class: "item" }, [cb, lab]));
      });

      var gName, gRel, gConf;
      if (d.guardian && d.guardian.required) {
        gName = el("input", { type: "text", autocomplete: "off", maxlength: "200" });
        gRel = el("input", { type: "text", autocomplete: "off", maxlength: "100" });
        gConf = el("input", { type: "checkbox", id: "gconf" });
        foot.appendChild(el("h3", { text: S.sec_guardian || "" }));
        foot.appendChild(el("label", { class: "field" }, [el("span", { text: S.lbl_guardian_name }), gName]));
        foot.appendChild(el("label", { class: "field" }, [el("span", { text: S.lbl_guardian_rel }), gRel]));
        foot.appendChild(el("div", { class: "item" }, [gConf, el("label", { for: "gconf", text: S.lbl_guardian_confirm })]));
      }

      foot.appendChild(err);
      var btnCancel = el("button", { type: "button", class: "secondary", text: S.btn_cancel || "Cancel" });
      var btnOk = el("button", { type: "button", class: "primary", text: S.btn_confirm || "Confirm" });
      foot.appendChild(el("div", { class: "actions" }, [btnCancel, btnOk]));

      btnCancel.addEventListener("click", function () { dlg.close("cancel"); });
      dlg.addEventListener("cancel", function () { /* ESC = cancel, nothing is recorded */ });
      dlg.addEventListener("close", function () {
        if (dlg.returnValue !== "ok") { emit(self, "rgpd:cancel", {}); bridge(self, "cancel", {}); }
      });

      btnOk.addEventListener("click", function () {
        err.textContent = "";
        var missing = (d.items || []).filter(function (it) { return it.required && !boxes[it.id].checked; });
        if (missing.length) { err.textContent = S.msg_required || "Required"; boxes[missing[0].id].focus(); return; }
        var decisions = (d.items || []).map(function (it) { return { itemId: it.id, granted: boxes[it.id].checked }; });
        var anyConsent = (d.items || []).some(function (it) { return it.kind !== "notice_ack" && boxes[it.id].checked; });
        var guardian;
        if (d.guardian && d.guardian.required && anyConsent) {
          if (!gName.value.trim() || !gRel.value.trim() || !gConf.checked) { err.textContent = S.msg_guardian || ""; gName.focus(); return; }
          guardian = { name: gName.value.trim(), relationship: gRel.value.trim(), confirmed: true };
        }
        var base = (self.getAttribute("api-base") || "").replace(/\/$/, "");
        var subject = self.getAttribute("subject-ref");
        var finish = function (record) {
          var detail = { documentId: d.documentId, documentHash: d.documentHash, decisions: decisions, guardian: guardian, record: record || null };
          btnOk.disabled = true;
          dlg.close("ok");
          emit(self, "rgpd:decision", detail);
          bridge(self, "decision", detail);
        };
        if (base && subject) {
          var headers = { "Content-Type": "application/json" };
          var ct = self.getAttribute("capture-token");
          if (ct) headers["X-Capture-Token"] = ct;
          var key = self.getAttribute("api-key");
          if (key) headers["Authorization"] = "Bearer " + key;
          btnOk.disabled = true;
          fetch(base + "/v1/consents", {
            method: "POST", headers: headers,
            body: JSON.stringify({ documentId: d.documentId, subjectRef: subject, decisions: decisions, guardian: guardian, channel: self.getAttribute("channel") || undefined }),
          }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
            .then(function (rec) { finish(rec); })
            .catch(function (e) { btnOk.disabled = false; err.textContent = String(e.message || e); emit(self, "rgpd:error", { message: String(e.message || e) }); bridge(self, "error", { message: String(e.message || e) }); });
        } else finish(null);
      });

      dlg.appendChild(el("div", { class: "wrap" }, [head, body, foot]));
      root.appendChild(dlg);
      emit(this, "rgpd:ready", { documentId: d.documentId });
      if (this.hasAttribute("open")) this.open();
    }
  }
  customElements.define("rgpd-consent-modal", RgpdConsentModal);
})();
