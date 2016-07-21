
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
        sql: "INSERT INTO dmarc.dmarc (org_name, begin_time, end_time, source_ip, mail_count) VALUES (?,?,?,?,?)",
        values: row
    }, function(err, results, fields) {
        if (err) {
            console.log(err);
        }
        if (results) {
            console.log("Inserted", row[0], row[1]);
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
// delete create. stop using it. Use a setup script instead. fixme
DMARCStorageMySQL.prototype.create = function() {
    console.log('create called');
    // create the table if it doesn't exist
    if (this.created===true) return;

    var connection = this.connection;
    // does table exist
    connection.beginTransaction(function (err) {
        if (err) {
            console.error(err);
            process.exit(-1);
        }
        console.log('checking that the table exists');
        connection.query("SHOW TABLES LIKE 'dmarc'", function(err, result) {
            if (err) {
                console.error(err);
            }
            if (result) {
                if (result.length === 1) {
                    console.log("dmarc table found.");
                    this.created = true;
                    return;
                } else {
                    console.log("dmarc table not found. Creating.");
                    connection.query(
                        "CREATE TABLE dmarc (org_name varchar(255), begin_time varchar(255), end_time varchar(255), source_ip varchar(128), mail_count int(11))"
                    );
                    this.created = true;
                    return;
                }
            } else {
                console.log('no result!!!');
                console.log(result);
            }
        });
        // then this.created = true; return;
        console.log('committing');
        connection.commit();
    });
};

module.exports = {
    "DMARCStorageMySQL": DMARCStorageMySQL
}
