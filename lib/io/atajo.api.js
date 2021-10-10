const { Observable } = require('rxjs'); 
const Consul = require('./consul');
const Utils = require('./atajo.utils');

class Api {

    constructor(domain, secret) {
        this.domain = domain;
        this.secret = secret;
        this.transactions = {};
    }


    consul() { return new Consul(this.domain, this.secret); }
    push() { return new Push(this.domain, this.secret); }

    addTransaction(lambda, payload, options) {

        return Observable.create(observer => {


            log.debug("API.ADDTRANSACTION : " + lambda + " / ", payload);

            const utils = new Utils();
            const pid = utils.pid();
            const request = {
                action: 'txRequest',
                lambda: lambda,
                data: payload,
                options: options,
                pid: pid

            }

            this.transactions[pid] = { observer: observer, request: request };
            process.send(request);

        });




    }

    transactionResponse(data) {

        //console.log("API TX RESPONSE : ", data);


        if (!data.request || !data.request.pid) {
            log.error("INVALID TRANSACTION RESPONSE (LAMBDA:RX) - DROPPING : ", data);
            return;
        }

        data = data.request;
        let pid = data.pid;
        if (this.transactions[pid]) {

            let observer = this.transactions[pid].observer;
            if (data.error) {
                observer.error(data.response);
            } else {
                observer.next(data.response);
            }

            observer.complete();

        }


    }


}



module.exports = Api;