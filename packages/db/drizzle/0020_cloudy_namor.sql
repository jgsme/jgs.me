CREATE TABLE `draft` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`bodyKey` text NOT NULL,
	`spoiler` integer DEFAULT false NOT NULL,
	`mf2` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draft_key_unique` ON `draft` (`key`);