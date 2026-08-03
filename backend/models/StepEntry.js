const { pool } = require("../config/db");

// ---- camelCase (app) <-> snake_case (Postgres column) mapping ----
const COLUMNS = {
  user: "user_id",
  date: "date",
  steps: "steps",
  source: "source",
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
    steps: row.steps,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Builds `col1 = $1 AND col2 = $2 ...` from a plain-equality filter object
// (the only shape stepController.js uses: { user, date }).
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
// StepEntry.find(...) keeps working unchanged in the controller. Awaiting
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
      let sql = clause ? `SELECT * FROM step_entries WHERE ${clause}` : "SELECT * FROM step_entries";
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

const StepEntry = {
  findOne(filter = {}) {
    const { clause, values } = buildWhere(filter);
    const sql = clause
      ? `SELECT * FROM step_entries WHERE ${clause} LIMIT 1`
      : "SELECT * FROM step_entries LIMIT 1";
    return pool.query(sql, values).then((r) => wrapRow(r.rows[0]));
  },

  find(filter = {}) {
    return findQuery(filter);
  },

  // Only ever called with { new: true, upsert: true } in this codebase, so
  // that's the only behavior implemented: insert-or-update on the
  // (user_id, date) unique constraint, returning the resulting row.
  async findOneAndUpdate(filter, updates = {}) {
    const userId = filter.user;
    const date = filter.date;
    const steps = updates.steps ?? 0;
    const source = updates.source || "sensor";
    const { rows } = await pool.query(
      `INSERT INTO step_entries (user_id, date, steps, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, date)
       DO UPDATE SET steps = $3, source = $4, updated_at = now()
       RETURNING *`,
      [userId, date, steps, source]
    );
    return wrapRow(rows[0]);
  },
};

module.exports = StepEntry;
