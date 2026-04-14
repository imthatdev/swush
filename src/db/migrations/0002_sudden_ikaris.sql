ALTER TABLE "bookmarks" ADD COLUMN "analytics" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "analytics" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "server_settings" ADD COLUMN "sharing_domain_fallback_url" text;--> statement-breakpoint
ALTER TABLE "short_links" ADD COLUMN "analytics" jsonb DEFAULT '{}'::jsonb NOT NULL;