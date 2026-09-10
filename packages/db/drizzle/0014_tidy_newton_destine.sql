CREATE TABLE `page_link` (
	`fromPageID` integer NOT NULL,
	`toTitle` text NOT NULL,
	PRIMARY KEY(`fromPageID`, `toTitle`),
	FOREIGN KEY (`fromPageID`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `page_link_to_title` ON `page_link` (`toTitle`);