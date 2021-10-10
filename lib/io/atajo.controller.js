

const request = require('request');
const path = require('path'); 
const Consul = require('./atajo.consul');
const cpuLen = require('os')
    .cpus()
    .length;

const cp = require('child_process');

class LambdaController { 

        constructor(domain, secret) { 
            this.domain = domain; 
            this.secret = secret; 
            this.ioBuffer = {}; 
            this.ioPath = path.join(__dirname, 'start.js');
        }

        standalone() { 
            const io = cp.fork(this.ioPath);
            io.on('message', (m) => {});
            io.send({id: 0, domain: this.domain, secret: this.secret});
        }


        cluster() { 

               this.fetchIdentity(this.domain, (identity) => { 

                //LEGACY CONFIG SUPPORT
                if(identity.core.dev) { 
                    identity.core = identity.core.dev; 
                }

                const coreHost = identity.core.protocol + '://' + identity.core.host + ':' + identity.core.port

             /*   request.get(coreHost+'/size', (error, response, size) => { 

                       if(error || (response && response.statusCode !== 200)) { 
                           console.log("COULD NOT GET SIZE FROM CORE @ "+coreHost+"/size : ", error); 
                           process.exit(0); 
                       }

                       console.log("CORE SIZE IS : "+size+" // CPU LEN IS "+cpuLen);  */ 
    
                 for (let i = 0; i < cpuLen; i++) {

                    //console.log("SPAWINING "+i); 

                    this.ioBuffer[i] = cp.fork(this.ioPath);
                    this.ioBuffer[i].on('message', (m) => {
                        //console.log('Buffer ' + i + ' got message:', m);
                    });
                    this.ioBuffer[i].send({id: i, release: this.release, domain: this.domain, secret: this.secret});
                }


                })
                
              

             /*  });  */ 
                       
        }


        fetchIdentity(domain, callback) {

            const consul = new Consul()
        
            consul
                .get()
                .subscribe(response => {
    
                    callback(JSON.parse(response.value))     
                }, error => {
    
                    console.log("CONSUL UPDATE ERROR : ", error);
    
                }, () => {});
    
            
            consul
                .map(domain);



        }



}

module.exports = LambdaController; 