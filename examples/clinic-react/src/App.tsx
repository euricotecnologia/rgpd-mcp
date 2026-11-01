import { useCallback, useEffect, useState } from "react";
import { ConsentModalFrame } from "./consent/ConsentModalFrame";
import { useConsentGate } from "./consent/useConsentGate";

interface Config { rgpdOrigin: string; patients: Record<string, string> }
type View = { kind: "queue" } | { kind: "attendance"; patient: string; newsletter: boolean } | { kind: "exit"; reason: string };

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [view, setView] = useState<View>({ kind: "queue" });

  useEffect(() => { fetch("/api/config").then((r) => r.json()).then(setConfig); }, []);

  // The route that really starts the attendance is protected on the server too.
  const startAttendance = useCallback(async (visitId: string) => {
    const r = await fetch("/api/attendance/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitId }) });
    const j = await r.json();
    if (!r.ok) return setView({ kind: "exit", reason: j.error });
    setView({ kind: "attendance", patient: j.patient, newsletter: j.newsletter });
  }, []);

  const gate = useConsentGate(config?.rgpdOrigin ?? "", startAttendance);

  if (!config) return <p>A carregar…</p>;

  return (
    <div style={{ font: "16px/1.5 system-ui, sans-serif", maxWidth: 760, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 20 }}>Clínica Exemplo — atendimento (React)</h1>

      {view.kind === "queue" && (
        <>
          <p>O paciente é chamado; antes de iniciar, deve confirmar o aviso de proteção de dados.</p>
          {Object.entries(config.patients).map(([ref, name]) => (
            <div key={ref} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #d5dae1", borderRadius: 8, padding: 12, margin: "8px 0" }}>
              <span>{name} <small>({ref})</small></span>
              <button data-testid={`call-${ref}`} disabled={gate.phase === "loading" || gate.phase === "checking"} onClick={() => gate.start(ref)}>Chamar paciente</button>
            </div>
          ))}
          {gate.phase === "denied" && (
            <div role="alert" data-testid="denied" style={{ background: "#fff4dc", border: "1px solid #b26a00", borderRadius: 8, padding: 12 }}>
              <b>{gate.message}</b>
              <p>O paciente será encaminhado para a receção presencial.</p>
              <button onClick={() => { gate.reset(); setView({ kind: "exit", reason: "sem-confirmacao" }); }}>Ir para a saída alternativa</button>
            </div>
          )}
          {gate.phase === "error" && <div role="alert">Erro: {gate.message}</div>}
        </>
      )}

      {view.kind === "attendance" && (
        <div data-testid="attendance" style={{ background: "#e9f7ee", border: "1px solid #1a7f37", borderRadius: 8, padding: 12 }}>
          <h2>Atendimento iniciado</h2>
          <p>Paciente: {view.patient}</p>
          <p>Comunicações informativas: <b>{view.newsletter ? "aceitou" : "recusou"}</b> (não afeta o atendimento).</p>
          <button onClick={() => setView({ kind: "queue" })}>Voltar à receção</button>
        </div>
      )}

      {view.kind === "exit" && (
        <div data-testid="exit" style={{ background: "#fff4dc", border: "1px solid #b26a00", borderRadius: 8, padding: 12 }}>
          <h2>Encaminhado para a receção presencial</h2>
          <p>O atendimento digital não foi iniciado. Um funcionário prestará o atendimento e informará o paciente presencialmente.</p>
          <button onClick={() => setView({ kind: "queue" })}>Voltar à receção</button>
        </div>
      )}

      <ConsentModalFrame src={gate.modalSrc} frameRef={gate.frameRef} />
    </div>
  );
}
