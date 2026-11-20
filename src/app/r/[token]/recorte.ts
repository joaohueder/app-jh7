/**
 * Recorta uma série diária no último dia que tem dado.
 *
 * O período do relatório pode terminar no futuro (ex.: 16 a 22/11 gerado em
 * 19/11). Desenhar os dias que ainda não aconteceram enche o eixo de zeros e
 * ainda cria slots vazios onde um ponto do período anterior pode cair.
 *
 * `temDado` diz se um item conta como com dado; sem ela, qualquer item conta.
 */
export function ateUltimoDado<T>(
  serie: T[],
  temDado?: (item: T) => boolean,
): T[] {
  if (!serie.length || !temDado) return serie;
  let ultimo = -1;
  serie.forEach((item, indice) => {
    if (temDado(item)) ultimo = indice;
  });
  return ultimo >= 0 ? serie.slice(0, ultimo + 1) : serie;
}