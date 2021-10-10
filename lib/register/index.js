const fs = require('fs');
const ncp = require('ncp');
const path = require('path');
const main = require('caporal')('atajo register');
const Keys = require('../keys');

main
    .version(version)
    .command('add')
    .argument('<domain>', 'Domain to deploy', /^([0-9]|[a-z]|-|_)+([0-9a-z]+)$/i)
    .argument('<secret>', 'Domain secret key', /^([0-9]|[a-z])+([0-9a-z]+)$/i)
    .description('Add a domain / secret key combination that this instance of atajo-cli can process transactions for.')
    .help('Add a domain / secret key combination this instance of atajo-cli can process transactions for.')
    .action(function(args, options) {

        let keys = new Keys('.atajo.keys');
        keys.set(args.domain, args.secret).then(() => {

            console.log("Domain " + args.domain + " added!");

        })


    })
    .command('remove')
    .argument('<domain>', 'Domain to deploy', /^([0-9]|[a-z]|-|_)+([0-9a-z]+)$/i)
    .description('Removes a domain / secret key combination from this instance of atajo-cli.')
    .help('Removes a domain / secret key combination from this instance of atajo-cli.')
    .action(function(args, options) {


        let keys = new Keys('.atajo.keys');
        keys.del(args.domain).then(() => {

            console.log(args.domain + ' removed!');

        }).catch(e => {

            console.log(args.domain + ' could not removed : ', e);

        })



    })
    .command('list')
    .description('Lists the current registered domain / secret key combinations')
    .help('Lists the current registered domain / secret key combinations')
    .action(function(args, options) {


        let keys = new Keys('.atajo.keys');
        keys.list().then(keys => {

            console.log('-----------------------------------------------------');
            console.log();
            for (var k in keys) {
                console.log('   ' + k + '     ' + keys[k]);
            }
            console.log();
            console.log('------------------------------------------------------');

        }).catch(e => {

            console.log(args.domain + ' could not removed : ', e);

        })



    });

process.argv.splice(2, 1);
process.argv[1] = 'atajo register';
main.parse(process.argv);