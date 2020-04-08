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
    plugin.pool = new pg.Pool({
        user: pg_user,
        host: pg_host,
        database: pg_database,
        password: pg_password,
        port: pg_port
    });
    // Grabs a postgres client from the pool and sets up tables
    plugin.pool.connect(function (conErr, client, done) {
        if (conErr) {
            plugin.logerror('Error fetching client from PG pool ' + conErr);
        }
        var client = client;
        plugin.setupTables(client);
        done();
    });
    plugin.loginfo("HaraDB is Ready!");
    return next();
};

// Grabs the body from the e-mail and parses it into plain text
exports.data = function (next, connection) 
{ 
   var plugin = this;
   connection.transaction.parse_body = true; 
//    connection.transaction.add_body_filter(/text\/(plain|html)/, function (ct, enc, buff){
//         var buf = buff.toString('utf-8');
//         var pos = buf.indexOf('\<\/body\>');
//         buf = buf.splice(pos-1, 0,  '<p>add this paragraph to the existing body.</p>');
//         return new Buffer(buf);
//     });
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

    // Grabs a postgres client from the pool
    // Introduced as a fix to other queries happening faster than ones that had been queued before
    plugin.pool.connect(function (conErr, client, done) {
        if (conErr) {
            plugin.logerror('Error fetching client from PG pool ' + conErr);
        }
        // Array used to store each value for the query
        var valueArray = [];

        // Grabs and pushes the connection ID
        valueArray.push(hmail.notes.connectionid.toString().toLowerCase());

        // Grabs and pushes the concantenated string of all the recipients
        // TODO: Figure out a better solution to store the recipients, current concantenated string is not a good idea for SQL querying
        valueArray.push(todo.rcpt_to.join(", ").replace("<", "").replace(">", ""));

        // Grabs and pushes the sender
        valueArray.push(todo.mail_from.toString().replace("<", "").replace(">", ""));

        // Grabs and pushes the e-mails subject text
        valueArray.push(hmail.notes.header["headers_decoded"]["subject"].toString()); 

        // Grabs and pushes the e-mails body text
        valueArray.push(hmail.notes.body.bodytext.toString());

        plugin.addEmailToTable(client, valueArray);

        // Returns the client back to the pool
        done();
    });
    return next();
}

