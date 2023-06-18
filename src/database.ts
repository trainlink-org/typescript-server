import sqlite3 from 'sqlite3';
import { type Database, open } from 'sqlite';
import { LogLevel, log } from './logger';
import { isDebug, version } from '.';
import semver, { Range, SemVer } from 'semver';

if (isDebug) {
    sqlite3.verbose();
}

/**
 * Sets up the connection to the database
 * @param dbPath The file path to the database
 * @returns A promise that resolves to {@link Database}
 */
export function setupDB(dbPath: string): Promise<Database> {
    log(`Using database at: ${dbPath}`);
    return new Promise<Database>((resolve) => {
        open({
            filename: dbPath,
            driver: sqlite3.Database,
        }).then((dbConnection) => {
            checkTables(dbConnection)
                .then(() => {
                    return checkVersion(dbConnection);
                })
                .then(() => resolve(dbConnection));
        });
    });
}

/**
 * Checks the required tables are present in the database, will create them if they are missing
 * @param dbConnection The database connection to use
 * @returns A promise that resolves once checking is complete
 */
function checkTables(dbConnection: Database): Promise<void> {
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
            .then(() => {
                if (!tableNames.includes('systemConfig')) {
                    dbConnection
                        .exec(
                            `
                        CREATE TABLE systemConfig (
                            idsystem INTEGER PRIMARY KEY AUTOINCREMENT,
                            key TEXT,
                            value TEXT
                        );
                        INSERT INTO systemConfig (key,value) VALUES('version', '${version.version}');
                    `
                        )
                        // .then(() => {
                        //     dbConnection.exec(
                        //     );
                        // })
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

/**
 * Checks the version of the server that made the database is compatible.
 * In future will apply necessary migrations after making a backup of the database
 * @param dbConnection The database connection to use
 * @returns A promise that resolves once checking is complete
 */
function checkVersion(dbConnection: Database): Promise<void> {
    return new Promise<void>((resolve) => {
        interface Row {
            value: string;
        }
        dbConnection
            .get<Row>("SELECT value FROM systemConfig WHERE key = 'version'")
            .then((result) => {
                const dbVersion =
                    semver.parse(result?.value) || new SemVer('0.0.0');
                if (
                    !semver.satisfies(
                        version,
                        new Range(`~${dbVersion.version}`)
                    )
                ) {
                    //TODO Apply migrations where possible
                    log(
                        `Incompatible database version (database version is ${dbVersion.version}, needs to be ${version.major}.${version.minor}.X)`,
                        LogLevel.Error,
                        true
                    );
                    throw 'Incompatible database version';
                } else {
                    resolve();
                }
            });
    });
}
