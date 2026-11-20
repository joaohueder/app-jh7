CREATE TABLE `finance_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`paid_on` text NOT NULL,
	`method` text NOT NULL,
	`notes` text,
	`reversed_at` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `finance_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `finance_payments_entry_idx` ON `finance_payments` (`entry_id`);