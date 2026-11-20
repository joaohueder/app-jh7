"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Largura real do container, medida no cliente. Os gráficos usam isso em vez
 * de rolagem horizontal: o SVG é desenhado no tamanho que cabe na tela e os
 * rótulos são distribuídos conforme o espaço disponível.
 */
export function useLargura(minimo = 280) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(minimo);

  useEffect(() => {
    const alvo = ref.current;
    if (!alvo) return;

    const medir = () => setLargura(Math.max(minimo, Math.round(alvo.clientWidth)));
    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [minimo]);

  return [ref, largura] as const;
}