let IO = require('./atajo.io');

if (!process.send) {

    var args = process.argv.splice(process.execArgv.length + 2);

    if (!args[0]) {
        console.error("Domain not defined - e.g. node io/start.js dev domain secret");
        process.exit(1);
    } else if (!args[0]) {
        console.error("Secret not defined - e.g. node io/start.js dev domain secret");
        process.exit(1);
    }

    new IO(args[0], args[1], args[2]);

} else {

    process.on('message', function (message) {
      new IO(message.domain, message.secret, message.id);
    });

}