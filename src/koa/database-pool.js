/**
 * Created by WLHQ on 2016-12-01.
 */
var genericPool = require('generic-pool');
var mongoClient = require('mongodb').MongoClient;
module.exports = function (config) {
    var databasePool = genericPool.createPool({
        create: function () {
            return new Promise(function (resolve, reject) {
                mongoClient.connect(config, function (error, database) {
                    var back = error ? reject(error) : resolve(database);
                });
            })
        },
        destroy: function (database) {
            return Promise.resolve(database.close())
        }
    }, {
        max: 1024, // maximum size of the pool
        min: 2 // minimum size of the pool
    });
    return function*(next) {
        this.database = yield databasePool.acquire();
        yield next;
        databasePool.release(this.database)
    }
}