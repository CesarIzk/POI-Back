const mysql = require("mysql2/promise");

// 🔧 En Railway: configura estas variables en el panel → Variables
const pool = mysql.createPool({
    host:     process.env.DB_HOST     || "localhost",
    user:     process.env.DB_USER     || "root",
    password: process.env.DB_PASSWORD || "1234",
    database: process.env.DB_NAME     || "socialmedia",
    waitForConnections: true,
    connectionLimit: 10,
});

module.exports = pool;