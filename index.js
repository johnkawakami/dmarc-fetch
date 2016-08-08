#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const imaps = require('imap-simple');
const crypto = require('crypto');
const hash = crypto.createHash('sha256');
const dmarcStorage = require('./dmarc-storage.js');
const dmarcExtract = require('./dmarc-extract.js');
const imapDmarc = require('./imap-dmarc.js');
var config;

function file_exists_noerrors(fn) {
    console.log("testing for", fn);
    try {
        fs.accessSync(fn, fs.R_OK);
        return true;
    } catch (err) {
        console.log(err);
        return false;
    }
}

if (file_exists_noerrors(__dirname + '/config.json')) {
    config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
} else if (file_exists_noerrors(process.env['HOME']+'/.dmarc-fetch')) {
    config = JSON.parse(fs.readFileSync(process.env['HOME']+'/.dmarc-fetch'));
} else {
    console.error("No config file .dmarc-fetch.");
    process.exit(1);
}

function insertDMARC(filename, dmarcStorage) {
    try {
        var storage = new dmarcStorage.DMARCStorageMySQL(config.mysql);
        var xml;
        if (filename.match(/.zip$/)) {
            xml = dmarcExtract.FromZipFile(filename);
        } else {
            xml = dmarcExtract.FromGzFile(filename);
        }
        dmarcExtract.XMLToRows(xml).map(function (row) {
            console.log('inserting', row);
            storage.insert(row);
        });
        storage.end();
        console.log("Saved", filename, "to database.");
        return true;
    } catch(err) {
        console.error(filename, "failed to save to database.");
        console.error(err);
        return false;
    }
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
                    return dig.saveZipBody({}, message)
                    .then(function(file) {
                        insertDMARC(file, dmarcStorage);
                    })
                    .then(function() {
                        return connection.moveMessage(message.attributes.uid, "INBOX.Trash")
                            .catch(function(err) { console.error(err) });
                    });
                }
                else if (message.dmarc.submitter === 'yahoo.com') {
                    return dig.saveFirstZipAttachment({}, message)
                    .then(function(file) {
                        insertDMARC(file, dmarcStorage);
                    })
                    .then(function(){
                        return connection.moveMessage(message.attributes.uid, "INBOX.Trash")
                            .catch(function(err) { console.error(err) });
                    });
                }
                else if (message.dmarc.submitter === 'hotmail.com') {
                    return dig.saveFirstZipAttachment({}, message)
                    .then(function(file) {
                        insertDMARC(file, dmarcStorage);
                    })
                    .then(function() {
                        return connection.moveMessage(message.attributes.uid, "INBOX.Trash")
                            .catch(function(err) { console.error(err) });
                    });
                }
                else if (message.dmarc.submitter === 'qq.com') {
                    return dig.saveFirstGzAttachment({}, message)
                    .then(function(file) {
                        insertDMARC(file, dmarcStorage);
                    })
                    .then(function() {
                        return connection.moveMessage(message.attributes.uid, "INBOX.Trash")
                            .catch(function(err) { console.error(err) });
                    });
                } else {
                    console.log("Unknown service " + message.dmarc.submitter);
                }
            });
        return Promise.all(m);
    })
    .then(function () {
        // Wait one second to exit, so inserts can complete.
        setTimeout(process.exit, 1000);
    })
    .catch(function (err) {
        console.log(err);
        process.exit();
    });
})
.catch(function(err) {
    console.log("error");
    console.log(err);
    process.exit(1);
});


