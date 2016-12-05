/**
 * Created by WLHQ on 2016-12-05.
 */
module.exports = {
    index: function*(param, next) {
        yield this.render('index', {title: 'koa-hbs', body: '<p>body</p>', author: {firstName: 'z', lastName: ' jl'}});
    },
    product: function*(param, next) {
        this.cookies.set('user', 'zhangjinglong');
        yield this.render('product', {
            title: 'product ' + param,
            body: '<p>body</p>',
            author: {firstName: 'z', lastName: ' jl'}
        });
    }
}
