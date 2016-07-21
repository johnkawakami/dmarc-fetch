#! /usr/bin/env node

const fs= require('fs');
const imaps = require('imap-simple');
const crypto = require('crypto');
const hash = crypto.createHash('sha256');
const dmarcStorage = require('./dmarc-storage.js');
const dmarcExtract = require('./dmarc-extract.js');
const imapDmarc = require('./imap-dmarc.js');
var config;
try {
    config = JSON.parse(fs.readFileSync('./config.json'));
} catch (err) {
    console.log('unable to read config file');
    console.log(err);
    process.exit(1);
}

imaps.connect(config)
.then(function (connection) {
    console.log('connected');
    var search = new imapDmarc.Search(connection);
    var dig = new imapDmarc.Dig(connection);
    search.DMARCReport()
    .then(function (messages) {
        var m = messages
            .map(function(message) {
                console.log(message.dmarc.submitter);
                if (message.dmarc.submitter === 'google.com') {
                    var file = dig.saveZipBody({}, message);
                    return file;
                }
                else if (message.dmarc.submitter === 'hotmail.com') {
                    var file = dig.saveFirstZipAttachment({}, message);
                    return file;
                }
                else if (message.dmarc.submitter === 'yahoo.com') {
                    var file = dig.saveFirstZipAttachment({}, message);
                    return file;
                } else {
                    console.log("Unknown service " + message.dmarc.submitter);
                }
            });

        return Promise.all(m);
    })
    .catch(function (err) {
        console.log(err);
        process.exit();
    })
    .then(function (files) {
        var dmarcstorage = new dmarcStorage.DMARCStorageMySQL(config.mysql);
        var results = files.map(function (filename) {
            var xml = dmarcExtract.FromZipFile(filename);
            return dmarcExtract.XMLToRows(xml).map(function (row) {
                return dmarcstorage.insert(row);
            });
        });
        dmarcstorage.end();
        // console.log(results);
        return results;
    });
})
.catch(function(err) {
    console.log("error");
    console.log(err);
    process.exit(1);
});


