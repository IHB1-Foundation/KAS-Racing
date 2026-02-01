CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`join_code` text NOT NULL,
	`player_a_id` text,
	`player_a_address` text,
	`player_a_session_id` text,
	`player_b_id` text,
	`player_b_address` text,
	`player_b_session_id` text,
	`bet_amount` real NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`player_a_deposit_txid` text,
	`player_a_deposit_status` text,
	`player_b_deposit_txid` text,
	`player_b_deposit_status` text,
	`escrow_address_a` text,
	`escrow_address_b` text,
	`winner_id` text,
	`player_a_score` integer,
	`player_b_score` integer,
	`settle_txid` text,
	`settle_status` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`player_a_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_a_session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_b_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_b_session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_join_code_unique` ON `matches` (`join_code`);--> statement-breakpoint
CREATE TABLE `reward_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`type` text DEFAULT 'checkpoint' NOT NULL,
	`reward_amount` real NOT NULL,
	`txid` text,
	`tx_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`broadcasted_at` integer,
	`accepted_at` integer,
	`included_at` integer,
	`confirmed_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_address` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`reward_cooldown_ms` integer DEFAULT 2000 NOT NULL,
	`reward_max_per_session` integer DEFAULT 10 NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`last_event_at` integer,
	`created_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_address_unique` ON `users` (`address`);