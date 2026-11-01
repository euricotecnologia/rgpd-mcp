/**
 * Integration snippets. The contract is the same for every stack:
 *   1. server-side: POST {base}/v1/consent-documents  (API key)  -> documentId, modalUrl, captureToken
 *   2. client-side: show {base}{modalUrl}#subjectRef=..&token=..  (iframe / WebView / <rgpd-consent-modal>)
 *   3. server-side: GET  {base}/v1/consents?subjectRef=..        (API key)  -> authoritative status
 * Step 3 is the source of truth: never trust the client alone to say consent was given.
 */

export const SNIPPET_LANGUAGES = ["html", "react", "node", "go", "java", "rust", "delphi", "python", "csharp", "php"] as const;
export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number];

const BODY = `{
  "country": "PT",
  "controller": { "name": "Clínica Exemplo, Lda.", "email": "privacidade@exemplo.pt", "dpo": { "email": "dpo@exemplo.pt" } },
  "dataCategories": ["identification", "contact", "health"],
  "purposes": [
    { "id": "care", "label": "Prestação de cuidados de saúde", "legalBasis": "contract", "art9Condition": "health_care", "required": true, "dataCategories": ["identification", "contact", "health"] },
    { "id": "newsletter", "label": "Envio de comunicações informativas", "legalBasis": "consent", "required": false, "dataCategories": ["contact"] }
  ],
  "capture": { "subjectRef": "p-8f3a21" }
}`;

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ");

