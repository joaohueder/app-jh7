/**
 * Frases motivacionais exibidas na tela de login.
 * Sorteada a cada acesso. Se um dia precisar editar pelo sistema,
 * basta migrar esta lista para a tabela `settings`.
 */
export const FRASES: readonly string[] = [
  "Quem planta hoje colhe resultados amanhã. Foco no processo.",
  "Não existe atalho para o topo — existe consistência.",
  "Grandes marcas começam com pequenas decisões bem executadas.",
  "O cliente certo chega quando o trabalho certo é feito.",
  "Tráfego não cria desejo: ele conecta desejo a quem já quer comprar.",
  "Dados sem análise são só números. Análise sem ação é só conversa.",
  "Cada real investido precisa saber por que está sendo investido.",
  "Resultado bom é rotina bem feita.",
  "Não é sobre estar em todo lugar, é sobre estar onde importa.",
  "A melhor campanha é aquela que resolve um problema real do cliente.",
  "Quem mede, melhora. Quem testa, descobre. Quem insiste, cresce.",
  "O óbvio bem feito bate o criativo não testado.",
  "Trabalhe com clareza hoje para colher tranquilidade amanhã.",
  "Nenhum lead é pequeno quando o negócio é local.",
  "Antes de escalar, acerte. Antes de acertar, escute.",
  "Marketing bom parece simples — porque foi pensado a fundo.",
  "O funil não começa no anúncio: começa na promessa que você cumpre.",
  "Disciplina é o que transforma ideia em faturamento.",
  "Cada cliente atendido bem vira três indicações futuras.",
  "Foco no que move o ponteiro. O resto é ruído.",
  "Constância vence talento quando o talento não é constante.",
  "Investir sem medir é apostar. Medir e ajustar é gerir.",
];

export function sortearFrase(): string {
  return FRASES[Math.floor(Math.random() * FRASES.length)];
}
