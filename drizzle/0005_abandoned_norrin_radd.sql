
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_name` text NOT NULL,
	`legal_name` text,
	`document` text,
	`contact_person` text,
	`email` text,
	`phone` text,
	`city` text,
	`state` text,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_document_unique` ON `clients` (`document`);--> statement-breakpoint
CREATE INDEX `clients_business_name_idx` ON `clients` (`business_name`);--> statement-breakpointCREATE TABLE `client_ad_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`ad_account_id` text NOT NULL,
	`name` text NOT NULL,
	`currency` text,
	`account_status` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_ad_accounts_client_account_unique` ON `client_ad_accounts` (`client_id`,`ad_account_id`);--> statement-breakpoint
CREATE INDEX `client_ad_accounts_client_idx` ON `client_ad_accounts` (`client_id`);