/**
 * Created by WLHQ on 2016-11-28.
 */
let dbConfig = 'mongodb://localhost:27017/book';
var database = require("./database-pool.js");
var router = require('./router-config.js');
var template = require('./template-config.js');
var app = require('koa')();
app.use(template(dbConfig));
app.use(database(dbConfig));
app.use(function *(next) {
    var start = new Date;
    yield next;
    var ms = new Date - start;
    this.set('X-Response-Time', ms + 'ms');
});
router(app);
app.listen(3000);