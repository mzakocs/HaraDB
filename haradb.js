// HaraDB
// A light-weight Haraka logging plugin
// ------------------------------------

// Import Node Modules
var fs = require("fs");
var path = require("path");
var dateFormat = require('dateformat');
var cfg;

// Register Function: Setup Config and Hooks
exports.register = function () {
    var plugin = this;

    plugin.load_accounting_file_ini();
    plugin.register_hook('init_master', 'init_plugin');
    plugin.register_hook('init_child', 'init_plugin');
    plugin.register_hook('queue_outbound', 'set_header_to_note');
    plugin.register_hook('delivered', 'delivered');
    plugin.register_hook('deferred', 'deferred');
    plugin.register_hook('bounce', 'boucne');
}

// Plugin Initialization: Setup Directories and Hooks
exports.init_plugin = function (next) {
    // OR Bitwise Operator just in case the config is not setup properly
    var context = this;
    var storage_path = cfg.main.path || path.join(process.env.HARAKA, "haradb");
    var separator = cfg.main.separator || "     ";
    var file_extension = cfg.main.extension || "tsv";

    // Global Variables stored in Notes
    server.notes.storage_path = storage_path;
    server.notes.separator = separator;
    server.notes.file_extension = file_extension;
    server.notes.delivered_path = path.join(storage_path, "delivered");
    server.notes.deferred_path = path.join(storage_path, "deferred");
    server.notes.bounce_path = path.join(storage_path, "bounce");
    server.notes.delivered_fields	= ["type","timeLogged","timeQueued","rcpt","srcMta","srcIp","vmta","jobId","dsnStatus","dsnMsg"];
    server.notes.deferred_fields	= ["type","timeLogged","timeQueued","rcpt","srcMta","srcIp","vmta","jobId","dsnStatus","dsnMsg","delay"];
    server.notes.bounce_fields      = ["type","timeLogged","timeQueued","rcpt","srcMta","srcIp","vmta","jobId","dsnStatus","dsnMsg","bounceCat"];

    // Creating Plugin Directories
    createDirectoryIfNotExist(storage_path);
    createDirectoryIfNotExist(server.notes.delivered_path);
    createDirectoryIfNotExist(server.notes.deferred_path);
    createDirectoryIfNotExist(server.notes.bounce_path);

    // Create Plugin Files
    GenerateNewFile('delivered');
    GenerateNewFile('deferred');
    GenerateNewFile('bounce');
    
    //Log successful load of plugin
    context.loginfo("HaraDB is Ready!");

    return next();
}

// Sets the header of the email to a global note variable for future use with the custom_FIELD parameter
exports.set_header_to_note = function (next, connection) {
    connection.transaction.notes.header = connection.transaction.header;
}

// Delivered Function: Harvests Information from delivered e-mails to log
exports.delivered = function (next, hmail, params) {
    var plugin = this;
    var todo = hmail.todo;
    var header = hmail.notes.header;

    if (!todo) return next();

    var fields_values = {};

    // A For Each Loop to go through all the fields set up in the config and grab them from the e-mail
    server.notes.delivered_fields.forEach (function (field) {
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
            case "vmta" :
                fields_values.vmta = server.notes.vmta || " ~ ";
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

    addRecord(server.notes.delivered_file_path, server.notes.delivered_fields, fields_values, 'delivered', this);

    plugin.loginfo("Record Added (Delivered)")
    
    return next();
};

exports.deferred = function (next, hmail, params) {
    var plugin = this;
    var todo = hmail.todo;
    var header = hmail.notes.header;

    if (!todo) return next();

    var fields_values = {};

    server.notes.deferred_fields.forEach (function (field) {
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
            case "vmta" :
                fields_values.vmta = server.notes.vmta || " ~ ";
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

    addRecord(server.notes.delivered_file_path, server.notes.deferred_fields, fields_values, 'deferred', this);

    plugin.loginfo("Record Added (Deferred)");

    return next();
};

exports.bounce = function(next, hmail, error) {
    var plugin = this;
    var todo = hmail.todo;
    var header = hmail.notes.header;
    
    if (!todo) return next();
    
    var fields_values = {};

    server.notes.bounce_Fields.forEach (function(field) {
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
            case "vmta" :
                fields_values.vmta = server.notes.vmta || " ~ ";
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
            case "bounceCat" :
                fields_values.bounceCat = rcpt_to.reason || (rcpt_to.dsn_code + " (" + rcpt_to.dsn_msg + ")");
                break;
            case "delay" :
                fields_values.delay = " ~ ";
                break;
            }
        });

        addRecord(server.notes.bounce_file_path, server.notes.bounce_fields, fields_values, 'bounce', this);

        plugin.loginfo("Record Added (Bounce)")

        // Prevents Haraka from sending the boucned email back to the original sender
        return next(OK);
};

exports.shutdown = function () { 
    plugin.loginfo("Shutting Down HaraDB");
};

exports.load_HaraDB_File_Config = function () {
    var plugin = this;
    plugin.loginfo("HaraDB Configs Loaded from haradb.ini")
    cfg = plugin.config.get("haradb.ini", function() {
        plugin.register();
    });
    plugin.loginfo(cfg);
};

// Generates a file based on the type of message that was sent or received.
var GenerateNewFile = function (type){
    if ( type == 'delivered' ){
        // Sets the path, filename and filetype of the log file.
        server.notes.delivered_file_path = path.join( server.notes.delivered_dir_path, "d." + dateFormat(new Date(), "yyyy-mm-dd-HHMMss") + "." + server.notes.files_extension);
        
        // Creates the delivered log file in the specified path and fields.
        createFileIfNotExist(server.notes.delivered_file_path, server.notes.delivered_fields);

        // Function returns the path where the file was created.
        return path.basename(server.notes.delivered_file_path);
    }
    else if ( type == 'deferred' ){
        // Sets the path, filename and filetype of the log file.
        server.notes.deferred_file_path = path.join( server.notes.deferred_dir_path, "t." + dateFormat(new Date(), "yyyy-mm-dd-HHMMss") + "." + server.notes.files_extension);
        
        // Creates the deferred log file in the specified path and fields.
        createFileIfNotExist(server.notes.deferred_file_path, server.notes.deferred_fields);

        // Function returns the path where the file was created.
        return path.basename(server.notes.deferred_file_path);
    }
    else if ( type == 'bounce' ){
        // Sets the path, filename and filetype of the log file.
        server.notes.bounce_file_path = path.join( server.notes.bounce_dir_path, "b." + dateFormat(new Date(), "yyyy-mm-dd-HHMMss") + "." + server.notes.files_extension);
        
        // Creates the bounce log file in the specified path and fields.
        createFileIfNotExist(server.notes.bounce_file_path, server.notes.bounce_fields);

        // Function returns the path where the file was created.
        return path.basename(server.notes.bounce_file_path);
    }
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

    fields.forEach ( function (field) {
        headers += field + server.notes.separator;
    });

    fs.writeFileSync(filename, headers + "\r\n");
};

// Adds a new record to the log file based on the fields
var addRecord = function (filename, fields, fields_values, type, context) {
    var separator 	= server.notes.separator;
    var record 		= "";

    fields.forEach  ( function (field) {
        record += fields_values[field] + separator;
    });

    fs.appendFileSync(filename, record + "\r\n");
};