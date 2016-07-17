#! /usr/bin/env node

const fs= require('fs');
const imaps = require('imap-simple');
const crypto = require('crypto');
const hash = crypto.createHash('sha256');

try {
    var config = JSON.parse(fs.readFileSync('./config.json'));
} catch (err) {
    console.log('unable to read config file');
    console.log(err);
    process.exit(1);
}


imaps.connect(config)
.then(function (connection) {
    console.log('connected');
    var search = new IMAPSearcher(connection);
    var dig = new IMAPDig(connection);
    search.DMARCReport()
    .then(function (messages) {
        var m = messages
            .filter(function(message) {
                return (message.dmarc.submitter === 'google.com');
            })
            .map(function(message) {
                return dig.saveZipBody({}, message);
                // return dig.saveFirstZipAttachment({}, message);
                //var fn = message.dmarc.reportID + ".txt";
                //return dig.saveFirstTextPlain({filename:fn}, message);
            });

        return Promise.all(m);
    })
    .then(console.log)
    .then(process.exit);
})
.catch(function(err) {
    console.log("error");
    console.log(err);
    process.exit(1);
});


function IMAPSearcher(connection) {
    this.connection = connection;
}

/*
 * Finds all the DMARC messages based on the subject
 * line format, and then appends some metadata to the messages.
 * @return Promise that resolves to a list of messages.
 *
 * The partsMeta attribute is the result of calling getParts
 * to get the body parts.
 *
 * Metadata looks like this:
 *   dmarc:
     { reportDomain: 'riceball.com',
       submitter: 'google.com',
       reportID: '16778013222784109649' } }
    partsMeta:
    [ Object, object ]
 *
 */
IMAPSearcher.prototype.DMARCReport = function() {
    var connection = this.connection;
    return connection.openBox('INBOX')
    .then(function () {
        var searchCriteria = [
            ['SUBJECT', 'Report domain:'],
            ['SUBJECT', 'Submitter:'],
            ['SUBJECT', 'Report-ID:']
        ];

        var fetchOptions = {
            bodies: ['HEADER', 'TEXT'],
            markSeen: false,
            struct: true
        };

        return connection.search(searchCriteria, fetchOptions)
        .then(function(result) {
            var augmented = result.map(function (a) {
                var subject = a.parts[0].body.subject;
                var parts =
                    /Report domain: (.+) Submitter: (.+) Report-ID: (.+)$/i
                    .exec(subject);
                a['dmarc'] = {
                    reportDomain: parts[1],
                    submitter: parts[2],
                    reportID: parts[3]
                };
                var partsMeta = imaps.getParts(a.attributes.struct);
                a['partsMeta'] = partsMeta;
                return a;
            });
            return augmented;
        })
        .catch(function(error) {
            console.log(error);
        });
    })
    .catch(function (error) {
        console.log(error);
    });
};



/*
 * Library to Dig into a message and save the body or attachment.
 *
 * var config = {
 *   directory: /full/path/to/directory
 *   filename: specific filename
 * }
 *
 * Google sends a base64 encoded zip file as the body.
 * Hotmail sends a multipart/mixed body with two parts, the
 * second part bein g the zip file.
 * Yahoo sends a multipart/mixed similar to Hotmail.
 */

function IMAPDig(connection) {
    this.directory = '/tmp';
    this.connection = connection;
}
IMAPDig.prototype.saveFirstTextPlain = function(config, message) {
    var connection = this.connection;
    var filename = config.filename || 'text.txt';
    var directory = config.directory || this.directory;
    var filepath = directory + "/" + filename;
    var first = message.partsMeta.find(function (element, index, array) {
        return element.type === 'text' && element.subtype === 'plain';
    });
    return connection.getPartData(message, first)
    .then(function (partData) {
        fs.writeFileSync(filepath, partData, {flag:'w'});
        return filepath;
    })
    .catch(function(err) {
        console.log(err);
    });
};

/*
 * Yahoo and Hotmail
 */
IMAPDig.prototype.saveFirstZipAttachment = function(config, message) {
    var connection = this.connection;
    var directory = config.directory || this.directory;
    var first = message.partsMeta.find(function (element, index, array) {
        return element.type === 'application' && 
            ( element.subtype === 'x-zip-compressed' || 
                element.subtype === 'zip-compressed' );
    });
    console.log(first);
    return connection.getPartData(message, first)
    .then(function(partData) {
        var filename = config.filename || 
            first.disposition.params.filename || 
            'attachment.zip';
        var filepath = directory + "/" + filename;
        console.log(filepath);
        fs.writeFileSync(filepath, partData, {flag:'w'});
        return filepath;
    })
    .catch(function(err) {
    });
};

/*
 * Gmail
 */
IMAPDig.prototype.saveZipBody = function(config, message) {
    var connection = this.connection;
    var directory = config.directory || this.directory;
    /*
     * fixme
     * Here we have to read the header objects to find
     * the filename, mime type, etc.
     * Headers are:
     *
     * Content-Type: application/zip; name="....zip"
     * Content-Disposition: attachment; filename="....zip"
     * Content-Transfer-Encoding: base64
     */
    //var subject = a.parts[0].body.subject;
    // find the headers parts
    var headers = message.parts.filter(function (a) {
        return (a.which === 'HEADER');
    });
    console.log(headers[0].body);
    return connection.getPartData(message)
    .then(function(partData) {
        var filename = config.filename || 
            message.headers.filename || 
            'attachment.zip';
        var filepath = directory + "/" + filename;
        console.log(filepath);
        // fs.writeFileSync(filepath, partData, {flag:'w'});
        return filepath;
    })
    .catch(function(err) {
    });
};

/**
 * Input looks like:
 * [ 'application/zip; \tname="google.com!riceball.com!1468540800!1468627199.zip"' ]
 * @returns { value: value, attributes: { name: value, ... }}
 */
function parseEmailHeaderLine(line) {
}
