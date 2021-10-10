
module.exports = { 
    CONSUL: {
        api: {
            host: "consul.atajo.io",
            port: 443,
            secure: true,
            promisify: true
        },
        credentials: {
            key: "mobility/domains/",
            token: "03e974f9-7bb6-777c-3046-dead07b3ba7e"
        }
    },
    INSIGHTS: {
        key: "dc3ca0bf-094b-4a2f-bab1-a87411282ee6"
    },
    API: {
        host: "atajo-3-core-prd-1-api.atajo.io",
        port: 443
    },
    SOCKET: {
        OPTIONS: {
            reconnection: false,
            reconnectionAttempts: 50,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.5,
            timeout: 30000,
            autoConnect: true,
            transports: ["websocket"]
        }
    },
    QUEUE: { 
        port : 1883
    }
}