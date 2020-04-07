// HaraDB
// A light-weight Haraka logging plugin
// Created by Mitch Zakocs under GNU
// ------------------------------------

// Import Node Modules
var pg = require("pg")
var dateFormat = require("dateformat");
var cfg;
// Register Function: Setup Config and Hooks
exports.register = function () {
    var plugin = this;
    plugin.load_HaraDB_File_Config();
    plugin.register_hook('init_master', 'init_plugin');
    plugin.register_hook('init_child', 'init_plugin');
    plugin.register_hook('queue_outbound', 'set_header_and_body_to_note');
    plugin.register_hook('data', 'data');
    plugin.register_hook('send_email', 'send_email')
    plugin.register_hook('delivered', 'delivered');
    plugin.register_hook('deferred', 'deferred');
    plugin.register_hook('bounce', 'bounce');
}

exports.init_plugin = function (next) {
    var plugin = this;
    // Gets all of the values from the config file
    var pg_host = cfg.postgres.host || "localhost";
    var pg_user = cfg.postgres.user || "admin";
    var pg_database = cfg.postgres.database || "haradb";
    var pg_password = cfg.postgres.password || "password";
    var pg_port = cfg.postgres.port || "5432";
    
    // Postgres Logging Setup
    // Connects to the Postgres Server and create the Pool, Database & Table if PG is enabled in the config
    this.pool = new pg.Pool({
        user: pg_user,
        host: pg_host,
        database: pg_database,
        password: pg_password,
        port: pg_port
    });
    plugin.setupTables();
    plugin.loginfo("HaraDB is Ready!");
    return next();
};

// Grabs the body from the e-mail and parses it into plain text
exports.data = function (next, connection) 
{ 
   var plugin = this;
   connection.transaction.parse_body = true; 
   connection.transaction.add_body_filter(/text\/(plain|html)/, function (ct, enc, buff)
   {
        var buf = buff.toString('utf-8');
        var pos = buf.indexOf('\<\/body\>');
        buf = buf.splice(pos-1, 0,  '<p>add this paragraph to the existing body.</p>');
        return new Buffer(buf);
    });
    next();
}

// Sets the header and body of the email to a global note variable for future use with the custom_FIELD parameter
exports.set_header_and_body_to_note = function (next, connection) {
    // Imports the connection ID, header and body
    connection.transaction.notes.header = connection.transaction.header; // Header object from Haraka
    connection.transaction.notes.body = connection.transaction.body; // Body object from Haraka
    connection.transaction.notes.connectionid = connection.uuid;
    return next();
};

exports.send_email = function (next, hmail) {
    // Imports
    var plugin = this;
    var todo = hmail.todo;
    
    // Makes sure the email is actually valid, if not it skips the e-mail.
    if (!todo) return next();

    // Array used to store each value for the query
    var valueArray = [];

    // Grabs and pushes the connection ID
    valueArray.push(hmail.notes.connectionid);

    // Grabs and pushes the concantenated string of all the recipients
    valueArray.push(todo.rcpt_to.join());

    // Grabs and pushes the sender
    valueArray.push(todo.mail_from.toString());

    // Grabs and pushes the e-mails header text
    valueArray.push(hmail.notes.header.toString()); 

    // Grabs and pushes the e-mails body text
    valueArray.push(hmail.notes.body.bodytext.toString());

    plugin.addEmailToTable(valueArray);

    return next();
}

