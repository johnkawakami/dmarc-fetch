// test code to unzip a file
//

const path = require('path');
const zipkit = require('node-zipkit');
const fs = require('fs');
const x2js_constructor = require('x2js');
var x2js = new x2js_constructor();
const mysql = require('mysql');

try {
    var config = JSON.parse(fs.readFileSync('./config.json'));
} catch (err) {
    console.log('unable to read config file');
    console.log(err);
    process.exit(1);
}

var dmarcstorage = new DMARCStorageMySQL(config.mysql);
var filename = '/tmp/hotmail.com!riceball.com!1467691200!1467777600.zip';
var xml = DMARCXmlFromZipFile(filename);
console.log(DMARCXMLToRows(xml));

function DMARCStorageMySQL(config) {
    this.connection = mysql.createConnection(config);
    this.created = false;
}
DMARCStorageMySQL.prototype.insert = function(row) {
    var connection = this.connection;
    connection.query({
        sql: "INSERT INTO foo (a,b,c) VALUES (?,?,?)",
        values: [abc]
    }, function(err, results, fields) {
    });
};
DMARCStorageMySQL.prototype.end = function() {
};
DMARCStorageMySQL.prototype.create = function() {
    // create the table if it doesn't exist
    if (this.created) return;
    // does table exist
    // then this.created = true; return;
    // else
    // create the table
};



function DMARCXMLToRows(xml) {
    var document = x2js.xml2js(xml);
    console.log(document.feedback.report_metadata);

    var orgName = document.feedback.report_metadata.org_name;
    var beginTime = document.feedback.report_metadata.date_range.begin;
    var endTime = document.feedback.report_metadata.date_range.end;

    // if record is not an array, it's just one item
    // if it's an array it's multiple items
    var rows = Array.isArray(document.feedback.record) ?
                document.feedback.record :
                [ document.feedback.record ];

    return rows.map(function (row) {
        var sourceIP = row.row.source_ip;
        var count = row.row.count;
        return [ orgName, beginTime, endTime, sourceIP, count ];
    });
}


function DMARCXmlFromZipFile(filepath) {
    var dirname = stripFilenameExtension(filepath);
    zipkit.unzipSync(filepath, dirname);

    var xmlFileName = path.basename(filepath, '.zip') + '.xml';
    var xml = fs.readFileSync( dirname + path.sep + xmlFileName, {encoding:'utf8'} );
    return xml;
}

function stripFilenameExtension(filepath) {
    try {
        if (filepath.match(/\..{1,32}?$/)) {
            return filepath.replace(/\.[a-z]+?$/, '');
        }
        return filepath;
    } catch(err) {
        console.log(err);
    }
}
