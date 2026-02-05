-- Переименовать admin в GPT
UPDATE users SET username = 'GPT' WHERE username = 'admin';
UPDATE messages SET from_user = 'GPT' WHERE from_user = 'admin';
UPDATE messages SET to_user = 'GPT' WHERE to_user = 'admin';

-- Проверка
SELECT * FROM users WHERE username = 'GPT';
