const express = require('express');
const { createServer } = require('http');
const jwt = require("jsonwebtoken");
const { expressjwt } = require('express-jwt');
const { v4: uuidv4 } = require('uuid');
// WebSocket
// require('./websocket');

// Express
const app = express();
app.use(express.json());
// Create Http Server
const httpServer = createServer(app);

// token secretKey
const secretKey = 'DEMO';
// 暫存用戶放置處
const users = [];

// Handling expired tokens
app.use(expressjwt({
     secret: secretKey,
     algorithms: ['HS256'],
     onExpired: async (req, err) => {
        if (new Date() - err.inner.expiredAt < 5000) { return; }
        throw err;
    }}
).unless({ path: [/^\/api\//] }));

// Error handling
app.use((err, req, res, next) => {
    if (err.name === "UnauthorizedError") {
        res.status(401).send("invalid token...");
    } else {
        next(err);
    }
});

/** Login Api */
app.post('/api/login', (req, res) => {
    const payload = req.body;
    const {username, password} = payload;

    try {
        const user = users.find(data => data.username === username);
        if(!user) throw new Error('查無用戶');
    
        if(user.password !== password) throw new Error('密碼錯誤');
        
        const userData = {
            uuid: user.uuid,
            username: user.username,
            nickname: user.nickname,
        };

        const token = jwt.sign(userData, secretKey, { expiresIn: '9999999s' });
    
        return res.status(200).send({
            message: "登入成功!",
            token,
        });
    } catch(e) {
        return res.status(400).send({
            message: e.message,
        });
    }
})

/** Register User Api */
app.post('/api/register', (req, res) => {
    const payload = req.body;
    const { username, password, nickname } = payload;

    try {
        if(!username || !password || !nickname) throw new Error('資料錯誤');

        // Find User
        const hasUser = users.some(user => user.username === username);
        // Validate
        if(hasUser) throw new Error('已有相同用戶，無法建立');
        // Create User
        const user = {
            uuid: uuidv4(),
            username: username,
            password: password,
            nickname: nickname
        }
        users.push(user);

        const userData = {
            uuid: user.uuid,
            username: user.username,
            nickname: user.nickname,
        };

        const token = jwt.sign(userData, secretKey, { expiresIn: '9999999s' });
    
        return res.status(200).send({
            message: "註冊成功!",
            token,
        });
    } catch(e) {
        return res.status(400).send({
            message: e.message,
        });
    }
})

/** Get User Api */
app.get("/user", (req, res) => {
	return res.status(200).send({
		message: "獲取使用者資料成功",
		data: req.auth
	});
});

// Http Respond
app.use('/', (req, res) => res.status(200).send('HEALTHY'));

// Server listen
httpServer.listen(3000, () => {
    console.log('listening on *:3000');
});