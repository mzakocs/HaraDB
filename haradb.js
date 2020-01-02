// HaraDB
// A light-weight Haraka logging plugin
// Created by Mitch Zakocs under GNU
// ------------------------------------

// Import Node Modules
var fs = require("fs");
var pg = require("pg")
var path = require("path");
var dateFormat = require('dateformat');
var cfg;

// Register Function: Setup Config and Hooks
exports.register = function () {
    var plugin = this;

    plugin.load_HaraDB_File_Config();
    plugin.register_hook('init_master', 'init_plugin');
    plugin.register_hook('init_child', 'init_plugin');
    plugin.register_hook('queue_outbound', 'set_header_to_note');
    plugin.register_hook('delivered', 'delivered');
    plugin.register_hook('deferred', 'deferred');
    plugin.register_hook('bounce', 'boucne');
    // OR Bitwise Operator just in case the config is not setup properly
    var context = this;
    var file_enabled = cfg.filelogging.enabled || "true";
    var storage_path = cfg.filelogging.storagepath || path.join("default", "haradb");
    var separator = cfg.filelogging.separator || "     ";
    var file_extension = cfg.filelogging.extension || "tsv";
    var pg_enabled = cfg.postgres.enabled || "false";
    var pg_host = cfg.postgres.host || "localhost";
    var pg_user = cfg.postgres.user || "admin";
    var pg_database = cfg.postgres.database || "haradb";
    var pg_password = cfg.postgres.password || "password";
    var pg_port = cfg.postgres.port || "3211";

    // Global Variables stored in Notes
    server.notes.storage_path = storage_path;
    server.notes.separator = separator;
    server.notes.file_extension = file_extension;
    server.notes.log_path = path.join(storage_path, "log");
    server.notes.fields =   ["type","timeLogged","timeQueued","rcpt","srcMta","srcIp","jobId","dsnStatus","dsnMsg","delay"];
    server.notes.pgdatabasequery = "CREATE DATABASE IF NOT EXIST haradb;";
    server.notes.pgtablequery = "CREATE TABLE IF NOT EXIST emails (type VARCHAR(10), TimeLogged VARCHAR(255), TimeQueued VARCHAR(255), Recipient VARCHAR (255), SourceMaterial VARCHAR (255), SourceIP VARCHAR(255), JobID VARCHAR(20), dnsMessage VARCHAR(255), Delay VARCHAR(255)";

    // File Logging Setup
    // Creates the logging directories and the log file
    if (file_enabled = "true") {
        // Creating Plugin Directories
        createDirectoryIfNotExist(storage_path);
        createDirectoryIfNotExist(server.notes.log_path);

        // Creates the log file
        GenerateLogFile();
    }
    
    // Postgres Logging Setup
    // Connects to the Postgres Server and create the Pool, Database & Table if PG is enabled in the config
    if (pg_enabled = "true") {
        this.pool = new pg.Pool({
            user: pg_user,
            host: pg_host,
            database: pg_database,
            password: pg_password,
            port: pg_port
        });
        setupDatabaseAndTables();
    }      

    // Log successful load of plugin
    context.loginfo("HaraDB is Ready!");
}

    // Sets the header of the email to a global note variable for future use with the custom_FIELD parameter
    exports.set_header_to_note = function (next, connection) {
    connection.transaction.notes.header = connection.transaction.header;
};

// Delivered Function: Harvests Information from delivered e-mails to log
exports.delivered = function (next, hmail, params) {
    var plugin = this;
    var todo = hmail.todo;
    var header = hmail.notes.header;

    if (!todo) return next();

    var fields_values = {};

    // A For Each Loop to go through all the fields set up in the config and grab them from the e-mail
    server.notes.fields.forEach (function (field) {
        switch (field) {
            case "type" :
                fields_values.type = "Delivered";
                break;
            case "timeLogged" :
                fields_values.timeLogged = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
                break;
            case "timeQueued" :
                fields_values.timeQueued = dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss");
                break;
            case "rcpt" :
                fields_values.rcpt = todo.rcpt_to.join();
                break;
            case "srcMta" :
                fields_values.srcMta = todo.notes.outbound_helo;
                break;
            case "srcIp" :
                fields_values.srcIp = todo.notes.outbound_ip;
                break;
            case "destIp" :
                fields_values.destIp = params[1] || " ~ ";
                break;
            case "jobId" :
                fields_values.jobId = todo.uuid;
                break;
            case (field.match(/^custom_/) || {}).input :
                fields_values[field] = header.get(field) || " ~ ";
                break;
            case "dsnStatus" :
                fields_values.dsnStatus = " ~ ";
                break;
            case "dsnMsg" :
                fields_values.dsnMsg = " ~ ";
                break;
            case "delay" :
                fields_values.delay = " ~ ";
                break;
        }
    });

    addRecordToFile(server.notes.fields, fields_values);
    addRecordToDatabase(server.notes.fields, fields_values);

    plugin.loginfo("Record Added (Delivered)!")
    
    return next();
};

