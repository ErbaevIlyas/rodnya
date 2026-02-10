const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// PostgreSQL подключение
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
    console.error('❌ Ошибка БД:', err);
});

// Инициализация БД
async function initializeDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                last_online TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица users готова');

        // Добавляем колонку last_online если её нет
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_online TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);

        // Добавляем колонки для профиля
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255)
        `);

        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS status_text VARCHAR(255)
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                from_user VARCHAR(255) NOT NULL,
                to_user VARCHAR(255) NOT NULL,
                message TEXT,
                filename VARCHAR(255),
                originalname VARCHAR(255),
                url TEXT,
                mimetype VARCHAR(255),
                caption TEXT,
                type VARCHAR(50) DEFAULT 'text',
                is_general INTEGER DEFAULT 0,
                read_status INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица messages готова');

        // Добавляем колонку read_status если её нет
        await pool.query(`
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_status INTEGER DEFAULT 0
        `);
    } catch (err) {
        console.error('❌ Ошибка инициализации БД:', err);
    }
}

initializeDB();
console.log('✅ Подключено к PostgreSQL');

// Создаем папку для загрузок
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        // Принимаем все типы файлов
        cb(null, true);
    }
});

// Статические файлы
app.use(express.static('public'));

// Специальный endpoint для скачивания видео в высоком качестве
app.get('/uploads/:filename', (req, res) => {
    let filename = req.params.filename;
    
    // Если запрашивают сжатую версию, используем её для быстрой загрузки в чате
    // Если скачивают, используем оригинал
    const isDownload = req.query.download === 'true';
    
    if (!isDownload && filename.startsWith('compressed-')) {
        // Используем сжатую версию для просмотра в чате
    } else if (!isDownload && !filename.startsWith('compressed-')) {
        // Проверяем есть ли сжатая версия для просмотра
        const compressedFilename = `compressed-${filename}`;
        const compressedPath = path.join(__dirname, 'uploads', compressedFilename);
        if (fs.existsSync(compressedPath)) {
            filename = compressedFilename;
        }
    }
    
    const filepath = path.join(__dirname, 'uploads', filename);
    
    // Проверяем что файл существует
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Файл не найден' });
    }
    
    const stat = fs.statSync(filepath);
    const fileSize = stat.size;
    
    // Определяем тип контента
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.avi') {
        contentType = 'video/' + ext.slice(1);
    } else if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.gif' || ext === '.webp') {
        contentType = 'image/' + (ext === '.jpg' ? 'jpeg' : ext.slice(1));
    } else if (ext === '.mp3' || ext === '.wav' || ext === '.ogg') {
        contentType = 'audio/' + ext.slice(1);
    }
    
    // Устанавливаем правильные headers для скачивания
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    // Поддержка range requests для видео
    if (req.headers.range) {
        const parts = req.headers.range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType
        });
        
        fs.createReadStream(filepath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType
        });
        fs.createReadStream(filepath).pipe(res);
    }
});

// Отключаем кеш для всех файлов
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', 'W/"' + Date.now() + '"');
    next();
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ping endpoint
app.get('/ping', (req, res) => {
    res.json({ status: 'ok' });
});

// Загрузка файлов
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    try {
        const filename = req.file.filename;
        const filepath = path.join(__dirname, 'uploads', filename);
        const mimetype = req.file.mimetype;
        
        // Обработка изображений
        if (mimetype.startsWith('image/')) {
            try {
                // Создаём сжатую версию для быстрой загрузки
                const compressedFilename = `compressed-${filename}`;
                const compressedPath = path.join(__dirname, 'uploads', compressedFilename);
                
                await sharp(filepath)
                    .resize(1920, 1080, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 85, progressive: true })
                    .toFile(compressedPath);
                
                console.log('✅ Изображение обработано:', filename);
            } catch (error) {
                console.log('⚠️ Ошибка обработки изображения:', error.message);
            }
        }
        
        res.set('Content-Type', 'application/json');
        res.json({
            filename: filename,
            originalname: req.file.originalname,
            mimetype: mimetype,
            size: req.file.size,
            url: `/uploads/${filename}`
        });
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        res.status(500).json({ error: 'Ошибка загрузки файла' });
    }
});

// Функция отправки push notifications
function sendPushNotification(subscription, data) {
    try {
        // Для простоты используем встроенный механизм браузера
        // В продакшене нужно использовать web-push библиотеку
        console.log('📢 Push отправлен:', data.title);
    } catch (error) {
        console.error('Ошибка отправки push:', error);
    }
}

// Socket.IO
const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log('👤 Пользователь подключился:', socket.id);
    socket.join('general');
    
    // Регистрация
    socket.on('register', async (data) => {
        try {
            const { username, password } = data;
            
            if (!username || !password) {
                socket.emit('register-response', { success: false, message: 'Заполните все поля' });
                return;
            }
            
            if (username.length < 3 || password.length < 3) {
                socket.emit('register-response', { success: false, message: 'Минимум 3 символа' });
                return;
            }
            
            await pool.query(
                'INSERT INTO users (username, password) VALUES ($1, $2)',
                [username, password]
            );
            
            console.log('✅ Пользователь зарегистрирован:', username);
            socket.emit('register-response', { success: true, message: 'Регистрация успешна' });
            
            const result = await pool.query('SELECT username FROM users');
            const usersList = result.rows.map(u => u.username);
            io.emit('users-list', usersList);
            
        } catch (error) {
            if (error.code === '23505') {
                socket.emit('register-response', { success: false, message: 'Пользователь уже существует' });
            } else {
                socket.emit('register-response', { success: false, message: 'Ошибка БД' });
            }
        }
    });
    
    // Вход
    socket.on('login', async (data) => {
        try {
            const { username, password } = data;
            
            if (!username || !password) {
                socket.emit('login-response', { success: false, message: 'Заполните все поля' });
                return;
            }
            
            const result = await pool.query(
                'SELECT * FROM users WHERE username = $1',
                [username]
            );
            
            if (result.rows.length === 0) {
                socket.emit('login-response', { success: false, message: 'Пользователь не найден' });
                return;
            }
            
            const user = result.rows[0];
            if (user.password !== password) {
                socket.emit('login-response', { success: false, message: 'Неверный пароль' });
                return;
            }
            
            // Обновляем last_online
            await pool.query(
                'UPDATE users SET last_online = CURRENT_TIMESTAMP WHERE username = $1',
                [username]
            );
            
            socket.username = username;
            connectedUsers.set(socket.id, { username, socketId: socket.id });
            
            console.log('✅ Пользователь вошел:', username);
            socket.emit('login-response', { success: true, message: 'Вход успешен' });
            
            // Отправляем список пользователей с информацией об онлайне
            const usersResult = await pool.query('SELECT username, last_online, avatar_url FROM users');
            const onlineUsernames = Array.from(connectedUsers.values()).map(u => u.username);
            const usersList = usersResult.rows.map(u => ({
                username: u.username,
                isOnline: onlineUsernames.includes(u.username),
                lastOnline: u.last_online,
                avatar_url: u.avatar_url
            }));
            socket.emit('users-list', usersList);
            
            // Отправляем онлайн пользователей
            io.emit('online-users', onlineUsernames);
            
            // Отправляем историю общего чата
            const messagesResult = await pool.query(
                'SELECT * FROM messages WHERE is_general = 1 ORDER BY created_at ASC LIMIT 100'
            );
            const messages = messagesResult.rows.map(msg => ({
                id: msg.id.toString(),
                username: msg.from_user,
                message: msg.message,
                filename: msg.filename,
                originalname: msg.originalname,
                url: msg.url,
                mimetype: msg.mimetype,
                caption: msg.caption,
                timestamp: msg.created_at,
                type: msg.type,
                readStatus: msg.read_status
            }));
            socket.emit('load-general-messages', messages);
            
            io.to('general').emit('user-status-changed', { username: username, status: 'online' });
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            socket.emit('login-response', { success: false, message: 'Ошибка сервера' });
        }
    });
    
    // Загрузка приватных сообщений
    socket.on('load-private-messages', async (data) => {
        try {
            const currentUser = socket.username;
            const otherUser = data.username;
            
            if (!currentUser) return;
            
            const result = await pool.query(
                `SELECT * FROM messages 
                 WHERE is_general = 0 AND 
                 ((from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1))
                 ORDER BY created_at ASC LIMIT 100`,
                [currentUser, otherUser]
            );
            
            const messages = result.rows.map(msg => ({
                id: msg.id.toString(),
                from: msg.from_user,
                to: msg.to_user,
                message: msg.message,
                filename: msg.filename,
                originalname: msg.originalname,
                url: msg.url,
                mimetype: msg.mimetype,
                caption: msg.caption,
                timestamp: msg.created_at,
                type: msg.type
            }));
            
            socket.emit('private-messages-loaded', messages);
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
        }
    });
    
    // Загрузка общего чата
    socket.on('load-general-chat', async (data) => {
        try {
            const result = await pool.query(
                'SELECT * FROM messages WHERE is_general = 1 ORDER BY created_at ASC LIMIT 100'
            );
            
            const messages = result.rows.map(msg => ({
                id: msg.id.toString(),
                username: msg.from_user,
                message: msg.message,
                filename: msg.filename,
                originalname: msg.originalname,
                url: msg.url,
                mimetype: msg.mimetype,
                caption: msg.caption,
                timestamp: msg.created_at,
                type: msg.type
            }));
            
            socket.emit('load-general-messages', messages);
        } catch (error) {
            console.error('Ошибка загрузки общего чата:', error);
        }
    });
    
    // Отправка сообщения в общий чат
    socket.on('send-message', async (data) => {
        try {
            const username = socket.username;
            if (!username) return;
            
            const result = await pool.query(
                `INSERT INTO messages (from_user, to_user, message, type, is_general, read_status) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [username, 'general', data.message, 'text', 1, 0]
            );
            
            const formattedMessage = {
                id: result.rows[0].id.toString(),
                username: username,
                message: data.message,
                timestamp: new Date().toLocaleString('ru-RU'),
                type: 'text',
                readStatus: 0
            };
            
            io.to('general').emit('new-message', formattedMessage);
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
        }
    });
    
    // Отправка файла в общий чат
    socket.on('send-file', async (data) => {
        try {
            const username = socket.username;
            if (!username) return;
            
            const result = await pool.query(
                `INSERT INTO messages (from_user, to_user, filename, originalname, url, mimetype, caption, type, is_general, read_status) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [username, 'general', data.filename, data.originalname, data.url, data.mimetype, data.caption || '', 'file', 1, 0]
            );
            
            const formattedMessage = {
                id: result.rows[0].id.toString(),
                username: username,
                filename: data.filename,
                originalname: data.originalname,
                url: data.url,
                mimetype: data.mimetype,
                caption: data.caption || '',
                timestamp: new Date().toLocaleString('ru-RU'),
                type: 'file',
                readStatus: 0
            };
            
            io.to('general').emit('new-message', formattedMessage);
        } catch (error) {
            console.error('Ошибка отправки файла:', error);
        }
    });
    
    // Удаление сообщения
    socket.on('delete-message', async (data) => {
        try {
            await pool.query('DELETE FROM messages WHERE id = $1', [data.id]);
            io.emit('message-deleted', { id: data.id });
        } catch (error) {
            console.error('Ошибка удаления сообщения:', error);
        }
    });
    
    // Приватное сообщение
    socket.on('send-private-message', async (data) => {
        try {
            const senderUsername = socket.username;
            if (!senderUsername) return;
            
            const { recipientUsername, message } = data;
            
            const result = await pool.query(
                `INSERT INTO messages (from_user, to_user, message, type, is_general, read_status) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [senderUsername, recipientUsername, message, 'text', 0, 0]
            );
            
            let recipientSocketId = null;
            let recipientUser = null;
            for (const [socketId, user] of connectedUsers.entries()) {
                if (user.username === recipientUsername) {
                    recipientSocketId = socketId;
                    recipientUser = user;
                    break;
                }
            }
            
            const formattedMessage = {
                id: result.rows[0].id.toString(),
                from: senderUsername,
                to: recipientUsername,
                message: message,
                timestamp: new Date().toLocaleString('ru-RU'),
                type: 'text',
                readStatus: 0
            };
            
            socket.emit('private-message', formattedMessage);
            
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('private-message', formattedMessage);
            } else if (recipientUser && recipientUser.pushSubscription) {
                // Отправляем push notification если пользователь офлайн
                sendPushNotification(recipientUser.pushSubscription, {
                    title: `Сообщение от ${senderUsername}`,
                    body: message.substring(0, 100),
                    tag: `message-${senderUsername}`
                });
            }
        } catch (error) {
            console.error('Ошибка отправки приватного сообщения:', error);
        }
    });
    
    // Приватный файл
    socket.on('send-private-file', async (data) => {
        try {
            const senderUsername = socket.username;
            if (!senderUsername) return;
            
            const { recipientUsername, filename, originalname, url, mimetype, caption } = data;
            
            const result = await pool.query(
                `INSERT INTO messages (from_user, to_user, filename, originalname, url, mimetype, caption, type, is_general, read_status) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [senderUsername, recipientUsername, filename, originalname, url, mimetype, caption || '', 'file', 0, 0]
            );
            
            let recipientSocketId = null;
            for (const [socketId, user] of connectedUsers.entries()) {
                if (user.username === recipientUsername) {
                    recipientSocketId = socketId;
                    break;
                }
            }
            
            const formattedMessage = {
                id: result.rows[0].id.toString(),
                from: senderUsername,
                to: recipientUsername,
                filename: filename,
                originalname: originalname,
                url: url,
                mimetype: mimetype,
                caption: caption || '',
                timestamp: new Date().toLocaleString('ru-RU'),
                type: 'file',
                readStatus: 0
            };
            
            socket.emit('private-message', formattedMessage);
            
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('private-message', formattedMessage);
            }
        } catch (error) {
            console.error('Ошибка отправки приватного файла:', error);
        }
    });
    
    // Отметить сообщение как прочитанное
    socket.on('mark-as-read', async (data) => {
        try {
            await pool.query(
                'UPDATE messages SET read_status = 2 WHERE id = $1',
                [data.id]
            );
            
            // Отправляем обновление всем
            io.emit('message-read', { id: data.id });
        } catch (error) {
            console.error('Ошибка отметки прочитанности:', error);
        }
    });
    
    // Получить данные профиля
    socket.on('get-profile', async (data) => {
        try {
            const result = await pool.query(
                'SELECT avatar_url, status_text FROM users WHERE username = $1',
                [data.username]
            );
            
            if (result.rows.length > 0) {
                socket.emit('profile-data', {
                    avatar_url: result.rows[0].avatar_url,
                    status_text: result.rows[0].status_text || ''
                });
            }
        } catch (error) {
            console.error('Ошибка получения профиля:', error);
        }
    });
    
    // Обновить аватарку
    socket.on('update-avatar', async (data) => {
        try {
            await pool.query(
                'UPDATE users SET avatar_url = $1 WHERE username = $2',
                [data.avatar_url, data.username]
            );
            console.log('✅ Аватарка обновлена:', data.username);
        } catch (error) {
            console.error('Ошибка обновления аватарки:', error);
        }
    });
    
    // Обновить профиль
    socket.on('update-profile', async (data) => {
        try {
            const { oldUsername, newUsername, status_text } = data;
            
            // Проверяем что новое имя не занято
            if (oldUsername !== newUsername) {
                const checkResult = await pool.query(
                    'SELECT username FROM users WHERE username = $1',
                    [newUsername]
                );
                
                if (checkResult.rows.length > 0) {
                    socket.emit('profile-updated', { success: false, message: 'Это имя уже занято' });
                    return;
                }
                
                // Обновляем имя везде
                await pool.query(
                    'UPDATE users SET username = $1 WHERE username = $2',
                    [newUsername, oldUsername]
                );
                
                await pool.query(
                    'UPDATE messages SET from_user = $1 WHERE from_user = $2',
                    [newUsername, oldUsername]
                );
                
                await pool.query(
                    'UPDATE messages SET to_user = $1 WHERE to_user = $2',
                    [newUsername, oldUsername]
                );
            }
            
            // Обновляем статус
            await pool.query(
                'UPDATE users SET status_text = $1 WHERE username = $2',
                [status_text, newUsername || oldUsername]
            );
            
            socket.emit('profile-updated', { success: true, newUsername: newUsername || oldUsername });
            console.log('✅ Профиль обновлен:', newUsername || oldUsername);
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            socket.emit('profile-updated', { success: false, message: 'Ошибка сервера' });
        }
    });
    
    // Подписка на push notifications
    socket.on('subscribe-to-push', async (data) => {
        try {
            const { username, subscription } = data;
            
            // Сохраняем подписку в памяти (в продакшене нужна БД)
            if (!connectedUsers.has(socket.id)) {
                connectedUsers.set(socket.id, { username, socketId: socket.id });
            }
            
            const user = connectedUsers.get(socket.id);
            user.pushSubscription = subscription;
            
            console.log('✅ Push подписка получена:', username);
        } catch (error) {
            console.error('Ошибка подписки на push:', error);
        }
    });
    
    // Отключение
    socket.on('disconnect', () => {
        console.log('👤 Пользователь отключился:', socket.id);
        const username = socket.username;
        
        connectedUsers.delete(socket.id);
        
        if (username) {
            const onlineUsers = Array.from(connectedUsers.values()).map(u => u.username);
            io.emit('online-users', onlineUsers);
            
            io.to('general').emit('user-status-changed', { 
                username: username, 
                status: 'offline' 
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер Родня запущен на порту ${PORT}`);
});

// Автопинг каждые 10 минут, чтобы сервер не засыпал на Render
setInterval(() => {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    
    fetch(`${host}/ping`)
        .then(res => res.json())
        .then(() => console.log('✅ Автопинг отправлен'))
        .catch(err => console.log('⚠️ Ошибка автопинга:', err.message));
}, 10 * 60 * 1000);

process.on('SIGINT', () => {
    console.log('Закрытие БД...');
    pool.end();
    process.exit(0);
});
