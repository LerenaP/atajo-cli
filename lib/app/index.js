const fs = require('fs');
const ncp = require('ncp');
const path = require('path');
const main = require('caporal')('atajo app');
const push = require('./push');
const Config = require('./config.js');
const Update = require('./update.js');
const Keys = require('../keys');
const Consul = require('./consul');
const prompt = require('prompt');
const colors = require("colors/safe");
const Build = require('./build');


const configFile = path.join(__dirname, 'config.xml');

main
    .version(version)
    .command('update')
    .description('Compiles and pushes the current codebase to apps built from this codebase (OTA Update).')
    .help('Compiles and pushes the current codebase to apps built from this codebase (OTA Update).')
    .action(function(args, options) {

        console.log();

        let platform = args.platform;
        let domain = args.domain;

        prompt.message = '';
        let schema = {
            properties: {
                platform: {
                    message: 'Which platform is this update for (android / ios)?',
                    default: 'android',
                    required: true,
                    pattern: /(android|ios)$/,

                },
                domain: {
                    pattern: /^([0-9]|[a-z]|-|_)+([0-9a-z]+)$/i,
                    message: 'A valid registered domain name',
                    required: true
                },
                changelog: {
                    message: 'Comma seperated changelog or description of update',
                    required: true
                }
            }
        };

        prompt.start();

        // 
        // Get two properties from the user: username and email 
        // 
        prompt.get(schema, function(err, result) {

            if (err) {
                console.log();
                console.log();
                return;
            }


            let domain = result.domain;
            let changelog = result.changelog;
            let platform = result.platform || 'android';
            //TODO .. check if directory exists

            let keys = new Keys('.atajo.keys');
            keys.get(domain).then(secret => {

                let config = new Config();
                config.getBundleId().then(bundleId => {


                    let appPath = '';
                    if (platform == 'android') {
                        appPath = path.join('assets', 'www');
                    } else {
                        appPath = 'www';
                    }


                    console.log(appPath);

                    const directory = path.join(process.cwd(), 'platforms', platform, appPath);
                    console.log(directory);

                    const update = new Update(directory, domain, secret, bundleId, changelog);
                    update.push().then((data) => {

                        console.log("DATA IS : ", data);

                    }).catch((error) => {

                        console.log(error);

                    })






                }).catch(() => {});
            }).catch(e => { console.log(e); })

        });

    })




   

    .command('build')
    .argument('<platform>', 'Platform to build for (android|ios)', /^(android|ios|all)$/i)
    .argument('<release>', 'Release to build (qas|prd)', /^(dev|qas|prd|all)$/i)
    .argument('<deploy>', 'Deploy (Upload) to store.atajo.io', /^(true|false)$/i, false)
    .description('Builds an app for the indicated platform and release and optionally uploads it to the atajo app store.')
    .help('Builds an app for the indicated platform and release and optionally uploads it to the atajo app store.')
    .action(function(args, options) {


        const release = args.release;
        const platform = args.platform;
        const deploy = args.deploy;

        console.log("Building " + release + " app for " + platform);

        //CHANGE BUNDLE ID
        const build = new Build();

        //ADD PLATFORM
        build.addPlatform(platform).then((result) => {

            console.log("Platform added : ", result);

            //PROCESS BUNDLE ID
            build.processBundleId(release).then((bundleId) => {

                //ADD THE RELEASE FILE
                build.addReleaseFile(release).then(() => {

                    //ADD FCM CONFIG (IF EXISTS)
                    build.addFCMConfig(platform, bundleId).then(() => {

                        //ADD MULTIDEX TO BUILD.GRADLE
                        build.appendToGradle(platform).then(() => {

                            console.log("Compiling App...");

                            //BUILD THE APP
                            build.buildApp(platform).then(result => {

                                build.copyBinary(platform, bundleId).then((path) => {

                                    if (path) { console.log("App compiled and ready @ " + path); }

                                    //UPLOAD TO STORE


                                }).catch(err => {
                                    console.error("Could not build app : ", err);
                                })

                            }).catch(err => {
                                console.error("Could not build app : ", err);
                            })
                        }).catch(err => {
                            console.error("Could not edit gradle file : ", err);
                        })
                    }).catch(err => {
                        console.error("Could not add FCM config : ", err);
                    })
                }).catch(err => {
                    console.error("Could not add release file to www/ : ", err);
                })
            }).catch(err => {
                console.error("Could not process bundleId");
            });

        }).catch(err => {
            console.error("Could not add platform " + platform + " : ", err);
        })








    })





process.argv.splice(2, 1);
process.argv[1] = 'atajo app';
main.parse(process.argv);