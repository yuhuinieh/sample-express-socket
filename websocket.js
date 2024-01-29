const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { expressjwt } = require('express-jwt');
const { ClientMessageType } = require('./socketType');

const wss = new WebSocket.Server({ port: 8080 });

// 暫存資料
const users = [];
const onlineUser = [];
const cacheMessages = [];

const handleLogin = (data) => {
    if(!data.username || !data.password) throw new Error('資料錯誤');

    const { username, password } = data;
    const targetUser = users.find(user => user.username === username);
    if(!targetUser) throw new Error('查無用戶');

    if(targetUser.password !== password) throw new Error('密碼錯誤');

    const user = {
        username: targetUser.username,
        nickname: targetUser.nickname
    };

    onlineUser.push(user);

    // 將所有連線的 client 傳送訊息
    wss.clients.forEach((client) => {
        // 由於 messages 往前端傳送時，會是 Blob，所以要先轉成字串
        client.send(JSON.stringify(onlineUser) || []);
    });

    return user;
}

const handleRegister = (data) => {
    if(!data.username || !data.password || !data.nickname) throw new Error('資料錯誤');

    // Find User
    const hasUser = users.some(user => user.username === data.username);
    // Validate
    if(hasUser) throw new Error('已有相同用戶，無法建立');
    // Create User
    const user = {
        uuid: uuidv4(),
        username: data.username,
        password: data.password,
        nickname: data.nickname
    }
    users.push(user);

    // 登入
    handleLogin(user);

    return user;
}

const handleMessage = () => {

}

const handleEnterRoom = () => {

}

const handleLeaveRoom = () => {

}


wss.on('connection', function connection(ws) {
    ws.on('error', console.error);

    ws.on('message', (data) => {
        // 由於 data 是 Buffer，所以要使用 toString 轉成字串
        const clientMessage = data.toString();
        // 再由 String to Object
        const objClientMessage = JSON.parse(clientMessage);

        if(!objClientMessage.type) return;

        switch(objClientMessage.type) {
            case ClientMessageType.Open: ws.send('pong'); break;
            case ClientMessageType.Login: handleLogin(objClientMessage.data); break;
            case ClientMessageType.Register: handleRegister(objClientMessage.data); break;
            case ClientMessageType.Message: handleMessage(objClientMessage.data); break;
            // case ClientMessageType.EnterRoom: handleEnterRoom(objClientMessage.data); break;
            // case ClientMessageType.LeaveRoom: handleLeaveRoom(objClientMessage.data); break;
            default: return;
        }

        // if(objClientMessage.type && objClientMessage.type === 'message') {
        //     cacheMessages.push(clientMessage);

        //     // 將所有連線的 client 傳送訊息
        //     wss.clients.forEach((client) => {
        //         // 由於 messages 往前端傳送時，會是 Blob，所以要先轉成字串
        //         client.send(JSON.stringify(cacheMessages) || []);
        //     });
        // }
    });

    // 當連線關閉
    ws.on('close', () => {
        console.log('Close connected')
    })

    // 當連線時，將所有訊息傳送給連線的 client，所以算是初始化訊息
    ws.send(JSON.stringify(cacheMessages) || []);
});
