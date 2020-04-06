# HaraDB
> A Haraka plugin written in Javascript for logging outbound e-mail traffic to a PostgreSQL database.

Haraka has no built in logging functionality for easy overview of an outbound e-mail server, so this plugin was created to easily upload all outbound e-mail data into a PostgreSQL database. This can easily be converted to any other type of SQL database, and the specific amount of information uploaded from each e-mail can also be changed easily.  

## Requirements
You must have a fully functioning outbound Haraka server already setup for this to work. I reccomend following this tutorial for getting that set up as it helped me a lot: 
> [Creating an E-Mail Service with Haraka](https://thihara.github.io/Creating-E-Mail-Service-with-Haraka/) 
 
After you have that set up, HaraDB only requires 2 extra node.js packages:

> npm install dateformat  

> npm install pg

The first is for easy date formatting, the second is the PostgreSQL integration package.

## Release History

* 1.0
    * In Development

## Meta

Mitch Zakocs – mzakocs@gmail.com

[https://github.com/mzakocs/](https://github.com/mzakocs/)  

Distributed under the GNU General Public License. See ``LICENSE`` for more information.

## How To Use

Until I get the package up onto NPM, the plugin must be installed manually:

1. Download or clone the github repo.
2. Drag "haradb.js" file into your plugins directory in your haraka server.
3. Drag the "config/haradb.ini" into your config directory in your haraka server.
4. Configure the ini file with your PostgreSQL login details.
5. Edit the SQL queries if neccessary to fit your demands.

## Contributing

1. Fork it (<https://github.com/mzakocs/HaraDB>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request
