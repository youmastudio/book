/**
 * Created by WLHQ on 2017-02-16.
 */
module.exports = {
    //请求登录
    0: function login(wss, ws, message) {
        wss.clients.setId(message.clientId, ws);
    },
    //send
    1: function send(wss, ws, message) {

    },
    2: function getList(wss, ws, message) {
        ws.send('Size='+wss.clients.size);
    }
}