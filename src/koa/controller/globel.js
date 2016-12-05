/**
 * Created by WLHQ on 2016-12-05.
 */
module.exports = {
    error: function*(param, next) {
        yield this.render('error', {
            title: 'error ' + this.cookies.get('user'),
            body: '<p>body</p>',
            author: {firstName: 'z', lastName: ' jl'}
        });
    }
}