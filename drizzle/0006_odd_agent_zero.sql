CREATE TABLE `client_addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`cep` text,
	`street` text,
	`number` text,
	`complement` text,
	`district` text,
	`city` text,
	`state` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_addresses_client_unique` ON `client_addresses` (`client_id`);--> statement-breakpoint
CREATE TABLE `client_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`description` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_notes_client_idx` ON `client_notes` (`client_id`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`instagram_url` text,
	`facebook_url` text,
	`google_business_url` text,
	`monthly_value` integer DEFAULT 0 NOT NULL,
	`period` text DEFAULT 'monthly' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contracts_client_idx` ON `contracts` (`client_id`);--> statement-breakpoint
CREATE TABLE `contract_ad_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_id` integer NOT NULL,
	`ad_account_id` text NOT NULL,
	`name` text NOT NULL,
	`currency` text,
	`account_status` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contract_ad_accounts_contract_account_unique` ON `contract_ad_accounts` (`contract_id`,`ad_account_id`);--> statement-breakpoint
CREATE INDEX `contract_ad_accounts_contract_idx` ON `contract_ad_accounts` (`contract_id`);--> statement-breakpoint
ALTER TABLE `clients` ADD `whatsapp` text;--> statement-breakpoint
INSERT INTO `client_addresses` (`client_id`, `city`, `state`)
SELECT `id`, `city`, `state` FROM `clients`
WHERE `city` IS NOT NULL OR `state` IS NOT NULL;--> statement-breakpoint
INSERT INTO `client_notes` (`client_id`, `description`, `created_at`)
SELECT `id`, `notes`, `created_at` FROM `clients`
WHERE `notes` IS NOT NULL AND trim(`notes`) <> '';--> statement-breakpoint
INSERT INTO `contracts` (`client_id`, `name`, `start_date`, `status`, `period`, `created_at`, `updated_at`)
SELECT `id`, 'Contrato principal', date(`created_at`, 'unixepoch'), 'active', 'monthly', `created_at`, `updated_at` FROM `clients`
WHERE `id` IN (SELECT DISTINCT `client_id` FROM `client_ad_accounts`);--> statement-breakpoint
INSERT INTO `contract_ad_accounts` (`contract_id`, `ad_account_id`, `name`, `currency`, `account_status`, `created_at`)
SELECT c.`id`, a.`ad_account_id`, a.`name`, a.`currency`, a.`account_status`, a.`created_at`
FROM `client_ad_accounts` a
JOIN `contracts` c ON c.`client_id` = a.`client_id` AND c.`name` = 'Contrato principal';
