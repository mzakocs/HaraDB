/* This file has absolutely no function inside of the program. It was only created as storage for the queries I used for my database */

/* Events Table Creation */
CREATE TABLE IF NOT EXISTS events(event_id BIGSERIAL PRIMARY KEY NOT NULL, email_id INTEGER NOT NULL, recipient TEXT NOT NULL, event_type TEXT NOT NULL, dsn_message TEXT, time TIMESTAMP NOT NULL)

/* E-Mails Table Creation */
CREATE TABLE IF NOT EXISTS emails(email_id BIGSERIAL PRIMARY KEY NOT NULL, connection_id UUID UNIQUE, sender TEXT NOT NULL, subject TEXT, body TEXT, mime TEXT, time TIMESTAMP NOT NULL)

/* Events Table Insertion */
INSERT INTO events(email_id, recipient, event_type, dsn_message, time) SELECT email_id, $2, $3, $4, $5 FROM emails WHERE connection_id = $1 LIMIT 1

/* E-Mails Table Creation */
INSERT INTO emails(connection_id, sender, subject, body, mime, time) VALUES ($1, $2, $3, $4, $5, $6)
