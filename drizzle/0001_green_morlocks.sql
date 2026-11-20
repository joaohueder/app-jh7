ALTER TABLE `users` ADD `permissions` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
UPDATE `users`
SET `permissions` = '{"clientes":["view","create","edit","delete"],"campanhas":["view","create","edit","delete"],"relatorios":["view","create","edit","delete"],"financeiro":["view","create","edit","delete"],"usuarios":["view","create","edit","delete"],"configuracoes":["view","create","edit","delete"]}'
WHERE `role` = 'admin';