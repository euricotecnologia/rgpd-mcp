/* Bootstraps /modal/<documentId> pages (iframe / WebView mode).
 * Parameters are read from the URL *fragment* (never sent to servers or written to access logs):
 *   #subjectRef=...&token=<captureToken>&channel=...&parentOrigin=https://app.example.com */
(function () {
  var s = document.currentScript;
  var q = new URLSearchParams(location.hash.replace(/^#/, ""));
  var m = document.createElement("rgpd-consent-modal");
  m.setAttribute("api-base", location.origin);
  m.setAttribute("document-id", s.getAttribute("data-document-id"));
  if (s.getAttribute("data-mode") === "manage") m.setAttribute("mode", "manage");
  ["subjectRef:subject-ref", "channel:channel", "parentOrigin:parent-origin", "token:capture-token"].forEach(function (p) {
    var a = p.split(":");
    if (q.get(a[0])) m.setAttribute(a[1], q.get(a[0]));
  });
  m.setAttribute("open", "");
  document.body.appendChild(m);
})();
