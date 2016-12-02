var Router = require('koa-router');
var send = require('koa-send');
var static = new Router({
    prefix: '/static'
});
static.get('/:name', function*(next) {
    yield send(this, this.path, {});
});
var system = new Router({
    prefix: '/system'
});
system.get('/', function*(next) {
    yield this.render('index', {title: 'koa-hbs', body: '<p>body</p>', author: {firstName: 'z', lastName: ' jl'}});
});
system.get('/msg', function*(next) {
    this.body = 'system msg '
})
var user = new Router({
    prefix: '/user'
});
user.get('/msg', function*(next) {
    this.body = 'user msg '
});
var home = new Router();
home.get('/', function *() {
    var context = this;
    var collection = yield new Promise(function (resolve, reject) {
        context.database.collection('mark', {safe: true}, function (err, collection) {
            var back = !err ? resolve(collection) : reject(err);
        });
    })
    var tmp1 = {id: process.hrtime(), title: 'hello', number: 1};
    var data = yield new Promise(function (resolve, reject) {
        collection.insert(tmp1, {safe: true}, function (err, result) {
            var back = !err ? resolve(result) : reject(err);
        });
    })
    var body = yield new Promise(function (resolve, reject) {
        collection.find({}).toArray(function (err, result) {
            var back = !err ? resolve(result) : reject(err);
        });
    })
    this.body = body;
});

module.exports = function (app) {
    app.use(static.routes());
    app.use(system.routes());
    app.use(user.routes());
    app.use(home.routes());
}
