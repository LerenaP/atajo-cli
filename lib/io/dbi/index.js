var mongoose = require('mongoose');
var os = require('os');
var fs = require('fs');
var path = require('path');

const { promisify } = require('util'); 
const readdir = promisify(fs.readdir); 

class DBI {

    constructor(config) {

        this.config = config.MONGO || config;

        if (!this.config.host) {
            log.error("MONGO: COULD NOT INIT. HOST NOT SPECIFIED.");
            return; 
        }

        this.schemaDir = path.join(process.cwd(), 'lambdas', 'schemas');

        if (this.config.discriminate) {

            this.baseOptions = {
                discriminatorKey: '__type',
                collection: 'data',
                timestamps: true
            }
            this.Base = mongoose.model('Base', new mongoose.Schema({}, this.baseOptions));
        }

        return this;

    }

    async start() {

        this.schemas = {};
        this.schemaDefinitions = {}; 
        let files = await readdir(this.schemaDir); 

        if (!files) {
            reject("COULD NOT READ SCHEMAS. MONGODB INIT FAILED : " + err);
            return false; 
        }

        for (var f in files) {
            var file = files[f];
            if (file.indexOf('.js') > -1) {
                var rNam = file.replace('.js', '');
                try {
                    this.schemaDefinitions[rNam] = require(path.join(this.schemaDir, rNam));
                } catch (e) {
                    log.error("COULD NOT REQUIRE SCHEMA " + rNam + " : " + e);
                }
            }
        }

        this.schemaDefinitions['transactionLogSchema'] = { 
            pid: String,
            uuid: String,
            user: String, 
            domain: String, 
            lambda: String,
            startAt: String,
            endAt: String,
            totalAt: String, 
            latency: Object
        }

        //INIT THE SCHEMAS
        for (var schema in this.schemaDefinitions) {

            var schemaName = schema;
            var schemaData = this.schemaDefinitions[schema];

            var schemaRefName = schemaName.replace('Schema', '') + 's';
            log.debug("DBI: ATTACHING SCHEMA - " + schemaName + " -> dbi." + schemaRefName);

            let currentSchema = new mongoose.Schema(schemaData, {timestamps: true});
                currentSchema.post('*', (error, doc, next) => { 
                    log.error("DBI: POST ERROR : ", error, doc); 
                    next(); 
                })

            if (this.config.discriminate) {
                this.schemas[schemaRefName] = (typeof this.schemas[schemaRefName] == 'undefined')
                    ? this
                        .Base
                        .discriminator(schemaName, currentSchema)
                    : this.schemas[schemaRefName];
            } else {
                this.schemas[schemaRefName] = (typeof this.schemas[schemaRefName] == 'undefined')
                    ? mongoose.model(schemaName, currentSchema )
                    : this.schemas[schemaRefName];
            }
        }

        await this.connect(); 
        return this.schemas;

      
        
    }

    async connect() {

        let options = {
            native_parser: true,
            useNewUrlParser: true
        };

        mongoose.Promise = Promise;
        mongoose
            .connection
            .on('error', (e) => { throw new Error("DBI: CONNECT ERROR - "+e); });
        mongoose
            .connection
            .once('open', () => {
                log.info("DBI: CONNECTED TO - "+this.config.host);             
                return this.schemas
            });

        mongoose.connect(this.config.host, options);
    }

}

module.exports = DBI;