exports.delivered = function (next, hmail, params) {
    // Imports
    var plugin = this;
    var todo = hmail.todo;
    
    // Makes sure the email is actually valid, if not it skips the e-mail.
    if (!todo) return next();

    // Array used to store each value for the query
    var valueArray = [];

    // Grab and store the parent email id
    var parentEmailConnectionID = todo.uuid.split(".")[0]; // Takes the job ID and converts it to the parents email original connection ID
    valueArray.push(plugin.findEmailID(parentEmailConnectionID));

    // Grab and store the event type
    valueArray.push("Delivered");

    // Grab and store the time queued
    valueArray.push(dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss"));

    // Add the entry to the SQL database if database saving is enabled
    plugin.addEventToTable(valueArray);

    return next();
};

exports.deferred = function (next, hmail, params) {
    // Imports
    var plugin = this;
    var todo = hmail.todo;
    
    // Makes sure the email is actually valid, if not it skips the e-mail
    if (!todo) return next();

    // Array used to store each value for the query
    var valueArray = [];

    // Grab and store the parent email id
    var parentEmailConnectionID = todo.uuid.split(".")[0]; // Takes the job ID and converts it to the parents email original connection ID
    valueArray.push(plugin.findEmailID(parentEmailConnectionID));

    // Grab and store the event type
    valueArray.push("Defer");

    // Grab and store the time queued
    valueArray.push(dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss"));

    // Add the entry to the SQL database if database saving is enabled
    plugin.addEventToTable(valueArray);

    return next();
};

exports.bounce = function(next, hmail, error) {
    // Imports
    var plugin = this;
    var todo = hmail.todo;
    
    // Makes sure the email is actually valid, if not it skips the e-mail
    if (!todo) return next();

    // Array used to store each value for the query
    var valueArray = [];

    // Grab and store the parent email id
    var parentEmailConnectionID = todo.uuid.split(".")[0]; // Takes the job ID and converts it to the parents email original connection ID
    valueArray.push(plugin.findEmailID(parentEmailConnectionID));

    // Grab and store the event type
    valueArray.push("Bounce");

    // Grab and store the time queued
    valueArray.push(dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss"));

    // Add the entry to the SQL database if database saving is enabled
    plugin.addEventToTable(valueArray);

    // Prevents Haraka from sending the bounced email back to the original sender
    return next(OK);

    // Old code that had way too many values that weren't useful
    // server.notes.fields.forEach (function(field) {
    //     switch (field) {
    //         case "type" :
    //             fields_values.type = "Bounce";
    //             break;
    //         case "timeLogged" :
    //             fields_values.timeLogged = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    //             break;
    //         case "timeQueued" :
    //             fields_values.timeQueued = dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss");
    //             break;
    //         case "rcpt" :
    //             fields_values.rcpt = todo.rcpt_to.join();
    //             break;
    //         case "srcMta" :
    //             fields_values.srcMta = todo.notes.outbound_helo;
    //             break;
    //         case "srcIp" :
    //             fields_values.srcIp = todo.notes.outbound_ip;
    //             break;
    //         case "destIp" :
    //             fields_values.destIp = " ~ ";
    //             break;
    //         case "jobId" :
    //             fields_values.jobId = todo.uuid;
    //             break;
    //         case (field.math(/^custom_/) || {}).input() :
    //             fields_values[field] = header.get(field) || " ~ ";
    //             break;
    //         case "dsnStatus" :
    //             fields_values.dsnStatus = rcpt_to.dsn_code || rcpt_to.dsn_status;
    //             break;
    //         case "dsnMsg" :
    //             if (rcpt_to.hasOwnProperty("dsn_code"))
    //                 fields_values.dsnMsg = rcpt_to.reason || (rcpt_to.dsn_code + " " + rcpt_to.dsn_msg);
    //             else if (rcpt_to.hasOwnProperty("dsn_smpt_code"))
    //                 fields_values.dsnMsg = rcpt_to.dsn_smtp_code + " " + rcpt_to.dsn_status + " " + rcpt_to.dsn_smpt_response;
    //             else
    //                 fields_values.dsnMsg = " ~ ";
    //             break;
    //         case "delay" :
    //             fields_values.delay = " ~ ";
    //             break;
    //         }
    //     });
};

exports.setupTables = function () {
    // Sets up the tables on plugin startup if they do not already exist.
    var plugin = this;

    // Sets up the event table
    var eventsTableQuery = 'CREATE TABLE IF NOT EXISTS events(event_id BIGSERIAL PRIMARY KEY NOT NULL, email_id INTEGER NOT NULL, event_type TEXT NOT NULL, time_queued TIMESTAMP NOT NULL)';
    plugin.pgQueryText(eventsTableQuery);

    // Sets up the emails table
    var emailsTableQuery = 'CREATE TABLE IF NOT EXISTS emails(email_id BIGSERIAL PRIMARY KEY NOT NULL, job_id UUID NOT NULL, recipients TEXT NOT NULL, sender TEXT NOT NULL, header TEXT, body TEXT)';
    plugin.pgQueryText(emailsTableQuery);
};

exports.addEmailToTable = function (values) {
    // Adds an email entry into the emails table.
    var plugin = this;
    var emailQuery = 'INSERT INTO emails(connection_id, recipients, sender, header, body) VALUES ($1, $2, $3, $4, $5)';
    plugin.pgQueryValues(emailQuery, values);
};

exports.addEventToTable = function (values) {
    // Adds an event entry into the events table.
    var plugin = this;
    var eventQuery = 'INSERT INTO events(email_id, event_type, time_queued) VALUES ($1, $2, $3)';
    plugin.pgQueryValues(eventQuery, values);
};

exports.findEmailID = function (connectionID) {
    // Gets the email_id based on the original emails connection/job ID.
    return this.pgQueryValues('SELECT * IN emails WHERE connection_id = ' + connectionID.toString());
};

exports.pgQueryText = function (text) {
    // Sends a query with only text.
    var plugin = this;
    plugin.pool.connect(function (conErr, client, done) {
        if (conErr) {
            plugin.logerror('Error fetching client from PG pool ' + conErr);
        }
        // Uses the pooled client to send a query with text only to the database
        client.query(text, function (err, result) {
            // Releases the client back to the pool
            done();

            if (err) {
                plugin.logerror('Error running query ' + err);
            }
            return result;
        });
    });
};

exports.pgQueryValues = function (text, values) {
    // Sends a query with text and values.
    var plugin = this;
    plugin.pool.connect(function (conErr, client, done) {
        if (conErr) {
            plugin.logerror('Error fetching client from PG pool ' + conErr);
        }
        // Uses the pooled client to send a query with text and values to the database
        client.query(text, values, function (err, result) {
            // Releases the client back to the pool
            done();
            if (err) {
                plugin.logerror('Error running query ' + err);
            }
            return result;
        });
    });
};

exports.pgQuery

exports.load_HaraDB_File_Config = function () {
    // Loads the config for Haraka.
    var plugin = this;
    plugin.loginfo("HaraDB Configs Loaded from haradb.ini!")
    cfg = plugin.config.get("haradb.ini", function() {
        plugin.register();
    });
};

exports.shutdown = function () { 
    // Called on shutdown, clears all plugin info.
    plugin.loginfo("Shutting Down HaraDB!");
    clearInterval(this._interval);
};