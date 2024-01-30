const ClientMessageType = {
    Open: 'open',
    Close: 'close',
    Login: 'login',
    Register: 'register',
    EnterRoom: 'enterRoom',
    LeaveRoom: 'leaveRoom',
    Message: 'message',
};

// Socket 接收事件
const SocketEventType = {
    Subscribe: 'subscribe',
    SendMessage: 'sendMessage',
    Disconnect: 'disconnect'
}

// Socket 發送事件
const SocketEmitEventType = {
    AllMessage: 'allMessage',
    OnlineUsers: 'onlineUsers',
    NewOnlineUser: 'newOnlineUser',
    NewMessage: 'newMessage'
}

module.exports = { ClientMessageType, SocketEventType, SocketEmitEventType }