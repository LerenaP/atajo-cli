const xml2js = require('xml2js');
const parseString = require('xml2js').parseString;
const builder = new xml2js.Builder();

const fs = require('fs');
const path = require('path');


class Config {

    constructor() {

        this.configFile = path.join(process.cwd(), 'config.xml');
        // console.log('CONFIG FILE IS ' + this.configFile);

    }

    exists() {
        const exists = fs.existsSync(this.configFile);
        if (!exists) {
            console.log("Could not find config.xml in current directory");
        }
        return exists;
    }

    getBundleId() {

        return new Promise((resolve, reject) => {

            if (!this.exists()) reject();

            this.xmlFileToJs(this.configFile, (err, result) => {

                if (err) {
                    console.log("config.xml file not found");
                    reject();
                } else if (!result.widget) {
                    console.log("Incompatible config.xml found. Please ensure your config.xml is a cordova config file.");
                    reject();
                } else {
                    resolve(result.widget.$.id)
                }

            });


        });


    }

    setBundleId(bundleId) {

        return new Promise((resolve, reject) => {

            if (!this.exists()) reject();

            this.xmlFileToJs(this.configFile, (err, result) => {

                if (err) {
                    console.log("config.xml file not found");
                    reject();
                } else if (!result.widget) {
                    console.log("Incompatible config.xml found. Please ensure your config.xml is a cordova config file.");
                    reject();
                } else {
                    result.widget.$.id = bundleId;
                    this.jsToXmlFile(this.configFile, result, (error) => {

                        if (error) {
                            console.log("Error writing config.xml : ", error);
                            reject();
                        } else {
                            resolve();
                        }
                    });

                }



            });


        });


    }

    xmlFileToJs(filepath, cb) {
        const xml = fs.readFileSync(filepath, 'utf8');
        if (!xml) cb(false)
        else parseString(xml, cb);
    }

    jsToXmlFile(filepath, obj, cb) {
        var builder = new xml2js.Builder();
        var xml = builder.buildObject(obj);
        fs.writeFile(filepath, xml, cb);
    }
}

module.exports = Config;