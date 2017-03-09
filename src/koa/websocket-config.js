/**
 * Created by WLHQ on 2017-02-15.
 */
var websocket = require("./websocket/index.js");
var messageHandler = require("./message/handler.js");
var server;
function onConnected(ws) {
    function message(data) {
        onMessage(ws, data);
    }
    ws.on('message', message)
}
function onError(error) {
}
function onMessage(ws, data) {
    var msg = JSON.parse(data);
    messageHandler[msg.uri](server, ws, msg);
}
module.exports.listen = function (config) {
    server = new websocket.Server(config);
    server.on('connection', onConnected);
    server.on('error', onError);
}