exports.deferred = function (next, hmail, params) {
    var plugin = this;
    var todo = hmail.todo;
    var header = hmail.notes.header;

    if (!todo) return next();

    var fields_values = {};

    server.notes.fields.forEach (function(field) {
        switch (field) {
            case "type" :
                fields_values.type = "Deferred"
                break;
            case "timeLogged" :
                fields_values.timeLogged = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
                break;
            case "timeQueued" :
                fields_values.timeQueued = dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss");
                break;
            case "rcpt" :
                fields_values.rcpt = todo.rcpt_to.join(); 
                break;
            case "srcMta" :
                fields_values.srcMta = todo.notes.outbound_helo;
                break;
            case "srcIp" :
                fields_values.srcIp = todo.notes.outbound_ip;
                break;
            case "destIp" :
                fields_values.destIp = " ~ ";
                break;
            case "jobId" :
                fields_values.jobId = todo.uuid;
                break;
            case (field.match(/^custom_/) || {}).input :
                fields_values[field] = header.get(field) || " ~ ";
                break;
            case "dsnStatus" :
                fields_values.dsnStatus = rcpt_to.dsn_code || rcpt_to.dsn_status;
                break;
            case "dsnMsg" :
                fields_values.dsnMsg = rcpt_to.dsn_smtp_response;
                break;
            case "delay" :
                fields_values.delay = params.delay;
                break;
        }
    });

    addRecordToFile(server.notes.fields, fields_values);
    addRecordToDatabase(server.notes.fields, fields_values);

    plugin.loginfo("Record Added (Deferred)!");

    return next();
};

exports.bounce = function(next, hmail, error) {
    var plugin = this;
    var todo = hmail.todo;
    var header = hmail.notes.header;
    
    if (!todo) return next();
    
    var fields_values = {};

    server.notes.fields.forEach (function(field) {
        switch (field) {
            case "type" :
                fields_values.type = "Bounce";
                break;
            case "timeLogged" :
                fields_values.timeLogged = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
                break;
            case "timeQueued" :
                fields_values.timeQueued = dateFormat(new Date(todo.queue_time), "yyyy-mm-dd HH:MM:ss");
                break;
            case "rcpt" :
                fields_values.rcpt = todo.rcpt_to.join();
                break;
            case "srcMta" :
                fields_values.srcMta = todo.notes.outbound_helo;
                break;
            case "srcIp" :
                fields_values.srcIp = todo.notes.outbound_ip;
                break;
            case "destIp" :
                fields_values.destIp = " ~ ";
                break;
            case "jobId" :
                fields_values.jobId = todo.uuid;
                break;
            case (field.math(/^custom_/) || {}).input() :
                fields_values[field] = header.get(field) || " ~ ";
                break;
            case "dsnStatus" :
                fields_values.dsnStatus = rcpt_to.dsn_code || rcpt_to.dsn_status;
                break;
            case "dsnMsg" :
                if (rcpt_to.hasOwnProperty("dsn_code"))
                    fields_values.dsnMsg = rcpt_to.reason || (rcpt_to.dsn_code + " " + rcpt_to.dsn_msg);
                else if (rcpt_to.hasOwnProperty("dsn_smpt_code"))
                    fields_values.dsnMsg = rcpt_to.dsn_smtp_code + " " + rcpt_to.dsn_status + " " + rcpt_to.dsn_smpt_response;
                else
                    fields_values.dsnMsg = " ~ ";
                break;
            case "delay" :
                fields_values.delay = " ~ ";
                break;
            }
        });

        addRecordToFile(server.notes.fields, fields_values);
        addRecordToDatabase(server.notes.fields, fields_values);

        plugin.loginfo("Record Added (Bounce)!")

        // Prevents Haraka from sending the boucned email back to the original sender
        return next(OK);
};

