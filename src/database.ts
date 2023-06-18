// import { createConnection } from 'mysql';

// /**
//  * A connection to the database to run queries
//  */
// export const dbConnection = createConnection({
//     host: 'db',
//     user: process.env.MYSQLDB_USER,
//     password: process.env.MYSQLDB_PASSWORD,
//     database: process.env.MYSQLDB_DATABASE,
// });
import sqlite3 from 'sqlite3';
import { type Database, open } from 'sqlite';
import { log } from './logger';

// this is a top-level await
// open the database

// export const dbConnection = await open({
//     filename: env.DB_PATH,
//     driver: sqlite3.Database,
// });

export function setupDB(dbPath: string): Promise<Database> {
    log(`Using database at: ${dbPath}`);
    return new Promise<Database>((resolve) => {
        // if (!env.DB_PATH) {
        //     throw 'Database not found!';
        // }
        open({
            filename: dbPath,
            driver: sqlite3.Database,
        }).then((dbConnection) => {
            checkTables(dbConnection).then(() => resolve(dbConnection));
        });
    });
}

function checkTables(dbConnection: Database): Promise<void> {
    // "SELECT name FROM sqlite_schema WHERE type='table' and name NOT LIKE 'sqlite_%';"
    return new Promise<void>((resolve) => {
        type Result = { name: string }[];
        const tableNames: string[] = [];
        dbConnection
            .all("SELECT name FROM sqlite_schema WHERE type='table';")
            .then(async (results: Result) => {
                results.forEach((value) => {
                    tableNames.push(value.name);
                });
                return;
            })
            .then(() => {
                if (!tableNames.includes('locos')) {
                    dbConnection
                        .exec(
                            `
                        CREATE TABLE locos (
                            idlocos INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT(45),
                            address INTEGER,
                            description TEXT
                        );
                    `
                        )
                        .then(() => {
                            return;
                        });
                } else {
                    return;
                }
            })
            .then(() => {
                if (!tableNames.includes('turnouts')) {
                    dbConnection
                        .exec(
                            `
                        CREATE TABLE turnouts (
                            idturnouts INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT(45),
                            description TEXT,
                            coordinate TEXT,
                            primary_direction INTEGER,
                            secondary_direction INTEGER,
                            state INTEGER
                        );
                    `
                        )
                        .then(() => {
                            return;
                        });
                } else {
                    return;
                }
            })
            .then(() => {
                if (!tableNames.includes('destinations')) {
                    dbConnection
                        .exec(
                            `
                        CREATE TABLE destinations (
                            iddestinations INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT(45),
                            description TEXT,
                            coordinate TEXT
                        );
                    `
                        )
                        .then(() => {
                            return;
                        });
                } else {
                    return;
                }
            })
            .then(() => {
                if (!tableNames.includes('turnoutLinks')) {
                    dbConnection
                        .exec(
                            `
                        CREATE TABLE turnoutLinks (
                            idturnoutLinks INTEGER PRIMARY KEY AUTOINCREMENT,
                            length INTEGER,
                            start_dest INTEGER,
                            start INTEGER,
                            end INTEGER,
                            points TEXT,
                            CONSTRAINT turnoutLinks_start_dest_FK FOREIGN KEY (start_dest) REFERENCES destinations(iddestinations) ON DELETE RESTRICT ON UPDATE RESTRICT
                            CONSTRAINT turnoutLinks_start_FK FOREIGN KEY (start) REFERENCES turnouts(idturnouts) ON DELETE RESTRICT ON UPDATE RESTRICT
                            CONSTRAINT turnoutLinks_end_FK FOREIGN KEY (end) REFERENCES turnouts(idturnouts) ON DELETE RESTRICT ON UPDATE RESTRICT

                        );
                    `
                        )
                        .then(() => {
                            return;
                        });
                } else {
                    return;
                }
            })
            .then(() => {
                if (!tableNames.includes('scripts')) {
                    dbConnection
                        .exec(
                            `
                        CREATE TABLE scripts (
                            idscripts INTEGER PRIMARY KEY AUTOINCREMENT,
                            scriptNum INTEGER,
                            scriptName TEXT,
                            script TEXT
                        );
                    `
                        )
                        .then(() => {
                            return;
                        });
                } else {
                    return;
                }
            })
            .then(resolve);
    });
}
