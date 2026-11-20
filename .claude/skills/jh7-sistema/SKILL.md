---
name: jh7-sistema
description: Padrões do projeto JH7 Marketing (Next.js + SQLite) — identidade visual, telas, mensagens, permissões e como o usuário quer as coisas.
---

# JH7 Marketing — sistema interno

Sistema web interno da agência JH7 Marketing para gestão de clientes e campanhas de tráfego (Meta Ads). Um só operador dono do sistema (João, admin); equipe pequena com permissões individuais. Tudo em português do Brasil.

## Stack e arquitetura

- **Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui** (componentes em `src/components/ui/`).
- **SQLite + Drizzle ORM** — banco em `data/jh7.db`, schema em `src/lib/db/schema.ts`, migrações em `drizzle/` (`npm run db:generate`, `npm run db:migrate`). Dados sensíveis de terceiros (token Meta, chave IA) ficam na tabela `settings`, nunca no cliente.
- **Auth**: JWT em cookie httpOnly (`src/lib/auth/`). A autorização real é sempre no servidor, lida do banco a cada request (`src/lib/auth/permissions.ts`) — nunca confiar em claims do JWT nem em checks de UI para segurança.
- **Server Actions** para toda mutação (validação com zod, mensagens de erro em pt-BR). `revalidatePath` + `router.refresh()` quando a lista da tela muda.
- Rotas do painel: `src/app/(painel)/<modulo>/` com `page.tsx` (server), `actions.ts` (server actions) e componentes client quando precisam de estado.

## Identidade visual (sempre seguir)

Tema escuro. Tokens em `src/app/globals.css` — usar as classes, nunca hex no código:

| Token | Uso |
|---|---|
| `bg-ink` | fundo da página |
| `bg-surface` / `border-line` | cards e painéis |
| `bg-surface-2` | superfície de item ativo/segundo nível |
| `text-white` | títulos e texto principal |
| `text-dim` | textos de apoio, labels, descrições |
| `text-ember` / `bg-ember` | cor de marca (laranja #ff6e00) — destaque, ação primária, ícones |
| `text-jade` / `bg-jade` | verde de sucesso — status ativo, confirmação, teste OK |
| `text-destructive` | erro e ações destrutivas |

- Cards: `rounded-xl border border-line bg-surface p-6`; títulos de seção `text-base font-semibold text-white`; apoio `text-sm text-dim`.
- Inputs e botões: altura padrão `h-11` (ações de linha podem ser `size="sm"`).
- Ícones: `lucide-react`, tamanho padrão (herdado), `aria-hidden="true"` quando decorativos.
- Feedback com `sonner`: `toast.success(...)` / `toast.error(...)`, frases curtas.
- Sem rolagem horizontal em mobile (375px) — testar grids com `sm:` e listas que empilham.

## Padrões de tela

- Página padrão: título `text-2xl font-semibold tracking-tight text-white`, subtítulo `mt-1 text-sm text-dim`, link "Voltar ao painel" com seta acima.
- Listagens: card único com `divide-y`; cada linha com nome + badges de status (pill com borda colorida) + ações à direita (Editar, Desativar/Reativar, Excluir).
- Configurações com abas (`Tabs` do shadcn): hoje Sistema, Meta Ads, IA. Segredos aparecem só como dica parcial (`••••1234`), nunca o valor completo.
- Modais com `Dialog` do shadcn. Ações destrutivas SEMPRE passam por `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`): título em pergunta ("Excluir usuário?"), explicação do efeito, nome do registro destacado em `detalhe`, botão "Cancelar" e confirmação com verbo da ação ("Excluir definitivamente", variante `destructive`).

### Barra flutuante de salvar (padrão obrigatório)

- **Nenhum formulário tem botão de salvar dentro dele.** Quando existe dado digitado e não gravado, aparece `SaveBar` (`src/components/ui/save-bar.tsx`) fixa na parte inferior, com a mensagem do que está pendente, "Cancelar" e o botão de salvar com o verbo da ação.
- O usuário precisa sempre perceber que há dados pendentes — a barra é o sinal, com ponto laranja pulsando.
- **Salvar** grava e a barra desaparece; **Cancelar** descarta o que foi digitado e volta aos dados do banco (só a página de criação sai da tela).
- Em telas com abas, a barra é **única** no nível das abas: cada aba registra seu estado (`sujo`, mensagem, `salvar`, `cancelar`) em `client-tabs.tsx`/`tab-registry.ts`, e as abas ficam com `forceMount` para trocar de aba sem perder o que foi digitado. Com mais de uma aba pendente, o botão vira "Salvar tudo".
- Nunca acessar `ref.current` durante o render (o lint bloqueia); use `useState` para os valores "originais" e atualize-os após salvar.

