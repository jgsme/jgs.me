CREATE TABLE `on_this_day_entry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pageID` integer NOT NULL,
	`targetPageID` integer NOT NULL,
	`year` integer NOT NULL,
	`created` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`pageID`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`targetPageID`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
