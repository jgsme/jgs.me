CREATE TABLE `copy` (
	`objectID` text NOT NULL,
	`protocol` text NOT NULL,
	`uri` text NOT NULL,
	`cid` text,
	PRIMARY KEY(`objectID`, `protocol`)
);
--> statement-breakpoint
CREATE TABLE `follower` (
	`id` text PRIMARY KEY NOT NULL,
	`protocol` text NOT NULL,
	`inbox` text NOT NULL,
	`shared_inbox` text,
	`state` text NOT NULL,
	`created` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `object` (
	`id` text PRIMARY KEY NOT NULL,
	`pageID` integer,
	`source_protocol` text NOT NULL,
	`as2` text,
	`mf2` text,
	`atproto` text,
	`our_as2` text,
	`deleted` integer DEFAULT false NOT NULL,
	`created` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`pageID`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reaction` (
	`id` text PRIMARY KEY NOT NULL,
	`targetPageID` integer NOT NULL,
	`source_protocol` text NOT NULL,
	`kind` text NOT NULL,
	`emoji` text,
	`actor_name` text,
	`actor_url` text,
	`actor_icon` text,
	`content` text,
	`created` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`undone` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`targetPageID`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