exports.shutdown = function () { 
    plugin.loginfo("Shutting Down HaraDB!");
    clearInterval(this._interval);
};

exports.load_HaraDB_File_Config = function () {
    var plugin = this;
    plugin.loginfo("HaraDB Configs Loaded from haradb.ini!")
    cfg = plugin.config.get("haradb.ini", function() {
        plugin.register();
    });
    plugin.loginfo(cfg);
};

// Generates a file based on the type of message that was sent or received.
var GenerateLogFile = function (){
    // Sets the path, filename and filetype of the log file.
    server.notes.log_path = path.join(server.notes.log_path, "d." + dateFormat(new Date(), "yyyy-mm-dd  HH-MM-ss") + "." + server.notes.files_extension);
    
    // Creates the delivered log file in the specified path and fields.
    createFileIfNotExist(server.notes.log_path, server.notes.fields);

    // Function returns the path where the file was created.
    return path.basename(server.notes.log_path);
};

// Creates the directory if it does not exist.
var createDirectoryIfNotExist = function (dir_name) {
    if ( !fs.existsSync(dir_name) ) {
        fs.mkdirSync(dir_name);
    }
};

// Creates the file if it does not exist.
var createFileIfNotExist = function (filename, fields) {
    if ( !fs.existsSync(filename) ) {
        fs.writeFileSync(filename);

        // Set file header from the pre-defined fields.
        setHeaderFromFields(filename, fields);
    }
};

// Sets the header of the file based on the fields.
var setHeaderFromFields = function (filename, fields) {
    var headers = "";

    fields.forEach(function (field) {
        headers += field + server.notes.separator;
    });

    fs.writeFileSync(filename, headers + "\r\n");
};

var setupDatabaseAndTables = function () {
    const plugin = this;
    var pgdatabasequery = "CREATE DATABASE IF NOT EXIST haradb;";
    plugin.pool.query(pgdatabasequery, (err, res) => {
        if (err) {
            throw err
        }
    });
    var pgtablequery = "CREATE TABLE IF NOT EXIST emails (type VARCHAR(10), TimeLogged VARCHAR(255), TimeQueued VARCHAR(255), Recipient VARCHAR (255), SourceMaterial VARCHAR (255), SourceIP VARCHAR(255), JobID VARCHAR(20), dnsMessage VARCHAR(255), Delay VARCHAR(255)";
    plugin.pool.query(pgtablequery, (err,res) => {
        if (err) {
            throw err
        }
    });
};

// Adds a new record to the log file based on the fields
var addRecordToFile = function (fields, fields_values) {
    if (file_enabled = "true") {
        var separator 	= server.notes.separator;
        var record 		= "";

        // Puts the record into the file under their respective fields
        fields.forEach  (function (field) {
            record += fields_values[field] + separator;
        });

        // Finally edits the file with the new record
        fs.appendFileSync(server.notes.log_path, record + "\r\n");
    }
};

var addRecordToDatabase = function (fields_values) {
    if (pgenabled = "true") {
        const plugin = this;
        const recordQuery = 'INSERT INTO haradb (type, TimeLogged, TimeQueued, Recipient, SourceMaterial, SourceIP, JobID, dnsMessage, Delay) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
        // Connects to the pool to get a client
        plugin.pool.connect(function (conErr, client, done) {
            if (conErr) {
                plugin.logerror('Error fetching client from PG pool: ' + conErr);
                return callback(false);
            }
            // Uses the pooled client to send a query to the database
            client.query(recordQuery, fields_Values, function (err, result) {
                // Releases the client back to the pool
                done();

                if (err) {
                    plugin.logerror('Error running query: ' + err);
                    return callback(false);
                }

                return callback(result.rows[0].exists);
            });
        });
    }
};