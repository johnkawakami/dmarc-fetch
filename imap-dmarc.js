const imaps = require('imap-simple');
const fs= require('fs');

function Search(connection) {
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
Search.prototype.DMARCReport = function() {
    var connection = this.connection;
    console.log('DMARCReport: searching...');
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
            console.log('DMARCReport: found', result.length);
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

function Dig(connection) {
    this.directory = '/tmp';
    this.connection = connection;
}
Dig.prototype.saveFirstTextPlain = function(config, message) {
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
Dig.prototype.saveFirstZipAttachment = function(config, message) {
    console.log('Dig.saveFirstZipAttachment');
    var connection = this.connection;
    var directory = config.directory || this.directory;
    var first = message.partsMeta.find(function (element, index, array) {
        return element.type === 'application' && 
            ( element.subtype === 'x-zip-compressed' || 
                element.subtype === 'zip' );
    });
    return connection.getPartData(message, first)
    .then(function(partData) {
        var filename = config.filename || 
            first.disposition.params.filename || 
            'attachment.zip';
        var filepath = directory + "/" + filename;
        fs.writeFileSync(filepath, partData, {flag:'w'});
        return filepath;
    })
    .catch(function(err) {
    });
};

/*
 * Gmail
 */
Dig.prototype.saveZipBody = function(config, message) {
    console.log('Dig.saveZipBody');
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
    })[0].body;
    var contentTypeHeader = parseEmailHeaderLine(headers['content-type']);
    var contentDispositionHeader = parseEmailHeaderLine(headers['content-disposition']);
    var contentTransferEncoding = headers['content-transfer-encoding'][0].toUpperCase();

    var body = message.parts.filter(function (a) {
        return (a.which === 'TEXT');
    })[0].body;

    var buffer;
    if (contentTransferEncoding === 'BASE64') {
        buffer = new Buffer(body, 'base64');
    } else {
        console.log('Unknown encoding ' + contentTransferEncoding);
        return;
    }
    
    var filename = config.filename || 
        contentDispositionHeader.attributes.filename || 
        contentTypeHeader.attributes.name || 
        'attachment.zip';
    var filepath = directory + "/" + filename;
    console.log('Writing', filepath);
    fs.writeFileSync(filepath, buffer, {flag:'w'});
    return filepath;
};

/**
 * Input looks like an array of strings:
 * [ 'application/zip; \tname="google.com!riceball.com!1468540800!1468627199.zip"' ]
 * @returns { value: application/zip, attributes: { name: _thename_ }}
 *
 * fixme - this probably doesn't conform to the RFC for email headers.
 */
function parseEmailHeaderLine(lines) {
    var result = {};
    var line = lines.join("\n");
    var parts = line.split(/;/);
    parts = parts.map(function(a) { return a.trim(); });

    // if the first element doesn't contain an '=', it's the value
    if (! parts[0].match(/=/) ) {
        result.value = parts[0];
        parts.shift();
    }

    var attributes = {};
    parts.map(function (a) {
        var side = a.split(/=/);
        var obj = {};
        if (side[1].match(/^".+"$/)) {
            side[1] = side[1].slice(1,-1);
        }
        attributes[side[0]] = side[1];
    });
    result.attributes = attributes;
    return result;
}

module.exports = {
    Search: Search,
    Dig: Dig
};
