const { pool } = require("../config/db");

// ---- camelCase (app) <-> snake_case (Postgres column) mapping ----
const COLUMNS = {
  user: "user_id",
  date: "date",
  mood: "mood",
  note: "note",
  pointsAwarded: "points_awarded",
  streakAtCheckin: "streak_at_checkin",
  walletAddress: "wallet_address",
  signature: "signature",
};

// Wraps a raw pg row into an object shaped like the old Mongoose document:
// camelCase fields, an `_id`/`id` alias, and createdAt/updatedAt.
function wrapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    user: row.user_id,
    date: row.date,
    mood: row.mood,
    note: row.note,
    pointsAwarded: row.points_awarded,
    streakAtCheckin: row.streak_at_checkin,
    walletAddress: row.wallet_address,
    signature: row.signature,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Builds `col1 = $1 AND col2 = $2 ...` from a plain-equality filter object
// (the only shape checkinController.js uses: { user, date }).
function buildWhere(filter, startIndex = 1) {
  const clauses = [];
  const values = [];
  let i = startIndex;
  for (const [camel, rawVal] of Object.entries(filter)) {
    const col = COLUMNS[camel] || camel;
    clauses.push(`${col} = $${i}`);
    values.push(rawVal);
    i++;
  }
  return { clause: clauses.join(" AND "), values };
}

// Minimal Mongoose-style chainable query object so `.sort().limit()` on
// DailyCheckin.find(...) keeps working unchanged in the controller. Awaiting
// it (it's thenable) runs the query and resolves to a plain array.
function findQuery(filter) {
  let sortDir = null;
  let limitN = null;

  const builder = {
    sort(spec) {
      const [[, dir]] = Object.entries(spec || {});
      sortDir = dir === -1 || dir === "-1" ? "desc" : "asc";
      return builder;
    },
    limit(n) {
      limitN = n;
      return builder;
    },
    async _exec() {
      const { clause, values } = buildWhere(filter);
      let sql = clause ? `SELECT * FROM daily_checkins WHERE ${clause}` : "SELECT * FROM daily_checkins";
      sql += ` ORDER BY date ${sortDir === "asc" ? "ASC" : "DESC"}`;
      if (limitN) {
        values.push(limitN);
        sql += ` LIMIT $${values.length}`;
      }
      const { rows } = await pool.query(sql, values);
      return rows.map(wrapRow);
    },
    then(resolve, reject) {
      return builder._exec().then(resolve, reject);
    },
    catch(reject) {
      return builder._exec().catch(reject);
    },
  };

  return builder;
}

const DailyCheckin = {
  findOne(filter = {}) {
    const { clause, values } = buildWhere(filter);
    const sql = clause
      ? `SELECT * FROM daily_checkins WHERE ${clause} LIMIT 1`
      : "SELECT * FROM daily_checkins LIMIT 1";
    return pool.query(sql, values).then((r) => wrapRow(r.rows[0]));
  },

  find(filter = {}) {
    return findQuery(filter);
  },

  async create(data) {
    const cols = [];
    const placeholders = [];
    const values = [];
    let i = 1;
    for (const [camel, col] of Object.entries(COLUMNS)) {
      if (!(camel in data)) continue;
      cols.push(col);
      placeholders.push(`$${i}`);
      values.push(data[camel] === undefined ? null : data[camel]);
      i++;
    }
    const { rows } = await pool.query(
      `INSERT INTO daily_checkins (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    return wrapRow(rows[0]);
  },
};

module.exports = DailyCheckin;
