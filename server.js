const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// SQLite БД
const db = new sqlite3.Database('./rodnya.db', (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err.message);
        process.exit(1);
    }
    console.log('✅ Подключено к SQLite БД');
    initializeDB();
});

// Инициализация БД
function initializeDB() {
    // Таблица пользователей
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Ошибка создания таблицы users:', err);
        else console.log('✅ Таблица users готова');
    });

    // Таблица сообщений
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fromUser TEXT NOT NULL,
            toUser TEXT NOT NULL,
            message TEXT,
            filename TEXT,
            originalname TEXT,
            url TEXT,
            mimetype TEXT,
            caption TEXT,
            type TEXT DEFAULT 'text',
            isGeneral INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Ошибка создания таблицы messages:', err);
        else console.log('✅ Таблица messages готова');
    });
}

// Создаем папку для загрузок если её нет
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Настройка multer для загрузки файлов
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
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB лимит
    }
});

// Статические файлы
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Отключаем кеш для HTML
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Загрузка файлов
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    res.json({
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`
    });
});

// Socket.IO для реального времени
const connectedUsers = new Map(); // socket.id -> {username, socketId}

io.on('connection', (socket) => {
    console.log('👤 Пользователь подключился:', socket.id);
    console.log('📊 Всего подключено:', connectedUsers.size + 1);
    
    // Присоединение к общему чату
    socket.join('general');
    
    // Регистрация пользователя
    socket.on('register', (data) => {
        try {
            const { username, password } = data;
            
            console.log('Попытка регистрации:', username);
            
            if (!username || !password) {
                console.log('❌ Пустые поля');
                socket.emit('register-response', { success: false, message: 'Заполните все поля' });
                return;
            }
            
            if (username.length < 3) {
                console.log('❌ Имя слишком короткое');
                socket.emit('register-response', { success: false, message: 'Имя должно быть минимум 3 символа' });
                return;
            }
            
            if (password.length < 3) {
                console.log('❌ Пароль слишком короткий');
                socket.emit('register-response', { success: false, message: 'Пароль должен быть минимум 3 символа' });
                return;
            }
            
            // Создаем нового пользователя
            db.run(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                [username, password],
                function(err) {
                    if (err) {
                        console.error('❌ Ошибка БД при регистрации:', err.message);
                        console.error('Полная ошибка:', err);
                        
                        if (err.message.includes('UNIQUE constraint failed')) {
                            console.log('❌ Пользователь уже существует:', username);
                            socket.emit('register-response', { success: false, message: 'Пользователь уже существует' });
                        } else {
                            socket.emit('register-response', { success: false, message: 'Ошибка БД: ' + err.message });
                        }
                    } else {
                        console.log('✅ Пользователь зарегистрирован:', username);
                        socket.emit('register-response', { success: true, message: 'Регистрация успешна' });
                        
                        // Отправляем обновленный список пользователей всем
                        db.all('SELECT username FROM users', (err, users) => {
                            if (!err && users) {
                                const usersList = users.map(u => u.username);
                                io.emit('users-list', usersList);
                            }
                        });
                    }
                }
            );
        } catch (error) {
            console.error('❌ Ошибка регистрации (catch):', error.message);
            console.error('Полная ошибка:', error);
            socket.emit('register-response', { success: false, message: 'Ошибка сервера: ' + error.message });
        }
    });
    
    // Вход пользователя
    socket.on('login', (data) => {
        try {
            const { username, password } = data;
            
            console.log('Попытка входа:', username);
            
            if (!username || !password) {
                socket.emit('login-response', { success: false, message: 'Заполните все поля' });
                return;
            }
            
            // Ищем пользователя в БД
            db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, user) => {
                    if (err) {
                        console.error('❌ Ошибка БД при входе:', err.message);
                        console.error('Полная ошибка:', err);
                        socket.emit('login-response', { success: false, message: 'Ошибка БД: ' + err.message });
                        return;
                    }
                    
                    if (!user) {
                        console.log('❌ Пользователь не найден:', username);
                        socket.emit('login-response', { success: false, message: 'Пользователь не найден' });
                        return;
                    }
                    
                    if (user.password !== password) {
                        console.log('❌ Неверный пароль для:', username);
                        socket.emit('login-response', { success: false, message: 'Неверный пароль' });
                        return;
                    }
                    
                    // Сохраняем сессию
                    socket.username = username;
                    connectedUsers.set(socket.id, { username, socketId: socket.id });
                    
                    console.log('✅ Пользователь вошел:', username);
                    socket.emit('login-response', { success: true, message: 'Вход успешен' });
                    
                    // Отправляем список всех пользователей
                    db.all('SELECT username FROM users', (err, users) => {
                        if (err) {
                            console.error('❌ Ошибка при загрузке списка пользователей:', err.message);
                        } else if (users) {
                            const usersList = users.map(u => u.username);
                            socket.emit('users-list', usersList);
                        }
                    });
                    
                    // Отправляем список онлайн пользователей
                    const onlineUsers = Array.from(connectedUsers.values()).map(u => u.username);
                    io.emit('online-users', onlineUsers);
                    
                    // Отправляем историю общего чата
                    db.all(
                        'SELECT * FROM messages WHERE isGeneral = 1 ORDER BY createdAt ASC LIMIT 100',
                        (err, messages) => {
                            if (err) {
                                console.error('❌ Ошибка при загрузке сообщений:', err.message);
                            } else if (messages) {
                                const formattedMessages = messages.map(msg => ({
                                    id: msg.id.toString(),
                                    username: msg.fromUser,
                                    message: msg.message,
                                    filename: msg.filename,
                                    originalname: msg.originalname,
                                    url: msg.url,
                                    mimetype: msg.mimetype,
                                    caption: msg.caption,
                                    timestamp: msg.createdAt,
                                    type: msg.type
                                }));
                                socket.emit('load-general-messages', formattedMessages);
                            }
                        }
                    );
                    
                    // Уведомляем всех что пользователь онлайн
                    io.to('general').emit('user-status', { 
                        username: username, 
                        status: 'online' 
                    });
                }
            );
        } catch (error) {
            console.error('❌ Ошибка входа (catch):', error.message);
            console.error('Полная ошибка:', error);
            socket.emit('login-response', { success: false, message: 'Ошибка сервера: ' + error.message });
        }
    });
    
    // Загрузка истории приватного чата
    socket.on('load-private-messages', (data) => {
        try {
            const currentUser = socket.username;
            const otherUser = data.username;
            
            if (!currentUser) return;
            
            db.all(
                `SELECT * FROM messages 
                 WHERE isGeneral = 0 AND 
                 ((fromUser = ? AND toUser = ?) OR (fromUser = ? AND toUser = ?))
                 ORDER BY createdAt ASC LIMIT 100`,
                [currentUser, otherUser, otherUser, currentUser],
                (err, messages) => {
                    if (!err && messages) {
                        const formattedMessages = messages.map(msg => ({
                            id: msg.id.toString(),
                            from: msg.fromUser,
                            to: msg.toUser,
                            message: msg.message,
                            filename: msg.filename,
                            originalname: msg.originalname,
                            url: msg.url,
                            mimetype: msg.mimetype,
                            caption: msg.caption,
                            timestamp: msg.createdAt,
                            type: msg.type
                        }));
                        socket.emit('private-messages-loaded', formattedMessages);
                    }
                }
            );
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
        }
    });
    
    // Обработка сообщений в общий чат
    socket.on('send-message', (data) => {
        try {
            const username = socket.username;
            if (!username) return;
            
            db.run(
                `INSERT INTO messages (fromUser, toUser, message, type, isGeneral) 
                 VALUES (?, ?, ?, ?, ?)`,
                [username, 'general', data.message, 'text', 1],
                function(err) {
                    if (!err) {
                        const formattedMessage = {
                            id: this.lastID.toString(),
                            username: username,
                            message: data.message,
                            timestamp: new Date().toLocaleString('ru-RU'),
                            type: 'text'
                        };
                        io.to('general').emit('new-message', formattedMessage);
                    }
                }
            );
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
        }
    });
    
    // Обработка файлов в общий чат
    socket.on('send-file', (data) => {
        try {
            const username = socket.username;
            if (!username) return;
            
            db.run(
                `INSERT INTO messages (fromUser, toUser, filename, originalname, url, mimetype, caption, type, isGeneral) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [username, 'general', data.filename, data.originalname, data.url, data.mimetype, data.caption || '', 'file', 1],
                function(err) {
                    if (!err) {
                        const formattedMessage = {
                            id: this.lastID.toString(),
                            username: username,
                            filename: data.filename,
                            originalname: data.originalname,
                            url: data.url,
                            mimetype: data.mimetype,
                            caption: data.caption || '',
                            timestamp: new Date().toLocaleString('ru-RU'),
                            type: 'file'
                        };
                        io.to('general').emit('new-message', formattedMessage);
                    }
                }
            );
        } catch (error) {
            console.error('Ошибка отправки файла:', error);
        }
    });
    
    // Удаление сообщения
    socket.on('delete-message', (data) => {
        try {
            db.run('DELETE FROM messages WHERE id = ?', [data.id], (err) => {
                if (!err) {
                    io.emit('message-deleted', { id: data.id });
                }
            });
        } catch (error) {
            console.error('Ошибка удаления сообщения:', error);
        }
    });
    
    // Личные сообщения
    socket.on('send-private-message', (data) => {
        try {
            const senderUsername = socket.username;
            if (!senderUsername) return;
            
            const { recipientUsername, message } = data;
            
            db.run(
                `INSERT INTO messages (fromUser, toUser, message, type, isGeneral) 
                 VALUES (?, ?, ?, ?, ?)`,
                [senderUsername, recipientUsername, message, 'text', 0],
                function(err) {
                    if (!err) {
                        // Находим socket ID получателя
                        let recipientSocketId = null;
                        for (const [socketId, user] of connectedUsers.entries()) {
                            if (user.username === recipientUsername) {
                                recipientSocketId = socketId;
                                break;
                            }
                        }
                        
                        const formattedMessage = {
                            id: this.lastID.toString(),
                            from: senderUsername,
                            to: recipientUsername,
                            message: message,
                            timestamp: new Date().toLocaleString('ru-RU'),
                            type: 'text'
                        };
                        
                        // Отправляем отправителю
                        socket.emit('private-message', formattedMessage);
                        
                        // Отправляем получателю если онлайн
                        if (recipientSocketId) {
                            io.to(recipientSocketId).emit('private-message', formattedMessage);
                        }
                    }
                }
            );
        } catch (error) {
            console.error('Ошибка отправки приватного сообщения:', error);
        }
    });
    
    // Личные файлы
    socket.on('send-private-file', (data) => {
        try {
            const senderUsername = socket.username;
            if (!senderUsername) return;
            
            const { recipientUsername, filename, originalname, url, mimetype, caption } = data;
            
            db.run(
                `INSERT INTO messages (fromUser, toUser, filename, originalname, url, mimetype, caption, type, isGeneral) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [senderUsername, recipientUsername, filename, originalname, url, mimetype, caption || '', 'file', 0],
                function(err) {
                    if (!err) {
                        // Находим socket ID получателя
                        let recipientSocketId = null;
                        for (const [socketId, user] of connectedUsers.entries()) {
                            if (user.username === recipientUsername) {
                                recipientSocketId = socketId;
                                break;
                            }
                        }
                        
                        const formattedMessage = {
                            id: this.lastID.toString(),
                            from: senderUsername,
                            to: recipientUsername,
                            filename: filename,
                            originalname: originalname,
                            url: url,
                            mimetype: mimetype,
                            caption: caption || '',
                            timestamp: new Date().toLocaleString('ru-RU'),
                            type: 'file'
                        };
                        
                        // Отправляем отправителю
                        socket.emit('private-message', formattedMessage);
                        
                        // Отправляем получателю если онлайн
                        if (recipientSocketId) {
                            io.to(recipientSocketId).emit('private-message', formattedMessage);
                        }
                    }
                }
            );
        } catch (error) {
            console.error('Ошибка отправки приватного файла:', error);
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
            
            io.to('general').emit('user-status', { 
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

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Закрытие БД...');
    db.close();
    process.exit(0);
});