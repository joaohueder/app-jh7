import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Usuários do sistema (equipe interna da JH7).
 * Papéis: admin | user
 */
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  /** ACL por usuário. Sempre validada no servidor contra PERMISSION_MODULES. */
  permissions: jsonb("permissions")
    .$type<Record<string, string[]>>()
    .notNull()
    .default(sql`'{}'`),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Configurações gerais em chave/valor.
 * Já usada para system_name e logo_path; servirá depois para
 * a chave de IA e o token da Meta Ads.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Nichos de atuação dos clientes (Bar e Restaurantes, Loja de Veículo,
 * Fotografia...). Cadastrados nas Configurações e usados para agrupar a
 * carteira; o cliente aponta para um nicho.
 */
export const niches = pgTable(
  "niches",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull(),
    /** Ordem de exibição; o cadastro define, a lista respeita. */
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("niches_name_unique").on(table.name)],
);

/** Cadastro de clientes da agência. Documento opcional, porém único quando informado. */
export const clients = pgTable(
  "clients",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    businessName: text("business_name").notNull(),
    legalName: text("legal_name"),
    document: text("document"),
    contactPerson: text("contact_person"),
    email: text("email"),
    /** Telefone fixo/comercial, armazenado só com dígitos. */
    phone: text("phone"),
    /** WhatsApp, armazenado só com dígitos. */
    whatsapp: text("whatsapp"),
    /** Nicho de atuação (Bar e Restaurantes, Loja de Veículo...). */
    nicheId: integer("niche_id").references(() => niches.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    /**
     * @deprecated cidade/UF/observações antigas. O endereço agora vive em
     * `client_addresses` e as anotações em `client_notes`. Mantidas para não
     * exigir reconstrução da tabela; a UI não as utiliza mais.
     */
    city: text("city"),
    state: text("state"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("clients_document_unique").on(table.document),
    index("clients_business_name_idx").on(table.businessName),
  ],
);

/**
 * Vínculo local de cliente com conta externa de anúncios Meta.
 * @deprecated as contas agora pertencem ao contrato (`contract_ad_accounts`).
 * Mantida apenas com os dados migrados; a UI usa o vínculo por contrato.
 */
export const clientAdAccounts = pgTable(
  "client_ad_accounts",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    adAccountId: text("ad_account_id").notNull(),
    name: text("name").notNull(),
    currency: text("currency"),
    accountStatus: integer("account_status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("client_ad_accounts_client_account_unique").on(
      table.clientId,
      table.adAccountId,
    ),
    index("client_ad_accounts_client_idx").on(table.clientId),
  ],
);

/** Endereço do cliente (um por cliente). */
export const clientAddresses = pgTable(
  "client_addresses",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    cep: text("cep"),
    street: text("street"),
    number: text("number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city"),
    state: text("state"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("client_addresses_client_unique").on(table.clientId)],
);

/** Contratos do cliente. Cada contrato tem suas próprias contas de anúncio. */
export const contracts = pgTable(
  "contracts",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Data de início em ISO (YYYY-MM-DD). */
    startDate: text("start_date").notNull(),
    status: text("status").notNull().default("active"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),
    googleBusinessUrl: text("google_business_url"),
    /** Valor mensal em centavos. */
    monthlyValue: integer("monthly_value").notNull().default(0),
    period: text("period").notNull().default("monthly"),
    /**
     * Dia do mês em que a parcela vence (1–31; 31 vira o último dia em meses
     * mais curtos). Sem valor, cai no dia do início do contrato.
     */
    dueDay: integer("due_day"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("contracts_client_idx").on(table.clientId)],
);

/** Vínculo de contrato com conta externa de anúncios Meta (com snapshot). */
export const contractAdAccounts = pgTable(
  "contract_ad_accounts",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    contractId: integer("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    adAccountId: text("ad_account_id").notNull(),
    name: text("name").notNull(),
    currency: text("currency"),
    accountStatus: integer("account_status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("contract_ad_accounts_contract_account_unique").on(
      table.contractId,
      table.adAccountId,
    ),
    index("contract_ad_accounts_contract_idx").on(table.contractId),
  ],
);

/** Anotações/histórico do cliente. */
export const clientNotes = pgTable(
  "client_notes",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    /** Momento do registro — automático, sem edição pela interface. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("client_notes_client_idx").on(table.clientId)],
);

/**
 * Relatórios gerados por cliente. O `token` abre a versão pública em `/r/<token>`,
 * sem login — por isso o relatório não pode conter segredos.
 */
export const reports = pgTable(
  "reports",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** Período do relatório, em ISO (YYYY-MM-DD). */
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    token: text("token").notNull(),
    /**
     * Snapshot do relatório (JSON), gravado na geração. A página pública lê
     * somente daqui — nunca consulta a Meta ao abrir.
     */
    data: text("data").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("reports_token_unique").on(table.token),
    index("reports_client_idx").on(table.clientId),
  ],
);

