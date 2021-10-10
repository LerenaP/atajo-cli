
const appInsights = require("applicationinsights");

class Insights { 

    constructor(domain, key) { 

            log.info("INSIGHTS: STARTING FOR "+domain+" WITH KEY "+key);

            appInsights.setup(key).start(); 
            this.telemetry = appInsights.defaultClient;
            this.telemetry.context.keys.cloudRole = domain; 
            appInsights.defaultClient.commonProperties = {
                domain: domain
              };

            return this.telemetry; 
           
    }

}

module.exports = Insights; 