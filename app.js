const express = require('express');
const { createServer } = require('http');
const { Server } = require("socket.io");
var cors = require('cors');
const cookieParser = require('cookie-parser')
const { expressjwt } = require('express-jwt');
const { v4: uuidv4 } = require('uuid');
// const cors = require('cors');
const jwt = require("jsonwebtoken");
const { ClientMessageType } = require("./socketType");

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
const users = [];
const messages = [
    { name: "Majer", message: "Welcome!"  }
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
//             if (err) {
//               return next(new Error('Authentication error'))
//             }
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
    console.log('user connected')
    // 發送之前的全部訊息
    io.emit("allMessage", messages)
    // 當此用戶發送訊息的時候，先把新訊息放到 messages 陣列裡面
    // 再 emit 給所有用戶
    socket.on("sendMessage", function (message) {
        console.log(message)
        messages.push(message)
        io.emit("newMessage", message)
    })

    // // 向所有人廣播更新目前最新的 Users
    // const updateUsers = () => {
    //     io.sockets.emit('users', users);
    // }

    // // Create User
    // socket.on(ClientMessageType.Login, (username) => {
    //     if(users.indexOf(username) < 0) {
    //         // 向 Client Side 發送訊息
    //         socket.emit('chat', 'SERVER', '歡迎光臨 ' + username);
    //         // Socket 設定 Client Username
    //         socket.username = username;
    //         // 插入新的 username 到 users
    //         users.push(socket.username);
    //         // 向所有人廣播更新目前最新的 Users
    //         updateUsers();
    //     }
    // });

    // // 向所有 Client 發送訊息
    // socket.on(ClientMessageType.Message, (message) => {
    //     io.sockets.emit('newMessage', { msg: message, nick: socket.username });
    // });

    // Client 斷線
    socket.on('disconnect', (data) => {
        if (!socket.username) return;
        io.sockets.emit('chat', 'SERVER', socket.username + ' 離開了聊天室～');
        // 移除 username 從 users
        users.splice(users.indexOf(socket.username), 1);
        // 向所有人廣播更新目前最新的 Users
        updateUsers();
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
        return res.status(400).send({
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
	return res.status(200).send({
		message: "獲取使用者資料成功",
		data: {
            uuid: auth.uuid,
            username: auth.username,
            nickname: auth.nickname
        }
	});
});

// Http Respond
app.use('/', (req, res) => res.status(200).send('HEALTHY'));