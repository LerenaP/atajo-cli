



class Consul {

    constructor() {
        this.config = require("../../config").CONSUL; 
        this.consul = require('consul')(this.config.api);     
    }

    async fetch(domain = false) { 
        try { 
          const credentials = { 
              key :  this.config.credentials.key += domain || "",
              token:  this.config.credentials.token
          }
          let response = await this.consul.kv.get(credentials); 
          if(response && response.Value)
          return JSON.parse(response.Value); 
        } catch(e) { 
          throw new Error("Consul Fetch Error : "+e.stack); 
        }
    }

}

module.exports = new Consul(); 
