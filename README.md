# HaraDB
> A Haraka plugin written in Javascript for logging outbound e-mail traffic to a PostgreSQL database.

Haraka has no built in logging functionality for an outbound e-mail server, so this plugin was created to easily record all outbound e-mail data into a PostgreSQL database. This can easily be updated to any other type of SQL database, and the specific data uploaded from each e-mail can also be changed easily through a configuration file.  

## Requirements
You must have an outbound Haraka server already setup for this to work. I reccomend following this tutorial for that: 
> [Creating an E-Mail Service with Haraka](https://thihara.github.io/Creating-E-Mail-Service-with-Haraka/) 
 
After you have that set up, HaraDB only requires 2 extra node.js packages:

> npm install dateformat  

> npm install pg

The first is for easy date formatting, the second is the PostgreSQL integration package.

## Release History
* 1.2
    * Fixed email_id sequence skipping numbers when an e-mail gets sent to more than one address
    * Added compare query instead of using conflicts for above
* 1.1
    * Accidentally skipped a version number v_v
* 1.0
    * Fully functioning logging system with PostgreSQL
    * Logs both main e-mails and events that occur with the e-mails
    * Uses pool and client system for efficient queries

## Meta

Mitch Zakocs – mzakocs@gmail.com

[https://github.com/mzakocs/](https://github.com/mzakocs/)  

Distributed under the GNU General Public License. See ``LICENSE`` for more information.

## How To Use

Until the package is put onto NPM, the plugin must be installed manually:

1. Download or clone the github repo.
2. Drag "haradb.js" file into your plugins directory in your haraka server.
3. Drag the "config/haradb.ini" into your config directory in your haraka server.
4. Configure the ini file with your PostgreSQL login details.
5. Edit the SQL queries if neccessary to fit your demands.
6. Add the line 'haradb' to the /config/plugins file and launch the server.

## Contributing

1. Fork it (<https://github.com/mzakocs/HaraDB>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request
