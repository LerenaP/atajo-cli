let request = require('request');

class Lambda {

    constructor(api, config, log, dbi) {

        this.dbi = dbi;
        this.log = log;
        this.config = config;
    }

    request(tx) {

        // This is a standard bunyan log (see https://github.com/trentm/node-bunyan)
        this
            .log
            .debug(tx); //Log the entire tx so you can see what's in it

        // Record the request
        let sampleData = {}
        let sampleRecord = new this
            .dbi
            .samples();

    }

}

require('../../atajo/lambda').bind(Lambda);