### Modais de cadastro com dados (regra)

- Cadastro/edição de registros com formulário próprio abre em **modal**, não em painel na página (exceção: a tela do cliente, que tem abas).
- O modal de formulário **só fecha pelo X, por "Cancelar"/"Fechar" ou ao salvar**. Clique fora e ESC não fecham — assim ninguém perde o que digitou. Implementado com `onInteractOutside`, `onPointerDownOutside` e `onEscapeKeyDown` chamando `preventDefault()`.
- As ações de salvar/cancelar ficam no rodapé do modal, separadas por `border-t border-line pt-4`.
- **Monte o modal só quando aberto** (`{aberto ? <Modal open .../> : null`, com `key` do registro). Modal sempre montado mantém o `useState` inicial da primeira abertura e não recarrega campos controlados (foi assim que o valor mensal do contrato vinha vazio na edição).

## Permissões e papéis

- Dois papéis: `admin` (acessa tudo, sempre) e `user` (só o que a ACL dele permitir).
- ACL por usuário: módulos (clientes, campanhas, relatorios, financeiro, usuarios, configuracoes) × ações (view/create/edit/delete), validada no servidor com `requirePermission(modulo, acao)` em páginas e actions.
- Menu e botões somem conforme a permissão, mas isso é só UX — a verificação real é server-side.
- Proteções fixas: não excluir/desativar a própria conta, não remover o último admin ativo, só admin edita/exclui outro admin, não-admin nunca define/promove para admin.
- Usuário comum só consegue editar usuários se tiver ACL `usuarios.edit`, e nesse caso não vê o campo "Função na agência".

## Mensagens (pt-BR, tom direto e cordial)

- Erros de validação falam com o usuário: "Informe o nome completo.", "E-mail inválido.", "A senha deve ter no mínimo 8 caracteres."
- Confirmações: "Usuário criado.", "Usuário atualizado.", "Usuário excluído.", "Status do usuário atualizado.", "Configurações salvas.", "Token da Meta salvo."
- Ações negadas explicam o porquê: "Você não pode excluir sua própria conta.", "O sistema precisa de pelo menos um administrador.", "Somente um administrador pode editar outro administrador."
- Acesso negado por rota → 404 (não 403) para não revelar a existência do módulo.
- Sempre `toLocaleDateString("pt-BR")` / `toLocaleString("pt-BR")` para datas.

## Verificação antes de encerrar

1. `npx tsc --noEmit`, `npx eslint src --max-warnings 0` e `npm run build`.
2. Testar no preview do navegador o fluxo pedido (happy path + cancelar modal + tentativa sem permissão).
3. Migrações novas: rodar `npm run db:migrate` e conferir os dados existentes; nunca recriar tabela quando um `ALTER TABLE` resolve.

## Registro de pedidos do usuário (atualizar sempre)

