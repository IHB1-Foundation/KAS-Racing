ALTER TABLE `matches` ADD `player_a_pubkey` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `player_b_pubkey` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `escrow_mode` text DEFAULT 'fallback';--> statement-breakpoint
ALTER TABLE `matches` ADD `escrow_script_a` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `escrow_script_b` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `refund_locktime_blocks` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `oracle_public_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `reward_events_session_seq_idx` ON `reward_events` (`session_id`,`seq`);