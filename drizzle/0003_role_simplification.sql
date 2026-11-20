-- Simplifica papéis para admin | user (função de agência deixa de existir).
UPDATE `users` SET `role` = 'user' WHERE `role` <> 'admin';
