/* This file has absolutely no function inside of the program. It was only created as storage for the queries I used for my database */

/* Events Table Creation */
CREATE TABLE IF NOT EXISTS events(event_id BIGSERIAL PRIMARY KEY NOT NULL, email_id INTEGER NOT NULL, event_type TEXT NOT NULL, time_queued TIMESTAMP NOT NULL)

/* E-Mails Table Creation */
CREATE TABLE IF NOT EXISTS emails(email_id BIGSERIAL PRIMARY KEY NOT NULL, connection_id UUID NOT NULL, recipients TEXT NOT NULL, sender TEXT NOT NULL, subject TEXT, body TEXT)

/* Events Table Insertion */
INSERT INTO events(email_id, event_type, time_queued) SELECT email_id, $2, $3 FROM emails WHERE connection_id = $1 LIMIT 1

/* E-Mails Table Creation */
INSERT INTO emails(connection_id, recipients, sender, subject, body) VALUES ($1, $2, $3, $4, $5)