- **Aba IA nas configurações** (fase 3): URL base + modelo + chave opcional, teste de conexão no formato OpenAI-compatible (`POST {base}/chat/completions`).
- **Permissões individuais por usuário** (fase 4): matriz módulo × ação; papel fixo de administrador protegido; permissões lidas do banco a cada request (revogação imediata).
- **Função só Administrador/Usuário** (fase 5): só admin promove; selecionar Administrador oculta a matriz de permissões; campo função oculto para não-admins.
- **Exclusão com confirmação** (fase 6): excluir usuário remove o registro de vez (com as proteções de admin) e TODA ação destrutiva exige `ConfirmDialog` antes — padrão a seguir em qualquer módulo futuro.
- **Módulo Clientes** (fase 7): cadastro/edição em telas próprias (`/clientes/novo`, `/clientes/[id]`), nunca em modal; dados completos de contato/empresa; relação cliente-contas Meta selecionada pelo token salvo, persistindo snapshot da conta para manter nome/moeda se ela desaparecer na Meta.
- **Token Meta expirado** (fase 7): mostrar que expirou e direcionar Configurações → Meta Ads; nunca expor o token ao navegador. Até ser renovado, contas vinculadas anteriormente continuam visíveis no modo de edição.
- **Cliente em abas** (fase 8): a tela do cliente tem as abas **Dados**, **Endereço**, **Contratos** e **Anotações**; alternar entre abas não perde dados e a barra flutuante de salvar acompanha.
- **Contratos por cliente** (fase 8): cada contrato tem nome, data de início, status (ativo/inativo), período (mensal/trimestral/semestral/anual), valor mensal, Instagram, Facebook, Google Meu Negócio e **suas próprias contas de anúncio**. Cliente pode ter vários contratos; as contas NÃO ficam mais no cliente.
- **Contrato em modal** (fase 9): cadastro e edição do contrato acontecem em modal que só fecha no X, no Cancelar ou ao salvar.
- **Busca de contas no contrato** (fase 10): a lista de contas Meta tem campo de busca por nome, ID ou moeda, com aviso quando nada é encontrado; marcar contas com o filtro ativo não perde seleções.
- **Contas sempre recolhidas** (fase 11): na seleção de contas do contrato só as **selecionadas** ficam visíveis, e sempre no topo. As demais só aparecem após clicar em "Mostrar todas as contas" — e aí sim com a busca. O filtro nunca esconde uma conta já marcada.
- **Módulo Campanhas** (fase 12): navegação em 4 níveis por **páginas próprias**, nunca modal: `/campanhas` (clientes com campanha no filtro) → `/campanhas/[clientId]` → `/[campaignId]` (conjuntos) → `/[adsetId]` (anúncios). Métricas ao vivo da Graph API (nada persistido), com filtros de período (hoje, ontem, 7/14/21/30 dias, desde o início) e status (ativas/inativas/todas, padrão ativas) na URL e preservados na navegação.
- **Métricas exibidas** (fase 12): nome, objetivo traduzido, investido, impressões, frequência, alcance, cliques no link, visitas ao perfil do Instagram, seguidores, mensagens iniciadas, resultado, custo por resultado, CTR e CPM. Métrica ausente na Meta aparece como "—", nunca 0. O "resultado" muda conforme objetivo+destino (WhatsApp → mensagens iniciadas; perfil do Instagram → visitas ao perfil; vendas → compras; etc.), centralizado em `src/lib/meta/insights.ts`.
- **Funil de compras**: quando o tipo de conversão do card for "Compras", exibir também visualização da página de destino, adição ao carrinho e finalização de compra, lidas das ações de insights da Meta; fora de Compras, não exibir esses campos.
- **IDs na Graph API** (fase 12): só IDs de **conta** levam `act_`; IDs de campanha/conjunto/anúncio vão crus. Normalizar tudo quebra a consulta de insights com erro 200.
- **Fronteira server/client** (fase 12): nunca passar função como prop de Server Component para Client Component. Para montar links por linha, passe uma string base (`hrefBase` + `query`) e monte o href no cliente.
- **Campanhas em cards** (fase 13): campanhas, conjuntos e anúncios são listados em **cards**, nunca em tabela. Cada card traz nome, status, objetivo, um bloco de destaque com investido + resultado (e custo por resultado) e as demais métricas em grade que vai de 2 a 3 colunas, com ícone por métrica. O botão de descer um nível muda de rótulo ("Ver conjuntos" / "Ver anúncios") e não aparece no nível de anúncios.
- **Entrada do módulo enxuta** (fase 14): no card de cliente em `/campanhas` mostre apenas **investido** e **campanhas ativas** — sem engajamento nem custo por resultado, e sem badge repetindo a contagem.
- **Métricas de conversão** (fase 15): no topo de `/campanhas/[clientId]` mostre apenas investido e campanhas (com ativas); resultado e custo ficam no card individual. Resultado é o oficial da Meta (`results`/`cost_per_result`) ou, na falta, a ação da conversão — nunca engajamento genérico. Custo = investimento ÷ resultados. CTR = `inline_link_click_ctr` (taxa de clique no link), não CTR geral.
- **Comparação de métricas**: em todas as métricas de campanhas, mostrar o valor do período anterior e a variação percentual “vs período anterior” contra uma janela anterior de mesma duração; “Desde o início” e métricas sem base anterior não mostram comparação. Variações favoráveis ficam verdes (`text-jade`) e desfavoráveis vermelhas (`text-destructive`); para custos, CPM e frequência, queda é favorável.
- **Objetivo e destino** (fase 15): card mostra separadamente objetivo da campanha (ex.: "Engajamento") → destino da conversão (ex.: "Mensagens no WhatsApp"). O destino da campanha é derivado do `destination_type` do conjunto porque a Graph API não expõe esse campo na campanha. Quando objetivo e destino coincidem no conjunto, não repetir.
- **Instagram no Gerenciador** (fase 15): visitas ao perfil vêm de `instagram_profile_visits`; seguidores devem ser lidos do indicador próprio do Gerenciador quando disponível, sem inventar zero quando a Graph API não o devolve — mostrar `—`.
- **Máscaras e validação** (fase 8): CNPJ/CPF com máscara e verificação de dígito verificador **ao sair do campo** (mensagem inline + toast); telefone e WhatsApp com máscara; CEP com máscara. Utilitários em `src/lib/format/masks.ts`; o servidor revalida sempre.
- **Endereço com CEP** (fase 8): CEP completo consulta ViaCEP e preenche rua/bairro/cidade/UF; se a API falhar, o preenchimento manual continua liberado.
- **Anotações com data e hora** (fase 8): gravadas automaticamente pelo servidor no momento do registro, exibidas em pt-BR e **não editáveis**. O campo Observações antigo virou anotações na migração.
- **Filtro de nicho lembrado no módulo Campanhas** (fase 18): o nicho escolhido fica guardado em `sessionStorage` (`campanhas:nicho`) e volta selecionado ao navegar dentro do módulo, inclusive ao trocar de cliente/campanha/conjunto e ao voltar. Vale só enquanto a aba estiver aberta; nos módulos Clientes e Relatórios o filtro continua voltando a "Todos os nichos". Nicho que deixou de existir cai em "todos" em vez de deixar o campo em branco.
- **Campanhas não consultam a Meta sozinhas** (fase 17): as telas leem do cache local (`meta_cache`, `src/lib/meta/cache.ts`) e só vão à Meta pelo botão **"Atualizar dados"** (ao lado dos filtros). Ao lado dele, sempre o tempo desde a última atualização — "Sem atualizar há 1 mês / 15 dias / 1 semana / 7 horas / 30 segundos"; acima de 1 dia (ou nunca atualizado) o texto pisca e fica laranja. A idade é **do que está na tela**: mínimo entre as chaves daquele cliente, período e nível (nunca `max`, que pintava dado velho de fresco quando só uma conta era atualizada). O botão renova também o nível aberto (conjuntos/anúncios), não só a lista de campanhas. A primeira leitura de um filtro nunca consultado busca sozinha, senão a tela abriria vazia.
- **Sem stories no relatório** (fase 17): o grupo Instagram conta apenas **feed e Reels**. A Graph API só devolve story nas 24h em que ele está no ar (não existe "stories arquivados"), então qualquer número de Stories ficaria só no dia da geração e enganaria o cliente. Não reintroduzir o edge `stories` nem captura periódica.
- **Módulo Financeiro** (fase 16): tela única `/financeiro` com mês na URL (`?mes=YYYY-MM`), navegação mês anterior/seguinte/atual. Lançamentos de receita e despesa com descrição, cliente opcional, categoria, valor em centavos, vencimento e data de pagamento; situação (em aberto / pago / vencido) é derivada de `paid_at` vs. vencimento, nunca gravada. Resumo do mês mostra a receber, recebido, despesas, vencido e saldo. Os vencidos de meses anteriores continuam listados até serem pagos, para a inadimplência não desaparecer ao trocar de mês. Cadastro/edição em modal que só fecha no X, Cancelar ou salvar; exclusão via `ConfirmDialog`.
- **Cobranças do contrato** (fase 16): "Gerar cobranças do mês" cria a mensalidade de cada contrato ativo, com vencimento no mesmo dia do início do contrato (limitado ao último dia do mês) e unicidade por `(contrato, competência)` — gerar de novo não duplica. Contratos com valor zero são pulados. Geração é idempotente por mês, não retroativa.
- Novos pedidos que fujam do padrão acima devem ser anotados aqui.

## Deploy (standalone)

- **Build**: `next.config.ts` usa `output: "standalone"`. O build gera `.next/standalone` com `server.js` e o `node_modules` mínimo; não há `npm install` no servidor.
- **Dados fora do código**: banco e uploads ficam em `DATA_DIR` (`src/lib/paths.ts` é a única fonte do caminho). No servidor aponte para `/var/lib/jh7`; sem isso, atualizar o sistema apaga o banco.
- **Migrações no boot**: `src/instrumentation.ts` chama `garantirMigracoes()`, então `npm run db:migrate` não é obrigatório no servidor. A pasta `drizzle/` precisa ir junto no pacote (`MIGRATIONS_DIR` sobrescreve).
- **Binários nativos**: `better-sqlite3` e `sharp` são por plataforma. O build é sempre feito **no servidor** (Linux); pacote gerado no Windows não roda lá.
- **Pacote**: `preparar-servidor.bat` gera `dist-servidor/` (código + drizzle + LEIA-ME, sem banco, segredos ou node_modules), já ignorado no `.gitignore`.
- **Migração vazia**: arquivo `.sql` só com comentários quebra o SQLite. As migrações no-op usam `SELECT 1;`.
