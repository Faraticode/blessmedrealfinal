const { pool } = require("../config/db");

// ---- camelCase (app) <-> snake_case (Postgres column) mapping ----
const COLUMNS = {
  user: "user_id",
  medicationName: "medication_name",
  dosage: "dosage",
  times: "times",
  daysOfWeek: "days_of_week",
  notes: "notes",
  active: "active",
};

// Wraps a raw pg row into an object shaped like the old Mongoose document:
// camelCase fields, an `_id`/`id` alias, and createdAt/updatedAt.
function wrapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    user: row.user_id,
    medicationName: row.medication_name,
    dosage: row.dosage,
    times: row.times,
    daysOfWeek: row.days_of_week,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Builds `col1 = $1 AND col2 = $2 ...` from a plain-equality filter object.
// Handles the two shapes this controller uses: { user } / { user, active }
// for reads, and { _id, user } for update/delete (`_id` maps to `id`).
function buildWhere(filter, startIndex = 1) {
  const clauses = [];
  const values = [];
  let i = startIndex;
  for (const [camel, rawVal] of Object.entries(filter)) {
    const col = camel === "_id" ? "id" : COLUMNS[camel] || camel;
    clauses.push(`${col} = $${i}`);
    values.push(rawVal);
    i++;
  }
  return { clause: clauses.join(" AND "), values };
}

// Minimal Mongoose-style chainable query object so `.sort()` (and `.limit()`,
// unused here but kept for consistency with the other migrated models) on
// MedicationReminder.find(...) keeps working unchanged in the controller.
function findQuery(filter) {
  const SORT_COLUMNS = { createdAt: "created_at", date: "date" };
  let sortCol = "created_at";
  let sortDir = "desc";
  let limitN = null;

  const builder = {
    sort(spec) {
      const [[field, dir]] = Object.entries(spec || {});
      sortCol = SORT_COLUMNS[field] || field;
      sortDir = dir === -1 || dir === "-1" ? "desc" : "asc";
      return builder;
    },
    limit(n) {
      limitN = n;
      return builder;
    },
    async _exec() {
      const { clause, values } = buildWhere(filter);
      let sql = clause
        ? `SELECT * FROM medication_reminders WHERE ${clause}`
        : "SELECT * FROM medication_reminders";
      sql += ` ORDER BY ${sortCol} ${sortDir === "asc" ? "ASC" : "DESC"}`;
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

const MedicationReminder = {
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
      `INSERT INTO medication_reminders (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    return wrapRow(rows[0]);
  },

  find(filter = {}) {
    return findQuery(filter);
  },

  // Only ever called with { _id, user } as the filter and a partial-field
  // updates object (only the fields the client actually sent) — matches
  // that shape here rather than a general Mongoose update.
  async findOneAndUpdate(filter, updates = {}) {
    const sets = [];
    const values = [];
    let i = 1;
    for (const [camel, val] of Object.entries(updates)) {
      const col = COLUMNS[camel];
      if (!col) continue;
      sets.push(`${col} = $${i}`);
      values.push(val === undefined ? null : val);
      i++;
    }
    if (!sets.length) {
      // Nothing to update — just return the current row, same as the filter would match.
      const { clause, values: whereValues } = buildWhere(filter, 1);
      const { rows } = await pool.query(`SELECT * FROM medication_reminders WHERE ${clause}`, whereValues);
      return wrapRow(rows[0]);
    }

    const { clause, values: whereValues } = buildWhere(filter, i);
    values.push(...whereValues);
    const { rows } = await pool.query(
      `UPDATE medication_reminders SET ${sets.join(", ")}, updated_at = now() WHERE ${clause} RETURNING *`,
      values
    );
    return wrapRow(rows[0]);
  },

  async findOneAndDelete(filter) {
    const { clause, values } = buildWhere(filter);
    const { rows } = await pool.query(
      `DELETE FROM medication_reminders WHERE ${clause} RETURNING *`,
      values
    );
    return wrapRow(rows[0]);
  },
};

module.exports = MedicationReminder;
