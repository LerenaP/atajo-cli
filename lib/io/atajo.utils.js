const glob = require('glob');

class Utils {

    constructor() {}

    pid() {
        var S4 = function() {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        }
        var pid = (S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4()) + '';
        return pid;
    }

    static getDirectories(src, callback) {
        glob(src + '/**/*', callback);
    }


}

module.exports = Utils;