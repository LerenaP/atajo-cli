const exec = require('child_process').exec;
const CodePush = require("code-push");
const Keys = require('../keys');

class Push {

    constructor() {


    }


    isLoggedIn() {

        return new Promise((resolve, reject) => {
            const child = exec('code-push app list',
                (error, stdout, stderr) => {

                    if (error) { reject(error); }
                    if (stderr) { reject(error); }
                    if (stdout) { resolve(stdout); }

                });
        })


    }

    initKey(bundleId) {
        return new Promise((resolve, reject) => {

            let keyCache = new Keys('.atajo.push');
            keyCache.list().then(keys => {

                if (Object.keys(keys).indexOf(bundleId) > -1) {
                    let key = keys[bundleId];
                    this.codePush = new CodePush(key);
                    resolve(key);
                } else {

                    console.log("Creating push key for : " + bundleId);
                    const child = exec('code-push access-key add ' + bundleId,
                        (error, stdout, stderr) => {

                            if (error) { reject(error); }
                            if (stderr) { reject(error); }
                            if (stdout) {

                                let dx = stdout.indexOf('access key:');
                                let key = stdout.substring(dx + 12, dx + 52);
                                keyCache.set(bundleId, key);
                                this.codePush = new CodePush(key);
                                resolve(key);

                            }

                        });

                }

            }).catch(e => {});


        });

    }



    initApp(bundleId, os, platform = 'Cordova') {

        return new Promise((resolve, reject) => {

            console.log("Initializing app " + bundleId + '.' + os + " for platform : " + platform);
            this.codePush.getApps().then(apps => {

                let qualifiedName = bundleId + '.' + os;
                let app = false;
                let name = false;

                //'JohiesC/' + bundleId + '.' + os
                for (var i in apps) {
                    if (apps[i].name.toLowerCase().indexOf(qualifiedName.toLowerCase()) > -1) {

                        app = apps[i];
                        name = apps[i].name;

                    }
                }

                if (!app) { throw new Error(); }

                console.log("FOUND APP : " + name);

                this.getDeployment(name).then(keys => {

                    resolve({ name: name, app: app, keys: keys });

                }).catch(e => { reject(e); });
            }).catch(e => {

                console.log("Could not find local app : " + bundleId + '.' + os);

                let formattedOS = os;
                switch (os) {
                    case 'Ios':
                        formattedOS = 'iOS';
                }


                this.addApp(bundleId, formattedOS, platform).then(app => {

                    this.getDeployment(bundleId, formattedOS).then(keys => {

                        resolve({ name: bundleId, app: app, keys: keys });

                    }).catch(e => { reject(e); });


                }).catch(e => {

                    console.log("Could not add app : ", e);
                    reject(e);

                })

            })

        });

    }

    releaseUpdate(name, os, changelog, release) {

        return new Promise((resolve, reject) => {

            release = release == 'prd' ? 'Production' : 'Staging';
            const cmd = 'code-push release-cordova ' + name + ' ' + os + ' --deploymentName ' + release + ' --description="' + changelog + '" ';
            console.log("Running : ", cmd);
            const exec = require('child_process').exec;
            const child = exec(cmd,
                (error, stdout, stderr) => {
                    if (error) { reject(error); }
                    if (stderr) { reject(error); }
                    if (stdout) { resolve(stdout); }
                });

        });


    }

    addApp(bundleId, os, platform = 'Cordova') {

        return new Promise((resolve, reject) => {

            console.log("Creating app " + bundleId + '.' + os + " for platform : " + platform);
            //addApp(name: string, os: string, platform: string, manuallyProvisionDeployments: boolean = false): Promise<App>
            this.codePush.addApp(bundleId + '.' + os, os, platform).then(resolve).catch(reject);

        });

    }

    getDeployment(name, platform = 'Cordova') {

        return new Promise((resolve, reject) => {

            console.log("Getting deployment details for app " + name + " for platform : " + platform);
            //addApp(name: string, os: string, platform: string, manuallyProvisionDeployments: boolean = false): Promise<App>
            this.codePush.getDeployment(name, 'Staging').then(staging => {

                this.codePush.getDeployment(name, 'Production').then(production => {

                    resolve({ qas: staging, prd: production });

                }).catch(reject);




            }).catch(reject);

        });

    }


    getKeys(bundleId) {

        return new Promise((resolve, reject) => {


            const child = exec('code-push deployment list ' + bundleId + ' -k',
                (error, stdout, stderr) => {

                    if (error) { reject(error); }
                    if (stderr) { reject(error); }
                    if (stdout) { resolve(stdout); }

                });

        })


    }





}


module.exports = Push;