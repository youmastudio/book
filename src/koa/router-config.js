var Router = require('koa-router');
var send = require('koa-send');
var service = new Router({
    prefix: '/static'
});
service.get('/:path', function*(next) {
    yield send(this, this.path, {});
});
var manager = new Router();
var method = ['get', 'post'];
manager.register('/', method, function*(next) {
    yield controller('home', 'index').call(this, '', next);
});
manager.register('/:controller', method, function*(next) {
    yield controller(this.params['controller'], 'index').call(this, '', next);
});
manager.register('/:controller/:method', method, function*(next) {
    yield controller(this.params['controller'], this.params['method']).call(this, '', next);
});
manager.register('/:controller/:method/:param', method, function*(next) {
    yield controller(this.params['controller'], this.params['method']).call(this, this.params['param'], next);
});
manager.register('/:controller/:method/:param/*', method, function*(next) {
    yield controller(this.params['controller'], this.params['method']).call(this, this.params['param'], next);
});
function controller(controller, method) {
    controller = controller || 'home';
    method = method || 'index';
    var controllerEntity = undefined;
    try {
        controllerEntity = require('./controller/' + controller + '.js');
    } catch (msg) {
        return error();
    }
    if (!controllerEntity) {
        return error();
    }
    if (!controllerEntity[method] || typeof controllerEntity[method] != 'function') {
        return controllerEntity['error'] || error();
    }
    return controllerEntity[method]
}
function error() {
    var controller = require('./controller/globel.js');
    return controller['error'];
}
module.exports.static = service.routes();
module.exports.controller = manager.routes();
