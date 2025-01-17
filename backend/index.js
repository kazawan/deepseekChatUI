import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import OpenAI from "openai";
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { mkdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
dotenv.config({ path: resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// 确保数据目录存在
const DATA_DIR = './data';
try {
    await mkdir(DATA_DIR, { recursive: true });
} catch (error) {
    if (error.code !== 'EEXIST') {
        console.error('创建数据目录失败:', error);
    }
}

// 初始化数据库
const DB_PATH = join(DATA_DIR, 'db.json');
const adapter = new JSONFile(DB_PATH);
const db = new Low(adapter, { tokens: { balance: 0, usage: 0 } });

// 读取数据库
await db.read();

const openai = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL,
    apiKey: process.env.DEEPSEEK_API_KEY
});

// 获取token数据
function getTokenData() {
    return {
        balance: db.data.tokens.balance,
        usage: db.data.tokens.usage
    };
}

// 更新token数据
async function updateTokenData(balance = null, usage = null) {
    if (balance !== null) {
        db.data.tokens.balance = balance;
    }
    if (usage !== null) {
        db.data.tokens.usage = usage;
    }
    await db.write();
    return getTokenData();
}

// token余额接口
app.get('/token_balance', async (req, res) => {
    const tokenData = getTokenData();
    res.json(tokenData);
});

// 设置token余额接口
app.post('/set_token_balance', async (req, res) => {
    const { balance } = req.body;
    if (typeof balance === 'number' && balance >= 0) {
        const tokenData = await updateTokenData(Math.floor(balance));
        res.json({ 
            success: true,
            ...tokenData
        });
    } else {
        res.status(400).json({ 
            error: 'Invalid balance value',
            message: '请提供有效的数字（大于等于0）'
        });
    }
});

// 重置token消耗
app.post('/reset_token_usage', async (req, res) => {
    const tokenData = await updateTokenData(null, 0);
    res.json({ 
        success: true,
        ...tokenData
    });
});

app.post('/deepseek', async (req, res) => {
    try {
        const { message } = req.body;
        
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: message }],
            model: "deepseek-chat",
            temperature: 0.7,
            max_tokens: 2000,
            top_p: 0.95,
            presence_penalty: 0,
            frequency_penalty: 0
        });

        res.json({
            response: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

app.post('/deepseek_stream', async (req, res) => {
    try {
        const { message } = req.body;
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await openai.chat.completions.create({
            messages: [{ role: "user", content: message }],
            model: "deepseek-chat",
            stream: true,
            temperature: 0.7,
            max_tokens: 2000,
            top_p: 0.95,
            presence_penalty: 0,
            frequency_penalty: 0
        });

        let hasEnded = false;
        let messageTokens = 0;
        let tokenData = getTokenData();

        req.on('close', () => {
            hasEnded = true;
            res.end();
            console.log('Client closed connection');
        });

        req.on('data', chunk => {
            const data = chunk.toString().trim();
            if (data === '{"stop": true}') {
                hasEnded = true;
                res.end();
                console.log('Stream stopped by client');
            }
        });

        try {
            for await (const chunk of stream) {
                if (hasEnded) {
                    break;
                }
                const content = chunk.choices[0]?.delta?.content || '';
                
                // 简单估算token数量（每个汉字2个token，每个英文单词1个token）
                const chineseCount = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
                const englishCount = (content.match(/[a-zA-Z]+/g) || []).length;
                const newTokens = (chineseCount * 2) + englishCount;
                messageTokens += newTokens;
                
                // 更新数据库中的使用量并获取最新数据
                tokenData = await updateTokenData(null, tokenData.usage + newTokens);
                // console.log('Token update:', { newTokens, messageTokens, tokenData });

                res.write(`data: ${JSON.stringify({ 
                    content,
                    remaining: tokenData.balance,
                    tokens: messageTokens,
                    totalUsage: tokenData.usage
                })}\n\n`);
            }

            // 确保最后一次更新被发送
            tokenData = await updateTokenData(null, tokenData.usage);
            res.write(`data: ${JSON.stringify({ 
                content: '[DONE]',
                remaining: tokenData.balance,
                tokens: messageTokens,
                totalUsage: tokenData.usage
            })}\n\n`);

        } catch (error) {
            console.error('Stream processing error:', error);
            // 发送错误信息到客户端
            res.write(`data: ${JSON.stringify({ 
                error: 'Stream processing error',
                message: error.message
            })}\n\n`);
        }

        if (!hasEnded) {
            res.end();
        }
    } catch (error) {
        console.error('Stream creation error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.post('/chat_stop', (req, res) => {
    console.log('Received stop request');
    res.json({ status: 'stopped' });
});

const PORT = process.env.BACKEND_PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
