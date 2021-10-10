#!/usr/bin/env node

const figlet = require('figlet');
const api = require('api-npm');

const version = global.version = require('../package.json').version;

///VERSION CHECK 
var req = api.getdetails('atajo-cli', start);
req.on('error', (e) => { start(false); })

function start(details) {

    if (details) {
        try {
            let latestVersion = details['dist-tags'].latest;
            if (version < latestVersion) {
                console.log();
                console.log();
                console.log("              **************************************************************")
                console.log("              *                                                            *")
                console.log("              *           ATAJO-CLI UPDATE AVAILABLE (" + latestVersion + ")              *")
                console.log("              *                                                            *")
                console.log("              *   Please run  npm install -g atajo-cli@latest  to update   *")
                console.log("              *                                                            *")
                console.log("              **************************************************************")
                console.log();
                console.log();

            }
        } catch (e) {
            console.error("COULD NOT CHECK LATEST CLI VERSION. PLEASE ENSURE YOU ARE CONNECTED TO THE INTERNET");
            console.log(e);
        }
    }


    const commands = {

        register: {
            description: "Registers this atajo-cli with the atajo platform using your assigned domain and secret - e.g. atajo register --help"
        },
        /*    config: {
                description: "Manage your current lambda config - e.g. atajo config --help"
            }, */
        lambda: {
            description: "Create, run or deploy Atajo Lambdas on/from this machine - e.g. atajo lambda --help"
        },
        app: {
            description: "Create, deploy and work with app binaries to the Atajo Store and OTA code updates, etc. - e.g. atajo app --help"
        }

    }

    const tlc = process.argv[2];
    if (Object.keys(commands).indexOf(tlc) > -1) {
        require('../lib/' + tlc)
    } else {

        figlet.text('Atajo Mobility Core', {
            font: 'Slant',
            horizontalLayout: 'default',
            verticalLayout: 'default'
        }, function(err, data) {

            console.log(data);
            console.log("                                                                            version " + version);
            console.log();
            console.log();
            console.log("Available Top Level Commands : ");
            console.log();
            for (var i in commands) {

                var tabSize = 20 - i.length;
                var tab = '';
                for (var t = 0; t < tabSize; t++) {
                    tab += ' ';
                }

                console.log(i + tab + commands[i].description);
            }
            console.log();
            console.log();
            console.log("Thanks for using Atajo! For help please send a mail to support@atajo.co.za :)");
            console.log();
            console.log();


        });



    }








}