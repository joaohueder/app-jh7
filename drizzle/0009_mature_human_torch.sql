CREATE TABLE `finance_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'receita' NOT NULL,
	`client_id` integer,
	`contract_id` integer,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text,
	`competence` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `finance_entries_due_idx` ON `finance_entries` (`due_date`);--> statement-breakpoint
CREATE INDEX `finance_entries_client_idx` ON `finance_entries` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `finance_entries_contract_competence_unique` ON `finance_entries` (`contract_id`,`competence`);