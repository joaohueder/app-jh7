/**
 * Paleta dos gráficos do relatório, tirada do logotipo da JH7
 * (laranja, verde-limão, âmbar e vermelho). Vai como cor literal porque estes
 * gráficos são SVG/estilo inline — nenhum depende de token compilado.
 */
export const PALETA = [
  "#ff6e00",
  "#8cc63f",
  "#ffb020",
  "#e5484d",
  "#ff8a3d",
  "#63c74d",
] as const;

/** Cor da paleta por índice, circular. */
export function cor(indice: number): string {
  return PALETA[((indice % PALETA.length) + PALETA.length) % PALETA.length];
}