const config = require('../../config');
const http = require('request-promise-json');


class Consul {

    constructor(domain, secret) {

        this.consul = (config.get('CONSUL').api.secure ? 'https://' : 'http://') + config.get('CONSUL').api.host + ':' + config.get('CONSUL').api.port + '/' + config.get('CONSUL').version;
        this.domain = domain;
        this.secret = secret;

        return this;
    }


    updateDeployment(app) {

        return new Promise((resolve, reject) => {


            let url = this.consul + 'app/update';
            let header = { domain: this.domain, secret: this.secret, app: app };
            console.log("UPDATING KEYS TO : " + url + " WITH HEADER : " + JSON.stringify(header));
            http.post(url, header).then(response => {

                if (response.error) { reject(response.message); } else { resolve(response.message); }

            }).catch(e => {

                console.log("CONSUL API ERROR : ", e);
                reject(e);

            });


        })


    }
}


module.exports = Consul;