exports.delivered = function (next, hmail, params) {
    // Imports
    var plugin = this;
    var todo = hmail.todo;
    
    // Makes sure the email is actually valid, if not it skips the e-mail.
    if (!todo) return next();

    // Grabs a postgres client from the pool
    // Introduced as a fix to other queries happening faster than ones that had been queued before
    plugin.pool.connect(function (conErr, client, done) {
        if (conErr) {
            plugin.logerror('Error fetching client from PG pool ' + conErr);
        }
        // Array used to store each value for the query
        var valueArray = [];

        // Grab and store the parent email id
        var parentEmailConnectionID = todo.uuid.split(".")[0].toLowerCase(); // Takes the job ID and converts it to the parents email original connection ID
        valueArray.push(parentEmailConnectionID);

        // Grab and store the event type
        valueArray.push("Delivered");

        // Grab and store the time queued
        valueArray.push(dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss"));

        // Add the entry to the SQL database if database saving is enabled
        plugin.addEventToTable(client, valueArray);

        // Returns the client back to the pool
        done();
    });
    return next();
};

exports.deferred = function (next, hmail, params) {
    // Imports
    var plugin = this;
    var todo = hmail.todo;
    
    // Makes sure the email is actually valid, if not it skips the e-mail
    if (!todo) return next();

    // Grabs a postgres client from the pool
    // Introduced as a fix to other queries happening faster than ones that had been queued before
    plugin.pool.connect(function (conErr, client, done) {
        if (conErr) {
            plugin.logerror('Error fetching client from PG pool ' + conErr);
        }

        // Array used to store each value for the query
        var valueArray = [];

        // Grab and store the parent email id
        var parentEmailConnectionID = plugin.findEmailID(client, todo.uuid.split(".")[0].toLowerCase()); // Takes the job ID and converts it to the parents email original connection ID
        valueArray.push(parentEmailConnectionID);

        // Grab and store the event type
        valueArray.push("Defer");

        // Grab and store the time queued
        valueArray.push(dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss"));

        // Add the entry to the SQL database if database saving is enabled
        plugin.addEventToTable(client, valueArray);

        // Returns the client back to the pool
        done();
    });
    return next();
};

exports.bounce = function(next, hmail, error) {
    // Imports
    var plugin = this;
    var todo = hmail.todo;
    
    // Makes sure the email is actually valid, if not it skips the e-mail
    if (!todo) return next();

    // Grabs a postgres client from the pool
    // Introduced as a fix to other queries happening faster than ones that had been queued before
    plugin.pool.connect(function (conErr, client, done) {
        if (conErr) {
            plugin.logerror('Error fetching client from PG pool ' + conErr);
        }
        // Array used to store each value for the query
        var valueArray = [];

        // Grab and store the parent email id
        var parentEmailConnectionID = plugin.findEmailID(client, todo.uuid.split(".")[0].toLowerCase()); // Takes the job ID and converts it to the parents email original connection ID
        valueArray.push(parentEmailConnectionID);

        // Grab and store the event type
        valueArray.push("Bounce");

        // Grab and store the time queued
        valueArray.push(dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss"));

        // Add the entry to the SQL database if database saving is enabled
        plugin.addEventToTable(client, valueArray);

        // Returns the client back to the pool
        done();

    });
    // Prevents Haraka from sending the bounced email back to the original sender
    return next(OK);
};

exports.setupTables = function (client) {
    // Sets up the tables on plugin startup if they do not already exist.
    var plugin = this;

    // Sets up the event table
    var eventsTableQuery = 'CREATE TABLE IF NOT EXISTS events(event_id BIGSERIAL PRIMARY KEY NOT NULL, email_id INTEGER NOT NULL, event_type TEXT NOT NULL, time_queued TIMESTAMP NOT NULL)';
    plugin.pgQueryText(client, eventsTableQuery);

    // Sets up the emails table
    var emailsTableQuery = 'CREATE TABLE IF NOT EXISTS emails(email_id BIGSERIAL PRIMARY KEY NOT NULL, connection_id UUID NOT NULL, recipients TEXT NOT NULL, sender TEXT NOT NULL, subject TEXT, body TEXT)';
    plugin.pgQueryText(client, emailsTableQuery);
};

exports.addEmailToTable = function (client, values) {
    // Adds an email entry into the emails table.
    var plugin = this;
    var emailQuery = 'INSERT INTO emails(connection_id, recipients, sender, subject, body) VALUES ($1, $2, $3, $4, $5)';
    plugin.pgQueryValues(client, emailQuery, values);
    plugin.loginfo("Logged " + values[0] + " e-mail into database");
};

exports.addEventToTable = function (client, values) {
    // Adds an event entry into the events table.
    var plugin = this;
    var eventQuery = 'INSERT INTO events(email_id, event_type, time_queued) SELECT email_id, $2, $3 FROM emails WHERE connection_id = $1 LIMIT 1';
    plugin.pgQueryValues(client, eventQuery, values);
    plugin.loginfo("Logged " + values[0] + " " + values[1] + " event into database");
};

exports.pgQueryText = function (client, text) {
    // Sends a query with only text.
    var plugin = this;
    // Uses the pooled client to send a query with text only to the database
    client.query(text, function (err, result) {
        if (err) {
            plugin.logerror('Error running query ' + err);
        }
        return result;
    });
};

exports.pgQueryValues = function (client, text, values) {
    // Sends a query with text and values.
    var plugin = this;
    // Uses the pooled client to send a query with text and values to the database
    client.query(text, values, function (err, result) {
        if (err) {
            plugin.logerror('Error running query ' + err);
        }
        return result;
    });
};

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