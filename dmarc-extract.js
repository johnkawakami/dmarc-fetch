
const zipkit = require('node-zipkit');
const fs = require('fs');
const path = require('path');
const x2js_constructor = require('x2js');
var x2js = new x2js_constructor();

function XMLToRows(xml) {
    var document = x2js.xml2js(xml);

    var orgName = document.feedback.report_metadata.org_name;
    var beginTime = parseInt(document.feedback.report_metadata.date_range.begin);
    var endTime = parseInt(document.feedback.report_metadata.date_range.end);

    // if record is not an array, it's just one item
    // if it's an array it's multiple items
    var rows = Array.isArray(document.feedback.record) ?
                document.feedback.record :
                [ document.feedback.record ];

    return rows.map(function (row) {
        var sourceIP = row.row.source_ip;
        var mailCount = parseInt(row.row.count);
        return [ orgName, beginTime, endTime, sourceIP, mailCount ];
    });
}


function FromZipFile(filepath) {
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

module.exports = {
    XMLToRows: XMLToRows,
    FromZipFile: FromZipFile
};
