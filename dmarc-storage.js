
const mysql = require('mysql');

function DMARCStorageMySQL(config) {
    this.connection = mysql.createConnection(config);
    this.connection.connect(function(err) {
        if (err) {
            if (err.code==='ER_ACCESS_DENIED_ERROR') {
                console.log();
                console.log("Access Denied Error. Make sure you have");
                console.log("set up a database named:",config.database);
                console.log("on the host:", config.host );
                console.log("and grant access to the user:", config.user);
                console.log("with the password:", config.password);
                console.log();
                console.log("In the shell:");
                console.log("  mysqladmin create",config.database,"-u root -p");
                console.log("  mysql -u root -p");
                console.log();
                console.log("In MySQL:");
                console.log("CREATE USER '"+config.user+"'@'%' IDENTIFIED BY '"+config.password+"';");
                console.log("GRANT ALL ON TABLE dmarc.* TO 'dmarc'@'%';");
                console.error();
            } else if (err.code==='ER_DBACCESS_DENIED_ERROR') {
                console.error();
                console.log("Your database and user exist but you cannot access it.");
                console.log("GRANT ALL ON TABLE dmarc.* TO 'dmarc'@'%';");
                console.error();
            } else {
                console.error(err);
            }
        }
    });
}
DMARCStorageMySQL.prototype.insert = function(row) {
    var connection = this.connection;
    return connection.query({
        sql: "INSERT IGNORE INTO dmarc.dmarc (org_name, begin_time, end_time, source_ip, mail_count) VALUES (?,?,?,?,?)",
        values: row
    }, function(err, results, fields) {
        if (!err) {
            console.log("Inserted", row[0], row[1]);
        } else {
            console.log(err);
        }
    });
};
/**
 * Call end() to wait until all the inserts finish.
 */
DMARCStorageMySQL.prototype.end = function() {
    console.log('closing the connection');
    this.connection.end(function (err) {
        if (err) {
            console.error(err);
        }
    });
};

module.exports = {
    "DMARCStorageMySQL": DMARCStorageMySQL
}