/**
 * Cópia local do que veio da Meta (módulo Campanhas).
 *
 * As telas de campanhas não consultam a Meta sozinhas: leem daqui e só
 * reconsultam quando o usuário clica em "Atualizar dados". `key` é a mesma
 * chave que já agrupava o cache em memória (conta + nível + período);
 * `atualizado:<cliente>` guarda quando aquele cliente foi atualizado.
 */
export const metaCache = pgTable("meta_cache", {
  key: text("key").primaryKey(),
  data: text("data").notNull(),
  /** Momento da consulta à Meta, em milissegundos (epoch). */
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

/**
 * Lançamentos financeiros: contas a receber (receita) e a pagar (despesa).
 * `amount` é sempre positivo em centavos — o sinal vem de `kind`.
 * Situação (pago / em aberto / vencido) é derivada de `paidAt` e `dueDate`.
 */
export const financeEntries = pgTable(
  "finance_entries",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    kind: text("kind").notNull().default("receita"),
    clientId: integer("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    /** Contrato que originou a cobrança, quando gerada automaticamente. */
    contractId: integer("contract_id").references(() => contracts.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    category: text("category").notNull(),
    /** Valor em centavos, sempre positivo. */
    amount: integer("amount").notNull(),
    /** Vencimento em ISO (YYYY-MM-DD). */
    dueDate: text("due_date").notNull(),
    /**
     * @deprecated substituído por `finance_payments`. Mantido para não
     * reconstruir a tabela; a UI e os totais leem os pagamentos.
     */
    paidAt: text("paid_at"),
    /** Competência YYYY-MM, usada só nas cobranças geradas do contrato. */
    competence: text("competence"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("finance_entries_due_idx").on(table.dueDate),
    index("finance_entries_client_idx").on(table.clientId),
    uniqueIndex("finance_entries_contract_competence_unique").on(
      table.contractId,
      table.competence,
    ),
  ],
);

/**
 * Baixas de um lançamento financeiro. Cada linha é um recebimento (ou
 * pagamento, para despesa); a soma das baixas não estornadas é o valor
 * efetivamente liquidado. Integral = soma igual ao valor do lançamento;
 * parcial = soma menor; nada = em aberto.
 *
 * Estorno nunca apaga a linha: grava `reversed_at` para manter o histórico de
 * quem deu baixa e quando voltou atrás.
 */
export const financePayments = pgTable(
  "finance_payments",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => financeEntries.id, { onDelete: "cascade" }),
    /** Valor da baixa em centavos, positivo. */
    amount: integer("amount").notNull(),
    /** Data do recebimento/pagamento em ISO (YYYY-MM-DD). */
    paidOn: text("paid_on").notNull(),
    /** pix | dinheiro | credito | permuta | cortesia */
    method: text("method").notNull(),
    notes: text("notes"),
    /** Estorno: data em que a baixa foi desfeita; nulo = vale. */
    reversedAt: text("reversed_at"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("finance_payments_entry_idx").on(table.entryId)],
);

export type FinancePayment = typeof financePayments.$inferSelect;

export const FINANCE_PAYMENT_METHODS = [
  "pix",
  "dinheiro",
  "credito",
  "permuta",
  "cortesia",
] as const;
export type FinancePaymentMethod = (typeof FINANCE_PAYMENT_METHODS)[number];

export const FINANCE_PAYMENT_LABELS: Record<FinancePaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  credito: "Crédito",
  permuta: "Permuta",
  cortesia: "Cortesia",
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type ClientAdAccount = typeof clientAdAccounts.$inferSelect;
export type ClientAddress = typeof clientAddresses.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ContractAdAccount = typeof contractAdAccounts.$inferSelect;
export type ClientNote = typeof clientNotes.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type FinanceEntry = typeof financeEntries.$inferSelect;
export type NewFinanceEntry = typeof financeEntries.$inferInsert;

export const FINANCE_KINDS = ["receita", "despesa"] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number];

export const FINANCE_KIND_LABELS: Record<FinanceKind, string> = {
  receita: "Receita",
  despesa: "Despesa",
};

/** Categorias sugeridas; o banco aceita texto livre. */
export const FINANCE_CATEGORIES = [
  "Mensalidade",
  "Serviço avulso",
  "Impostos",
  "Ferramentas",
  "Equipe",
  "Outros",
] as const;

export const CONTRACT_STATUS = ["active", "inactive"] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
};

export const CONTRACT_PERIODS = [
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
] as const;

export type ContractPeriod = (typeof CONTRACT_PERIODS)[number];

export const CONTRACT_PERIOD_LABELS: Record<ContractPeriod, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export const USER_ROLES = ["admin", "user"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  user: "Usuário",
};

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_MODULES = [
  "clientes",
  "campanhas",
  "relatorios",
  "financeiro",
  "usuarios",
  "configuracoes",
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const MODULE_LABELS: Record<PermissionModule, string> = {
  clientes: "Clientes",
  campanhas: "Campanhas",
  relatorios: "Relatórios",
  financeiro: "Financeiro",
  usuarios: "Usuários",
  configuracoes: "Configurações",
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
};
