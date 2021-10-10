const config = require('../../config');
const { getHashesMap } = require('assets-hash-map')
const request = require('request');
const fs = require('fs');
const path = require('path');
const Zip = require('node-zip');
const md5 = require('md5');

class Update {


    constructor(directory, domain, secret, bundleId, changelog) {

        this.url = (config.get("API")['port'] == '443' ? 'https://' : 'http://') + config.get("API")['host'];
        this.lambda = config.get("API")["LAMBDAS"]["atajo-code-push"] || "atajo-code-push";
        this.domain = domain;
        this.secret = secret;
        this.changelog = changelog;
        this.directory = directory || './www';
        this.bundleId = bundleId;

    }

    push() {

        return new Promise((resolve, reject) => {

            this.getManifest().then((data) => {
                console.log("GET MANITFEST RESULT : ", data); 
                let thenManifest = data.response.data || {};

                console.log("PREVIOUS MANIFEST IS : ", thenManifest);

                this.createManifest().then(nowManifest => {

                    console.log("LATEST MANIFEST IS : ", nowManifest);
                    let updateFilePath = this.createArchive(thenManifest, nowManifest);

                    let formData = {
                        updateFile: fs.createReadStream(updateFilePath),
                    };

                    this.postUpdate(formData);

                });

            }).catch((error) => {

                console.log(error);

            })

        });

    }


    createArchive(thenManifest, nowManifest) {

        let newManifest = [];
        thenManifest.manifest = thenManifest.manifest || [];
        let hasChanged = false;
        for (let i in nowManifest.manifest) {

            let manifest = nowManifest.manifest[i];
            let name = manifest.name;

            let hash = manifest.hash;

            let wasFound = false;
            for (let j in thenManifest.manifest) {
                if (thenManifest.manifest[j].name == name) {
                    wasFound = true;
                    if (thenManifest.manifest[j].hash == hash) {
                        newManifest.push({ name: name, hash: hash, changed: true, at: new Date() });
                    } else {
                        hasChanged = true;
                        newManifest.push({ name: name, hash: hash, changed: true, at: new Date() });
                    }
                    break;
                }
            }

            if (!wasFound) {
                hasChanged = true;
                newManifest.push({ name: name, hash: hash, changed: true, at: new Date() });
            }


        }

        if (!hasChanged) {

            console.log("No changes found between current code and previously published code!");
            process.exit(1);

        }


        console.log("NEW MANIFEST IS : ", newManifest);

        let zip = new Zip();
        console.log("ADDING FILES TO ZIP...");
        for (let i in newManifest) {

            if (newManifest[i].changed) {
                // console.log('ADDING ' + newManifest[i].name + " TO ZIP FILE ");
                zip.file(newManifest[i].name, fs.readFileSync(path.join(this.directory, newManifest[i].name)));
            }

        }

        let finalManifest = nowManifest;
        finalManifest.manifest = newManifest;

        zip.file('atajo.manifest.json', JSON.stringify(finalManifest));

        let data = zip.generate({ base64: false, compression: 'DEFLATE' });

        let tempUpdateFile = path.join(__dirname, '../', '../', 'cache', finalManifest.domain + "_" + finalManifest.hash + '.zip');
        fs.writeFileSync(tempUpdateFile, data, 'binary');
        return tempUpdateFile;


    }

    postUpdate(data) {

        return new Promise((resolve, reject) => {

            console.log("UPLOADING UPDATE BUNDLE...");

            let url = this.url + '/' + this.lambda + '/v1/update';

            let opts = {
                url: url,
                headers: {
                    'release': 'dev',
                    'domain': this.domain,
                    'secret': this.secret
                },
                formData: data
            }

            request.post(opts, function optionalCallback(err, httpResponse, body) {
                if (err) {
                    return console.error('upload failed:', err);
                }
                console.log('Upload successful!  Server responded with:', body);
            });

        });


    }


    getManifest() {

        return new Promise((resolve, reject) => {


            let url = this.url + '/' + this.lambda + '/v1/manifest';
            console.log("CALLING : ", url); 
            let opts = {
                url: url,
                headers: {
                    'release': 'dev',
                    'domain': this.domain
                },
                json: true
            }

            console.log("OPTS ARE : ", opts);

            request(opts, (error, response, body) => {

                if (error) {
                    reject(error);
                } else {
                    resolve(body);
                }

            });


        })



    }



    createManifest() {

        return new Promise((resolve, reject) => {

            getHashesMap(this.directory, {}).then(rawManifest => {

                let subManifest = [];
                let hashes = '';

                for (let name in rawManifest) {

                    const hash = rawManifest[name];
                    hashes += hash;
                    subManifest.push({ name: name, hash: hash, changed: false, at: new Date() });

                }

                let finalManifest = {

                    hash: md5(hashes),
                    at: new Date(),
                    domain: this.domain,
                    bundleId: this.bundleId,
                    changelog: this.changelog,
                    manifest: subManifest

                }

                resolve(finalManifest);


            }).catch(reject);

        });
    }

}


module.exports = Update;