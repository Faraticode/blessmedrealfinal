const { pool } = require("../config/db");

// ---- camelCase (app) <-> snake_case (Postgres column) mapping ----
const COLUMNS = {
  user: "user_id",
  date: "date",
  questions: "questions",
  answers: "answers",
  score: "score",
  pointsAwarded: "points_awarded",
  completed: "completed",
};

// `questions` is stored as jsonb; everything else maps straight across
// (`answers` is a native Postgres integer[]).
const JSON_COLUMNS = new Set(["questions"]);

// Wraps a raw pg row into an object shaped like the old Mongoose document:
// camelCase fields, an `_id`/`id` alias, createdAt/updatedAt, and a
// `save()` that persists whatever the controller has mutated in place
// (quizController sets .answers/.score/.pointsAwarded/.completed directly,
// then calls quiz.save() — same shape as User.js's doc.save()).
function wrapRow(row) {
  if (!row) return null;

  const doc = {};
  for (const [camel, col] of Object.entries(COLUMNS)) {
    if (!(col in row)) continue;
    doc[camel] = row[col];
  }

  doc.id = row.id;
  Object.defineProperty(doc, "_id", { value: row.id, enumerable: false });
  Object.defineProperty(doc, "createdAt", { value: row.created_at, enumerable: true });
  Object.defineProperty(doc, "updatedAt", { value: row.updated_at, enumerable: true });

  Object.defineProperty(doc, "save", {
    value: async function () {
      const sets = [];
      const values = [];
      let i = 1;
      for (const [camel, col] of Object.entries(COLUMNS)) {
        if (!(camel in this)) continue;
        let val = this[camel];
        if (val === undefined) val = null;
        if (JSON_COLUMNS.has(camel) && val !== null) val = JSON.stringify(val);
        sets.push(`${col} = $${i}`);
        values.push(val);
        i++;
      }
      values.push(row.id);
      const { rows } = await pool.query(
        `UPDATE daily_quizzes SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i} RETURNING *`,
        values
      );
      return wrapRow(rows[0]);
    },
    enumerable: false,
  });

  return doc;
}

// Builds `col1 = $1 AND col2 = $2 ...` from a plain-equality filter object
// (the only shape quizController.js uses: { user, date }).
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

const DailyQuiz = {
  findOne(filter = {}) {
    const { clause, values } = buildWhere(filter);
    const sql = clause
      ? `SELECT * FROM daily_quizzes WHERE ${clause} LIMIT 1`
      : "SELECT * FROM daily_quizzes LIMIT 1";
    return pool.query(sql, values).then((r) => wrapRow(r.rows[0]));
  },

  async create(data) {
    const cols = [];
    const placeholders = [];
    const values = [];
    let i = 1;
    for (const [camel, col] of Object.entries(COLUMNS)) {
      if (!(camel in data)) continue;
      let val = data[camel];
      if (val === undefined) val = null;
      if (JSON_COLUMNS.has(camel) && val !== null) val = JSON.stringify(val);
      cols.push(col);
      placeholders.push(`$${i}`);
      values.push(val);
      i++;
    }
    const { rows } = await pool.query(
      `INSERT INTO daily_quizzes (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    return wrapRow(rows[0]);
  },
};

module.exports = DailyQuiz;