export function integrationSnippet(lang: SnippetLanguage, baseUrl = "http://127.0.0.1:7433") {
  const B = baseUrl;
  const compact = oneLine(BODY);
  const make = (notes: string, files: { name: string; code: string }[], tested: string) => ({ language: lang, baseUrl: B, notes, tested, files });

  switch (lang) {
    case "html":
      return make(
        "Pure HTML/JS. Build the document on YOUR server (API key must not reach the browser), then pass documentId and captureToken to the page.",
        [{
          name: "index.html",
          code: `<script src="${B}/widget/rgpd-consent.js"></script>
<rgpd-consent-modal id="consent"
  api-base="${B}"
  document-id="DOCUMENT_ID_FROM_YOUR_SERVER"
  capture-token="CAPTURE_TOKEN_FROM_YOUR_SERVER"
  subject-ref="p-8f3a21" open></rgpd-consent-modal>
<script>
  document.getElementById("consent").addEventListener("rgpd:decision", (e) => {
    // e.detail.decisions -> [{itemId, granted}]. Confirm on your server via GET /v1/consents?subjectRef=...
    console.log(e.detail);
  });
</script>`,
        }],
        "widget exercised in a real browser during development; see tests/",
      );
    case "react":
      return make(
        "React 18+. The custom element needs no wrapper library; set `doc` or attributes. Fetch documentId/captureToken from your backend.",
        [{
          name: "ConsentModal.tsx",
          code: `import { useEffect, useRef } from "react";

const BASE = "${B}";
let loaded: Promise<void> | null = null;
function loadWidget() {
  loaded ??= new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = BASE + "/widget/rgpd-consent.js"; s.onload = () => ok(); s.onerror = () => ko(new Error("widget"));
    document.head.appendChild(s);
  });
  return loaded;
}

export function ConsentModal(props: { documentId: string; captureToken: string; subjectRef: string; onDecision: (d: unknown) => void; onCancel?: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let off = () => {};
    loadWidget().then(() => {
      const el = ref.current!;
      const dec = (e: Event) => props.onDecision((e as CustomEvent).detail);
      const can = () => props.onCancel?.();
      el.addEventListener("rgpd:decision", dec); el.addEventListener("rgpd:cancel", can);
      off = () => { el.removeEventListener("rgpd:decision", dec); el.removeEventListener("rgpd:cancel", can); };
    });
    return () => off();
  }, []);
  // @ts-expect-error custom element
  return <rgpd-consent-modal ref={ref} api-base={BASE} document-id={props.documentId} capture-token={props.captureToken} subject-ref={props.subjectRef} open="" />;
}`,
        }],
        "not compiled here (needs a React project)",
      );
    case "node":
      return make(
        "Node 18+ (global fetch). Run on your server.",
        [{
          name: "consent.mjs",
          code: `const BASE = "${B}", KEY = process.env.RGPD_MCP_API_KEY;
const H = { "Content-Type": "application/json", ...(KEY ? { Authorization: "Bearer " + KEY } : {}) };

export async function createConsent() {
  const r = await fetch(BASE + "/v1/consent-documents", { method: "POST", headers: H, body: JSON.stringify(${compact}) });
  if (!r.ok) throw new Error(await r.text());
  const d = await r.json();
  // give the browser: BASE + d.modalUrl + "#subjectRef=p-8f3a21&token=" + d.captureToken
  return d;
}
export async function consentStatus(subjectRef) {
  const r = await fetch(BASE + "/v1/consents?subjectRef=" + encodeURIComponent(subjectRef), { headers: H });
  return r.json(); // .status -> [{documentId,itemId,granted,since}]
}`,
        }],
        "executed against the running server in tests/",
      );
    case "go":
      return make(
        "Go 1.20+, standard library only.",
        [{
          name: "consent.go",
          code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
)

const base = "${B}"

func call(method, path string, body []byte) ([]byte, error) {
	req, _ := http.NewRequest(method, base+path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if k := os.Getenv("RGPD_MCP_API_KEY"); k != "" {
		req.Header.Set("Authorization", "Bearer "+k)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("rgpd-mcp %d: %s", res.StatusCode, b)
	}
	return b, nil
}

func main() {
	out, err := call("POST", "/v1/consent-documents", []byte(\`${compact}\`))
	if err != nil {
		panic(err)
	}
	var d struct {
		DocumentID   string \`json:"documentId"\`
		ModalURL     string \`json:"modalUrl"\`
		CaptureToken string \`json:"captureToken"\`
	}
	_ = json.Unmarshal(out, &d)
	// Show this URL in your WebView / browser:
	fmt.Println(base + d.ModalURL + "#subjectRef=p-8f3a21&token=" + url.QueryEscape(d.CaptureToken))
	// After the user closes the dialog, ask the server (source of truth):
	st, _ := call("GET", "/v1/consents?subjectRef=p-8f3a21", nil)
	fmt.Println(string(st))
}`,
        }],
        "compiled and run against the live server in tests/",
      );
    case "java":
      return make(
        "Java 11+ (java.net.http). Show the URL in a JavaFX WebView / JCEF / the system browser; poll the status endpoint afterwards.",
        [{
          name: "Consent.java",
          code: `import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;

public class Consent {
  static final String BASE = "${B}";
  static final HttpClient HTTP = HttpClient.newHttpClient();

  static String call(String method, String path, String json) throws Exception {
    HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(BASE + path)).header("Content-Type", "application/json");
    String key = System.getenv("RGPD_MCP_API_KEY");
    if (key != null) b.header("Authorization", "Bearer " + key);
    b.method(method, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json));
    HttpResponse<String> r = HTTP.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    if (r.statusCode() >= 300) throw new RuntimeException("rgpd-mcp " + r.statusCode() + ": " + r.body());
    return r.body();
  }

  public static void main(String[] a) throws Exception {
    String doc = call("POST", "/v1/consent-documents", """
      ${compact}""");
    // parse documentId / modalUrl / captureToken with your JSON library (Jackson, Gson, ...)
    System.out.println(doc);
    System.out.println(call("GET", "/v1/consents?subjectRef=" + URLEncoder.encode("p-8f3a21", StandardCharsets.UTF_8), null));
  }
}`,
        }],
        "compiled with JDK 21 and run against the live server in tests/ (skipped when no JDK)",
      );
    case "rust":
      return make(
        "Rust 2021. Cargo.toml: reqwest = { version = \"0.12\", features = [\"blocking\", \"json\"] }, serde_json = \"1\".",
        [{
          name: "src/main.rs",
          code: `use serde_json::{json, Value};

const BASE: &str = "${B}";

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::new();
    let mut req = client.post(format!("{BASE}/v1/consent-documents"));
    if let Ok(k) = std::env::var("RGPD_MCP_API_KEY") { req = req.bearer_auth(k); }
    let body: Value = serde_json::from_str(r#"${compact}"#)?;
    let doc: Value = req.json(&body).send()?.error_for_status()?.json()?;
    println!("{}{}#subjectRef=p-8f3a21&token={}", BASE, doc["modalUrl"].as_str().unwrap(), doc["captureToken"].as_str().unwrap());

    let mut st = client.get(format!("{BASE}/v1/consents")).query(&[("subjectRef", "p-8f3a21")]);
    if let Ok(k) = std::env::var("RGPD_MCP_API_KEY") { st = st.bearer_auth(k); }
    println!("{}", st.send()?.text()?);
    let _ = json!({}); // keep serde_json::json in scope for building bodies programmatically
    Ok(())
}`,
        }],
        "built with cargo (reqwest 0.12) and run against the live server in tests/ (skipped when no cargo)",
      );
    case "delphi":
      return make(
        "Delphi 10.4+ (System.Net.HttpClient, TEdgeBrowser/WebView2). The decision is read back from the server (robust; no browser bridge needed).",
        [{
          name: "ConsentUnit.pas",
          code: `uses System.SysUtils, System.Classes, System.JSON, System.Net.HttpClient, System.Net.URLClient, System.NetEncoding;

const RGPD_BASE = '${B}';

function RgpdPost(const Path, Json: string): string;
var H: THTTPClient; S: TStringStream; R: IHTTPResponse;
begin
  H := THTTPClient.Create;
  S := TStringStream.Create(Json, TEncoding.UTF8);
  try
    H.CustomHeaders['Content-Type'] := 'application/json';
    H.CustomHeaders['Authorization'] := 'Bearer ' + GetEnvironmentVariable('RGPD_MCP_API_KEY');
    R := H.Post(RGPD_BASE + Path, S);
    if R.StatusCode >= 300 then raise Exception.CreateFmt('rgpd-mcp %d: %s', [R.StatusCode, R.ContentAsString]);
    Result := R.ContentAsString(TEncoding.UTF8);
  finally S.Free; H.Free; end;
end;

procedure ShowConsent(Browser: TEdgeBrowser);   // VCL: Vcl.Edge
var J: TJSONObject; Url: string;
begin
  J := TJSONObject.ParseJSONValue(RgpdPost('/v1/consent-documents', '${compact.replace(/'/g, "''")}')) as TJSONObject;
  try
    Url := RGPD_BASE + J.GetValue<string>('modalUrl') + '#subjectRef=p-8f3a21&token=' +
           TNetEncoding.URL.Encode(J.GetValue<string>('captureToken'));
    Browser.Navigate(Url);
  finally J.Free; end;
  // when the user closes the dialog, GET /v1/consents?subjectRef=p-8f3a21 (server side) to read the decisions
end;`,
        }],
        "not compiled here (no Delphi compiler available); API calls are plain HTTP",
      );
    case "python":
      return make(
        "Python 3.9+, standard library only.",
        [{
          name: "consent.py",
          code: `import json, os, urllib.parse, urllib.request

BASE = "${B}"

def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if os.environ.get("RGPD_MCP_API_KEY"):
        req.add_header("Authorization", "Bearer " + os.environ["RGPD_MCP_API_KEY"])
    with urllib.request.urlopen(req) as r:
        return json.load(r)

doc = call("POST", "/v1/consent-documents", json.loads(r'''${compact}'''))
print(BASE + doc["modalUrl"] + "#subjectRef=p-8f3a21&token=" + urllib.parse.quote(doc["captureToken"]))
print(call("GET", "/v1/consents?subjectRef=p-8f3a21")["status"])`,
        }],
        "executed against the live server in tests/",
      );
    case "csharp":
      return make(
        ".NET 6+.",
        [{
          name: "Consent.cs",
          code: `using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

var http = new HttpClient { BaseAddress = new Uri("${B}") };
var key = Environment.GetEnvironmentVariable("RGPD_MCP_API_KEY");
if (key != null) http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);

var res = await http.PostAsync("/v1/consent-documents", new StringContent(@"${compact.replace(/"/g, '""')}", Encoding.UTF8, "application/json"));
res.EnsureSuccessStatusCode();
using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
var url = "${B}" + doc.RootElement.GetProperty("modalUrl").GetString() + "#subjectRef=p-8f3a21&token=" + Uri.EscapeDataString(doc.RootElement.GetProperty("captureToken").GetString()!);
Console.WriteLine(url); // WebView2 / browser
Console.WriteLine(await http.GetStringAsync("/v1/consents?subjectRef=p-8f3a21"));`,
        }],
        "not compiled here (no .NET SDK checked)",
      );
    case "php":
      return make(
        "PHP 8+ with ext-curl.",
        [{
          name: "consent.php",
          code: `<?php
const BASE = '${B}';
function call(string $method, string $path, ?string $json = null): array {
    $h = ['Content-Type: application/json'];
    if ($k = getenv('RGPD_MCP_API_KEY')) $h[] = 'Authorization: Bearer ' . $k;
    $c = curl_init(BASE . $path);
    curl_setopt_array($c, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $h, CURLOPT_RETURNTRANSFER => true, CURLOPT_POSTFIELDS => $json]);
    $out = curl_exec($c);
    if (curl_getinfo($c, CURLINFO_RESPONSE_CODE) >= 300) throw new RuntimeException($out);
    return json_decode($out, true);
}
$doc = call('POST', '/v1/consent-documents', '${compact.replace(/'/g, "\\'")}');
echo BASE . $doc['modalUrl'] . '#subjectRef=p-8f3a21&token=' . urlencode($doc['captureToken']) . PHP_EOL;
print_r(call('GET', '/v1/consents?subjectRef=p-8f3a21')['status']);`,
        }],
        "not run here (no PHP checked)",
      );
  }
}
