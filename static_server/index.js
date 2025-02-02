const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.FRONTEND_PORT || 3030;

// CORS 配置
app.use(cors({
    origin: process.env.VITE_API_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 基本认证配置
app.use(basicAuth({
    users: { [process.env.AUTH_USER]: process.env.AUTH_PASS },
    challenge: true,
    realm: 'Restricted Access',
    unauthorizedResponse: 'Access Denied'
}));

// 提供静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 处理 404
app.use((req, res) => {
    res.status(404).send('Page Not Found');
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
}); 