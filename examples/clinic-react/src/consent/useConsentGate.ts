import { useCallback, useEffect, useRef, useState } from "react";

export type Phase = "idle" | "loading" | "consenting" | "checking" | "denied" | "error";

interface RgpdMessage {
  source: "rgpd-mcp";
  type: "decision" | "cancel" | "error";
  payload?: { message?: string };
}

/**
 * Consent gate for "attendance is about to start".
 *  start(patientRef)  -> backend builds the document; we show the modal (iframe served by rgpd-mcp)
 *  modal posts decision/cancel -> on decision we ask OUR backend, which reads the consent ledger
 *  onProceed(visitId) is called only when the backend says the notice was acknowledged.
 * The browser event is only a trigger: the backend decides.
 */
export function useConsentGate(rgpdOrigin: string, onProceed: (visitId: string) => void) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const visitId = useRef<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  const start = useCallback(async (patientRef: string) => {
    setPhase("loading");
    setMessage(null);
    try {
      const r = await fetch("/api/consent/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientRef }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "erro");
      visitId.current = j.visitId;
      setModalSrc(j.modalSrc);
      setPhase("consenting");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (phase !== "consenting") return;
    const onMessage = async (e: MessageEvent<RgpdMessage>) => {
      // accept only messages from the rgpd-mcp origin AND from our own iframe
      if (e.origin !== rgpdOrigin || e.source !== frame.current?.contentWindow) return;
      if (!e.data || e.data.source !== "rgpd-mcp") return;
      setModalSrc(null);
      if (e.data.type === "cancel") {
        setPhase("denied");
        setMessage("Sem a confirmação do aviso de proteção de dados não podemos iniciar o atendimento digital.");
      } else if (e.data.type === "error") {
        setPhase("error");
        setMessage(e.data.payload?.message ?? "Erro no consentimento");
      } else if (e.data.type === "decision") {
        setPhase("checking");
        const r = await fetch("/api/consent/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitId: visitId.current }) });
        const j = await r.json();
        if (j.proceed && visitId.current) {
          setPhase("idle");
          onProceed(visitId.current);
        } else {
          setPhase("denied");
          setMessage("O aviso de proteção de dados não foi confirmado.");
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [phase, rgpdOrigin, onProceed]);

  const reset = useCallback(() => {
    setPhase("idle");
    setMessage(null);
    setModalSrc(null);
  }, []);

  return { phase, message, modalSrc, frameRef: frame, start, reset };
}
