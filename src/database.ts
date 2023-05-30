import {createConnection} from 'mysql';

/**
 * A connection to the database to run queries
 */
export const dbConnection = createConnection({
    host: 'db',
    user: process.env.MYSQLDB_USER,
    password: process.env.MYSQLDB_PASSWORD,
    database: process.env.MYSQLDB_DATABASE
});
