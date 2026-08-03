const { Pool } = require("pg");

// Supabase's Postgres requires SSL, and its cert chain generally isn't in
// Node's default trust store, so we disable strict verification here rather
// than shipping a CA bundle. This is the standard approach for Supabase.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  // Fired for idle clients that error out in the background (e.g. dropped
  // connections) — log it but don't crash the whole process over it.
  console.error("[db] Unexpected error on idle Postgres client:", err.message);
});

const connectDB = async () => {
  try {
    const { rows } = await pool.query("select now() as now");
    console.log(`[db] Supabase Postgres connected: ${rows[0].now}`);
  } catch (err) {
    console.error(`[db] Connection error: ${err.message}`);
    process.exit(1);
  }
};

// server.js only ever imported the connect function directly
// (`const connectDB = require("./config/db")`), so we keep that working by
// exporting the function itself and hanging `pool` off it as a property —
// models/User.js can then do `const { pool } = require("../config/db")`.
module.exports = connectDB;
module.exports.pool = pool;
