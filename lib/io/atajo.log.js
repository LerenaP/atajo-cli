'use strict';

const bunyan = require('bunyan');
const PrettyStream = require('bunyan-prettystream'); 
const fs = require('fs');
const path = require('path');
const os = require('os');
const mkdirp = require('mkdirp');


class Log {


    constructor(release = 'dev') {

        const prettyStdOut = new PrettyStream();
        prettyStdOut.pipe(process.stdout);

        const LogLevel = {
            DEBUG: 'debug',
            INFO: 'info',
            WARN: 'warning',
            ERROR: 'error'
        };

        let streams = ''; 

        if (release == 'prd') {     
            streams = [{
                path: logFile,
                level: LogLevel.WARN,
                type: 'raw',
                stream: prettyStdOut
            }];
        } else if (release == 'qas') {      
            streams = [{
                path: logFile,
                level: LogLevel.INFO,
                type: 'raw',
                stream: prettyStdOut
            }];    
        } else { 
            streams = [{
                level: LogLevel.DEBUG,
                type: 'raw',
                stream: prettyStdOut
            }];
        }

        this.log = bunyan.createLogger({
            streams,
            name: release + '@' + os.hostname() + ':',
            serializers: {
                req: bunyan.stdSerializers.req,
                res: bunyan.stdSerializers.res,
                error: bunyan.stdSerializers.err
            }  
        });

        return this.log;

    }

    child(tag) {

        return this.log.child({ tag: tag });

    }




}


module.exports = Log;