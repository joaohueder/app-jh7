-- Era uma cópia exata da 0001 (mesmo `ALTER TABLE users ADD permissions`), o
-- que quebrava toda instalação nova com "duplicate column name: permissions".
-- A 0001 cria a coluna; aqui o `SELECT` só marca a migração como aplicada.
SELECT 1;
