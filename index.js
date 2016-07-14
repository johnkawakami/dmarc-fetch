#! /usr/bin/env node

var imaps = require('imap-simple');

var config = {
    imap: {
        user: 'johnk@riceball.com',
        password: 'MN23!!',
        host: 'mail.slaptech.net',
        port: 993,
        tls: true
    }
};


imaps.connect(config)
.then(function (connection) {
    console.log('connected');
    var search = new IMAPSearcher(connection);
    var dig = new IMAPDig(connection);
    search.DMARCReport()
    .then(function (messages) {
        var m = messages.filter(function(message) {
            if (message.dmarc.submitter === 'yahoo.com') {
                return true;
            } else {
                return false;
            }
        }).map(function(message) {
            return dig.saveFirstTextPlain({}, message);
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
const fs = require('fs');

function IMAPDig(connection) {
    this.directory = '/tmp';
    this.connection = connection;
}
IMAPDig.prototype.saveFirstTextPlain = function(config, message) {
    var filename = config.filename || 'text.txt';
    var directory = config.directory || this.directory;
    var filepath = directory + "/" + filename;
    console.log(filepath);
    var connection = this.connection;
    var first = message.partsMeta.find(function (element, index, array) {
        return element.type === 'text' && element.subtype === 'plain';
    });
    console.log(first);
    return connection.getPartData(message, first)
    .then(function (partData) {
        console.log('got partData');
        return fs.writeFile(filepath, 
                            partData, 
                            {encoding:'UTF8', flag:'w'});
    })
    .catch(function(err) {
        console.log(err);
    });
};

IMAPDig.prototype.saveFirstZipAttachment = function(config, message) {
    this.directory = config.directory | this.directory;
};

IMAPDig.prototype.saveZipBody = function(config, message) {
    this.directory = config.directory | this.directory;
};
