CREATE TABLE `niches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `niches_name_unique` ON `niches` (`name`);--> statement-breakpoint
ALTER TABLE `clients` ADD `niche_id` integer REFERENCES niches(id);