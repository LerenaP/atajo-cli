/*

     Atajo Lambda v1.0.0

     A lambda is a scalable, single purpose function that is executed in order to process a transaction. 
     You have the entire NodeJS LTS stack available to you to fullfil the transaction.  
     
     events.js

     The events lambda is executed when Atajo Core events occur of interest to you. The following events are reported on : 

     - device:connect       - When a device connects to the Atajo Core with your domain. 
     - device:disconnect    - When a device disconnects to the Atajo Core with your domain. 
    
     The events lambda cannot currently resolve or reject an event. 

     GLOBALS : 

     log    - Bunyan logging with standard log.debug > log.info > log.warn > log.error available
     dbi    - Registers the schemas indicated in ./lambdas/schemas and connects them to MongoDB if available 
      
*/


class Events {

    constructor(api) {}

    request(event) {

        log.debug("EVENT", event);

        switch (event.namespace) {
            case 'client:connect':
                this.onDeviceConnect(event);
                break;
            case 'client:disconnect':
                this.onDeviceDisconnect(event);
                break;
        }

    }

    onDeviceConnect(evt) {

        //Optionally log the event 
        log.debug('device:connect : ', evt);

        //Check if global dbi is connected / available
        if (dbi) {}

    }

    onDeviceDisconnect(evt) {

        log.debug('device:disconnect : ', evt);

    }

}

//register (bind) this lambda to the Atajo Lambda Agent
require('./atajo/lambda').bind(Events);