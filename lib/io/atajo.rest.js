const path = require('path'); 
const fs = require('fs'); 
const request = require('request'); 
const utils = require('./atajo.utils'); 

class Rest { 

    constructor(domain) { 
        this.domain = domain; 
    }


    publishDefinition() {

        const apiHost = (config['API'].port == '443'
            ? 'https://'
            : 'http://') + config['API'].host; 
             
        log.debug("API: HOST IS - ", apiHost);
        const definitionBase = path.join(process.cwd(), 'lambdas', 'definition');
        const definitionHeader = path.join(definitionBase, 'header.json');
        const definitionResult = path.join(definitionBase, 'definition.json');

        if (!fs.existsSync(definitionBase)) {
            log.warn("API: NO API DEFINITION DIRECTORY FOUND -> YOU WILL NOT BE ABLE TO ACCESS YOUR LAMBDAS" +
                    " VIA THE API GATEWAY");
            return;
        }
        if (!fs.existsSync(definitionHeader)) {
            log.warn("API: NO API DEFINITION DIRECTORY FOUND -> YOU WILL NOT BE ABLE TO ACCESS YOUR LAMBDAS" +
                    " VIA THE API GATEWAY");
            return;
        }

        //GET THE HEADER
        let apiHeader = {};
        try {
            apiHeader = JSON.parse(fs.readFileSync(definitionHeader));
        } catch (e) {
            return log.error("API: COULD NOT PUBLISH DEFINITION : ", e);
        }

        //PREP THE HEADER
        apiHeader.swagger = "2.0";
        apiHeader.basePath = "/";
        apiHeader.schemes = ["https"];
        apiHeader.consumes = ["application/json"];
        apiHeader.produces = ["application/json"];
        apiHeader.paths = {};
        apiHeader.securityDefinitions = {
            "deviceAuth": {
                "type": "apiKey",
                "in": "header",
                "name": "domain",
                "description": "role:device"
            },
            "serverAuth": {
                "type": "apiKey",
                "in": "header",
                "name": "secret",
                "description": "role:server"
            }
        }

        //GET THE ENDPOINTS
       // log.debug("API: GETTING DEFINITION AT : ", definitionBase);
        utils.getDirectories(definitionBase, (err, res) => {

            if (err) {
                log.error("API: COULD NOT PROCESS DEFINITION : ", err);
            } else {
                for (let i in res) {

                    let currentPath = res[i];

                    if (currentPath.indexOf('.json') > -1 && currentPath.indexOf('header.json') == -1 && currentPath.indexOf('definition.json') == -1) {
                        //VALID FILE.. PROCESS
                        try {
                            let currentFile = fs.readFileSync(currentPath);
                            let currentJSON = JSON.parse(currentFile);

                            for (let j in currentJSON) {
                                //log.debug("ADDING " + j + " TO DEFINITION FROM " + currentPath);
                                apiHeader.paths[j] = currentJSON[j];

                                let defaultResponses = {
                                    "200": {
                                        "description": "Success Response",
                                        "schema": {
                                            "type": "object",
                                            "properties": {
                                                "error": {
                                                    "description": "Either 1 or 0 (true | false)",
                                                    "type": "number"
                                                },
                                                "latency": {
                                                    "description": "Contains timestamps of each hop of the transaction",
                                                    "type": "object",
                                                    "properties": {
                                                        "deviceSubmitAt": {
                                                            type: "string",
                                                            description: "Timestamp when device (The API call in this case) submitted the transaction"
                                                        },
                                                        "coreLambdaRequestAt": {
                                                            type: "string",
                                                            description: "Timestamp when the Atajo Core submitted the transaction to the nominated Atajo L" +
                                                                    "ambda Function"
                                                        },
                                                        "lambdaReceiveAt": {
                                                            type: "string",
                                                            description: "Timestamp when the Atajo Lambda Function received the transaction"
                                                        },
                                                        "lambdaResponseAt": {
                                                            type: "string",
                                                            description: "Timestamp when the Atajo Lambda Function has done processing the transaction and" +
                                                                    " responded back to the Atajo Core"
                                                        },
                                                        "coreLambdaResponseAt": {
                                                            type: "string",
                                                            description: "Timestamp when the Atajo Core responded back to device (in this case API) with t" +
                                                                    "he transaction result"
                                                        }
                                                    }
                                                },
                                                "pid": {
                                                    "description": "The process id (transaction id) of the transaction",
                                                    "type": "string"
                                                },
                                                "response": {
                                                    "description": "The transaction response",
                                                    "type": "object",
                                                    "properties": {
                                                        "data": {
                                                            type: "array",
                                                            items: {},
                                                            description: "Timestamp when device (The API call in this case) submitted the transaction"
                                                        }

                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                if (apiHeader.paths[j]['get']) {
                                    apiHeader.paths[j]['get'].responses = apiHeader.paths[j]['get'].responses || defaultResponses
                                } else if (apiHeader.paths[j]['post']) {
                                    apiHeader.paths[j]['post'].responses = apiHeader.paths[j]['post'].responses || defaultResponses
                                } else if (apiHeader.paths[j]['put']) {
                                    apiHeader.paths[j]['put'].responses = apiHeader.paths[j]['put'].responses || defaultResponses
                                } else if (apiHeader.paths[j]['patch']) {
                                    apiHeader.paths[j]['patch'].responses = apiHeader.paths[j]['patch'].responses || defaultResponses
                                }

                            }

                        } catch (e) {

                            log.error("API: COULD NOT PROCESS DEFINITION - ", e);

                        }
                    }
                }

            }

            //console.log("DEFINITION IS : ", apiHeader)

            fs.writeFileSync(definitionResult, JSON.stringify(apiHeader, null, 4));

            var req = request.post(apiHost + '/definition/' + this.domain, (err, resp, body) => {
                if (err || resp.statusCode !== 200) {
                    log.warn('API: ERROR UPLOADING DEFINITION');
                } else {
                    log.debug('API: DEFINITION UPLOADED');
                }
            });
            var form = req.form();
            form.append('file', fs.createReadStream(definitionResult), {contentType: 'text/plain'});

        })

        /*

        */
        // fs.createReadStream(definitionFile).pipe(request.put(apiHost + '/definition/'
        // + this.domain));

    }

}

module.exports = Rest; 