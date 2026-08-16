CREATE TABLE `page_similarity` (
	`runID` integer NOT NULL,
	`pageID` integer NOT NULL,
	`relatedPageID` integer NOT NULL,
	`score` real NOT NULL,
	`adjusted` real NOT NULL,
	PRIMARY KEY(`runID`, `pageID`, `relatedPageID`),
	FOREIGN KEY (`runID`) REFERENCES `similarity_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pageID`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`relatedPageID`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `similarity_run` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model` text NOT NULL,
	`params` text NOT NULL,
	`created` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`current` integer DEFAULT false NOT NULL
);
