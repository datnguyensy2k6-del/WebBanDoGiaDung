const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const sql = require('mssql/msnodesqlv8');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'WebBanDoGiaDung',
  driver: process.env.DB_DRIVER || 'ODBC Driver 18 for SQL Server',
  options: {
    trustedConnection: process.env.DB_TRUSTED_CONNECTION === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

function createPool() {
  return new sql.ConnectionPool(config);
}

module.exports = { sql, config, createPool };
