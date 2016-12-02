var hbs = require('koa-hbs');
module.exports = function (config) {
    return hbs.middleware({
        partialsPath: __dirname + '/layout/partial',
        viewPath: __dirname + '/layout/view',
        layoutsPath: __dirname + '/layout',
        extname: '.html',
        disableCache: true,
    })
}
