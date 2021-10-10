const Config = require('./config.js');
const fs = require('fs');
const ncp = require('ncp').ncp;
const path = require('path');
const exec = require('child_process').exec;

class Build {

    constructor() {}

    processBundleId(release) {

        return new Promise((resolve, reject) => {

            const config = new Config();
            config.getBundleId().then(bundleId => {

                console.log("Found bundleId : " + bundleId);

                if (bundleId && bundleId.indexOf('io.atajo') > -1) {

                    if (bundleId.indexOf('io.atajo.dev.') > -1) {
                        bundleId = bundleId.replace('io.atajo.dev.', 'io.atajo.');
                    } else if (bundleId.indexOf('io.atajo.qas.') > -1) {
                        bundleId = bundleId.replace('io.atajo.qas.', 'io.atajo.');
                    } else if (bundleId.indexOf('io.atajo.prd.') > -1) {
                        bundleId = bundleId.replace('io.atajo.prd.', 'io.atajo.');
                    }

                    const bundleIdRelease = bundleId.replace('io.atajo.', 'io.atajo.' + release + '.');
                    config.setBundleId(bundleIdRelease).then(() => {

                        resolve(bundleIdRelease);

                    }).catch(err => {

                        reject();

                    })


                } else {
                    console.error("Invalid bundleId (" + bundleId + ") found in config.xml. Please use the following format: io.atajo.customer.product (e.g. io.atajo.netcare.assist)");
                    reject();
                }

            }).catch(err => {

                console.error(err);
                reject();

            })


        })

    }

    addPlatform(platform) {

        return new Promise((resolve, reject) => {


            const child = exec('ionic cordova platform add ' + platform,
                (error, stdout, stderr) => {

                    if (error) { reject(error); }
                    if (stderr) { reject(error); }
                    if (stdout) { resolve(stdout); }


                });

        })



    }

    copyBinary(platform, bundleId) {

        return new Promise((resolve, reject) => {

            const binDestPath = path.join(process.cwd(), 'bin');
            const platformDestPath = path.join(process.cwd(), 'bin', platform);

            if (!fs.existsSync(binDestPath)) { fs.mkdirSync(binDestPath); }
            if (!fs.existsSync(platformDestPath)) { fs.mkdirSync(platformDestPath); }

            console.log("Copying binary for " + platform + " : " + bundleId);

            if (platform == 'android') {
                let sourceFile = path.join(process.cwd(), 'platforms', 'android', 'build', 'outputs', 'apk', 'android-debug.apk');
                let destFile = path.join(process.cwd(), 'bin', platform, bundleId + '.apk');
                ncp(sourceFile, destFile, (err) => {
                    if (err) {
                        reject(error);
                    }
                    resolve(destFile);
                });
            } else if (platform == 'ios') {
                console.log("IOS AUTO PROVISIONING AND SIGNING COMING SOON. FOR NOW PLEASE COMPILE WITH XCODE");
                resolve(false);
                return;
            }



        });



    }

    addReleaseFile(release) {

        return new Promise((resolve, reject) => {
            const releaseFile = path.join(process.cwd(), 'www', 'release');
            fs.writeFile(releaseFile, release, (err) => {
                if (err) reject(err);
                else resolve();
            })

        });

    }

    addFCMConfig(platform, bundleId) {

        return new Promise((resolve, reject) => {

            const fcmConfigFile = path.join(process.cwd(), 'firebase', platform, bundleId + (platform == 'android' ? '.json' : '.plist'));

            console.log("FCM config file is : " + fcmConfigFile);
            fs.readFile(fcmConfigFile, 'utf8', (error, json) => {

                if (error) {
                    console.log("Could not add Firebase json. Skipping");
                    resolve();
                } else {

                    const fcmFinalConfigFile = path.join(process.cwd(), (platform == 'android' ? 'google-services.json' : 'GoogleService-Info.plist'));

                    fs.writeFile(fcmFinalConfigFile, json, (error) => {

                        if (error) console.log("Could not add Firebase json. Skipping");
                        resolve();

                    })
                }

            });



        });




    }

    buildApp(platform) {

        return new Promise((resolve, reject) => {


            const child = exec('ionic cordova build ' + platform, { maxBuffer: 1024 * 500 },
                (error, stdout, stderr) => {

                    if (error && error !== null && error !== 'null') {
                        reject(error);
                    } else if (stderr && stderr !== null && stderr !== 'null') {
                        resolve(stderr);
                    } else if (stdout) {
                        resolve(stdout);
                    } else { reject("Command did not call back"); }

                });

        })


    }

    appendToGradle(platform) {

        return new Promise((resolve, reject) => {

            const multiDex = "configurations.all {\n" +
                "     resolutionStrategy.eachDependency { DependencyResolveDetails details ->\n" +
                "     def requested = details.requested\n" +
                "      if (requested.group == 'com.android.support') { \n" +
                "          if (!requested.name.startsWith(\"multidex\")) { \n" +
                "              details.useVersion '25.3.1'\n" +
                "          }\n" +
                "      }\n" +
                "     }\n" +
                "    }\n"

            if (platform == 'android') {

                const gradleFile = path.join(process.cwd(), 'platforms', platform, 'build.gradle');
                console.log("Gradle file is : " + gradleFile);
                fs.readFile(gradleFile, 'utf8', (error, gradle) => {

                    if (error) {
                        reject(error);
                    } else {
                        if (gradle.indexOf('configurations.all') == -1) {
                            gradle += '\n\n\n' + multiDex;

                            fs.writeFile(gradleFile, gradle, (error) => {

                                if (error) reject(error);
                                else resolve();

                            })

                        } else {
                            resolve();
                        }

                    }

                });

            } else {
                resolve();
            }

        });
    }





}

module.exports = Build;