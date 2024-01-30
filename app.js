const express = require('express');
const { createServer } = require('http');
const { Server } = require("socket.io");
var cors = require('cors');
const cookieParser = require('cookie-parser')
const { expressjwt } = require('express-jwt');
const { v4: uuidv4 } = require('uuid');
// const cors = require('cors');
const jwt = require("jsonwebtoken");
const { SocketEventType, SocketEmitEventType } = require("./socketType");

// WebSocket
// require('./websocket');

// Express
const app = express();
app.use(cookieParser('123456'));
app.use(express.json());

const corsOptions = {
    "origin": "http://127.0.0.1:5173",
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}
app.use(cors(corsOptions));

// Http & Socket port
const httpServer = createServer(app);
httpServer.listen(3000);

// Token secretKey
const secretKey = 'DEMO';
// 暫存用戶放置處
const users = [
    {
        uuid: uuidv4(),
        username: "admin",
        password: "a123456",
        nickname: "系統"
    },
    {
        uuid: uuidv4(),
        username: "guest1",
        password: "guest1",
        nickname: "訪客1"
    },
    {
        uuid: uuidv4(),
        username: "guest2",
        password: "guest2",
        nickname: "訪客2"
    },
    {
        uuid: uuidv4(),
        username: "guest3",
        password: "guest3",
        nickname: "訪客3"
    },
];
// 在線用戶
const onlineUsers = [];
// 所有訊息
const messages = [
    { id: 1, username: 'admin', nickname: "系統", message: "Welcome!", created_at: new Date().toISOString() }
]

/**---------------------------------
 *  Socket.io
 *----------------------------------
 */

// Create Socket.io Server
const io = new Server(httpServer, {
    cors: {
      origin: ["http://127.0.0.1:5500", "http://127.0.0.1:5173"]
    }
});

// Socket Connect
// io.use((socket, next) => {
//     if (socket.handshake.headers.authorization) {
//         jwt.verify(  //jsonwebtoken用看是否有被串改的method
//           socket.handshake.headers.authorization,  // 包在query 禮也可以在這看到socket.handshake.query 
//           secretKey, //這是妳簽章的secret
//           async (err, decoded) => {
//             //認證失敗
//             if (err) return next(new Error('Authentication error'));

//             //認證成功
//             socket.decoded = decoded // 把解出來資訊做利用
//             console.log(decoded)
//             //。。。(看你要做啥)
//             return next()
//           }
//         )
//       }
// })
io.on("connection", (socket) => {
    // allMessage: 向用戶發送之前的全部訊息
    socket.emit(SocketEmitEventType.AllMessage, messages);
    // onlineUsers: 向所有人廣播更新目前最新的線上用戶
    socket.emit(SocketEmitEventType.OnlineUsers, onlineUsers);

    // subscribe: 連線時訂閱用戶 
    socket.on(SocketEventType.Subscribe, (uuid) => {
        // 檢查 User
        const user = users.find(data => data.uuid === uuid);
        if(!user) return;

        // Socket 訂閱 User
        socket.user = user;

        // 檢查是否已在在線用戶名單上
        const isInOnlineUser = onlineUsers.some(data => user.username === data.username);
        if(!isInOnlineUser) {
            // User 加入 Online 名單中
            const userData = {
                username: user.username,
                nickname: user.nickname
            }
            onlineUsers.push(userData);

            // newOnlineUser: 向所有人發送新用戶訂閱
            io.emit(SocketEmitEventType.NewOnlineUser, userData);
        }
    });

    // sendMessage: 當此用戶發送訊息的時候，先把新訊息放到 messages 陣列裡面, 再 emit 給所有用戶
    socket.on(SocketEventType.SendMessage, function (message) {
        if(!socket.user) return;
        // 重新封裝訊息
        const userMessage = {
            id: messages.length+1,
            username: socket.user.username,
            nickname: socket.user.nickname,
            message: message,
            created_at: new Date().toISOString()
        }
        // 把新訊息放到 messages 陣列裡面
        messages.push(userMessage);
        // emit 給所有用戶
        io.emit("newMessage", userMessage);
    });

    // disconnect: Client 斷線
    socket.on(SocketEventType.Disconnect, (data) => {
        if (!socket.user) return;
        // 移除 username 從 Online Users
        const findOnlineUserIndex = onlineUsers.findIndex(onlineUser => onlineUser.username === socket.user.username);
        if (findOnlineUserIndex !== -1) {
            onlineUsers.splice(findOnlineUserIndex, 1);
        }
        socket.user = undefined;
        io.sockets.emit(SocketEmitEventType.OnlineUsers, onlineUsers);
    });
});


/**---------------------------------
 * Express Middleware
 *----------------------------------
 */

// Handling expired tokens
app.use(expressjwt({
     secret: secretKey,
     algorithms: ['HS256'],
     getToken: (req) => {
        const token = req.cookies.accessToken;
        if (token) {
          return token;
        }
        return null;
      },
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


/**---------------------------------
 *  Api
 *----------------------------------
 */

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

        const token = jwt.sign(userData, secretKey, { expiresIn: '2 days' });
    
        res.cookie('accessToken', token, { httpOnly: true, maxAge: 60*1000*60*24, sameSite: 'none', secure: true });

        res.status(200).send({
            message: "註冊成功!",
            token,
        });
    } catch(e) {
        res.status(400).send({
            message: e.message,
        });
    }
})

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

        const token = jwt.sign(userData, secretKey, { expiresIn: '2 days' });
    
        res.cookie('accessToken', token, { httpOnly: true, maxAge: 60*1000*60*24, sameSite: 'none', secure: true });

        res.status(200).send({
            message: "登入成功!",
            token,
        });
    } catch(e) {
        res.status(400).send({
            message: e.message,
        });
    }
})

/** Logout Api */
app.post('/logout', (req, res) => {
    res.setHeader('Clear-Site-Data', '"cookies"');
    res.status(200).send({ message: 'You are logged out!' });
})

/** Get User Api */
app.get("/user", (req, res) => {
    const auth = req.auth;

    try {
        const user = users.find(data => data.username === auth.username);
        if(!user) throw new Error('查無用戶');

        res.status(200).send({
            message: "獲取使用者資料成功",
            data: {
                uuid: auth.uuid,
                username: auth.username,
                nickname: auth.nickname
            }
        });
    } catch (error) {
        res.status(401).send({
            message: error.message,
        });
    }
});

// Http Respond
app.use('/', (req, res) => res.status(200).send('HEALTHY'));