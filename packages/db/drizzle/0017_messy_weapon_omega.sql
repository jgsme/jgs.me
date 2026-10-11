CREATE TABLE `zet` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pageID` integer NOT NULL,
	`rkey` text NOT NULL,
	`date` text NOT NULL,
	`title` text,
	`created` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`pageID`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `zet_rkey_unique` ON `zet` (`rkey`);