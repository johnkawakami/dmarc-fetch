// test code to unzip a file
//

const fs = require('fs');
const dmarcStorage = require('./dmarc-storage.js');
const dmarcExtract = require('./dmarc-extract.js');

try {
    var config = JSON.parse(fs.readFileSync('./config.json'));
} catch (err) {
    console.log('unable to read config file');
    console.log(err);
    process.exit(1);
}

var dmarcstorage = new dmarcStorage.DMARCStorageMySQL(config.mysql);

var filename = '/tmp/hotmail.com!riceball.com!1467691200!1467777600.zip';

function DMARCtoDB(filename) {
    var xml = dmarcExtract.FromZipFile(filename);
    dmarcExtract.XMLToRows(xml).map(function (row) {
        dmarcstorage.insert(row);
    });
    dmarcstorage.end();
}


