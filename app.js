// esModule
// import express from "express";
// import { createServer } from "http";
// import { Server } from "socket.io";

// commonJs
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Express
const app = express();
// Create Http Server
const httpServer = createServer(app);
// Create Socket Server
const io = new Server(httpServer, { /* options */ });

// Http Respond
app.use('/', (req, res) => res.status(200).send('HEALTHY'));

let users = [];

// Socket Connect
io.on("connection", (socket) => {
    // 向所有人廣播更新目前最新的 Users
    const updateUsers = () => {
        io.sockets.emit('users', users);
    }

    // Create User
    socket.on('createUser', (username) => {
        if(users.indexOf(username) < 0) {
            // 向 Client Side 發送訊息
            socket.emit('chat', 'SERVER', '歡迎光臨 ' + username);
            // Socket 設定 Client Username
            socket.username = username;
            // 插入新的 username 到 users
            users.push(socket.username);
            // 向所有人廣播更新目前最新的 Users
            updateUsers();
        }
    });

    // 向所有 Client 發送訊息
    socket.on('sendMessage', (message) => {
        io.sockets.emit('newMessage', { msg: message, nick: socket.username });
    });

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

// Server listen
httpServer.listen(3000, () => {
    console.log('listening on *:3000');
});