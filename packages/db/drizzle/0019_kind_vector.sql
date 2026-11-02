CREATE TABLE `druck` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pageID` integer NOT NULL,
	`date` text NOT NULL,
	`created` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`pageID`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `druck_page_id_unique` ON `druck` (`pageID`);