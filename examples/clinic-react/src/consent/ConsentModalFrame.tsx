import type { RefObject } from "react";

/** Full-screen overlay that hosts the rgpd-mcp modal page (/modal/<id>) in an iframe. */
export function ConsentModalFrame({ src, frameRef }: { src: string | null; frameRef: RefObject<HTMLIFrameElement> }) {
  if (!src) return null;
  return (
    <iframe
      ref={frameRef}
      src={src}
      title="Aviso de proteção de dados"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "transparent", zIndex: 10 }}
    />
  );
}
