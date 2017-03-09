/**
 * Created by WLHQ on 2016-11-28.
 */
let dbConfig = 'mongodb://localhost:27017/book';
var http = require('http');
var database = require("./database-pool.js");
var router = require('./router-config.js');
var template = require('./template-config.js');
var websocket = require('./websocket-config.js')
var app = require('koa')();
app.use(template(dbConfig));
app.use(database(dbConfig));
app.use(router.static)
app.use(router.controller)
var server = http.createServer(app.callback());
websocket.listen({server: server});
server.listen(3000);
