const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");

// ---- camelCase (app) <-> snake_case (Postgres column) mapping ----
const COLUMNS = {
  firstName: "first_name",
  lastName: "last_name",
  otherNames: "other_names",
  email: "email",
  password: "password",
  walletAddress: "wallet_address",
  isVerified: "is_verified",
  otpCode: "otp_code",
  otpExpiresAt: "otp_expires_at",
  age: "age",
  bloodGroup: "blood_group",
  genotype: "genotype",
  allergies: "allergies",
  medicalConditions: "medical_conditions",
  emergencyContact: "emergency_contact",
  profilePicture: "profile_picture",
  points: "points",
  stepStreak: "step_streak",
  dailyStepGoal: "daily_step_goal",
  lastGoalMetDate: "last_goal_met_date",
  totalStepsLifetime: "total_steps_lifetime",
  stepMilestonesReached: "step_milestones_reached",
  checkinStreak: "checkin_streak",
  lastCheckinDate: "last_checkin_date",
  qrCodeId: "qr_code_id",
};

// Fields that used to have Mongoose's `select: false` — never returned
// unless explicitly asked for, and (belt-and-suspenders alongside the
// auth-middleware sanitize) never enumerable, so a stray `res.json({ user })`
// anywhere can't leak them.
const HIDDEN_FIELDS = new Set(["password", "otpCode", "otpExpiresAt"]);

const JSON_COLUMNS = new Set(["emergencyContact"]);
const ARRAY_COLUMNS = new Set(["allergies", "medicalConditions", "stepMilestonesReached"]);

// Wraps a raw pg row into an object shaped like the old Mongoose document:
// camelCase fields, an `_id` alias for `id`, a computed `name`, sensitive
// fields present-but-non-enumerable, and instance methods `save`/`matchPassword`.
function wrapRow(row) {
  if (!row) return null;

  const doc = {};
  for (const [camel, col] of Object.entries(COLUMNS)) {
    if (!(col in row)) continue;
    const isHidden = HIDDEN_FIELDS.has(camel);
    Object.defineProperty(doc, camel, {
      value: row[col],
      writable: true,
      enumerable: !isHidden,
      configurable: true,
    });
  }

  doc.id = row.id;
  Object.defineProperty(doc, "_id", { value: row.id, enumerable: false });
  Object.defineProperty(doc, "name", {
    get() {
      return [doc.firstName, doc.otherNames, doc.lastName].filter(Boolean).join(" ");
    },
    enumerable: true,
  });

  Object.defineProperty(doc, "matchPassword", {
    value: async function (enteredPassword) {
      return bcrypt.compare(enteredPassword, row.password);
    },
    enumerable: false,
  });

  // Persists whatever camelCase fields currently sit on `doc` back to Postgres.
  // Mirrors Mongoose's `document.save()` for the fields our controllers
  // actually mutate directly (isVerified, otpCode, otpExpiresAt, password, ...).
  Object.defineProperty(doc, "save", {
    value: async function () {
      if (this.password && this.password !== row.password) {
        // Password was reassigned in place — mimic the old pre("save") hook.
        this.password = await bcrypt.hash(this.password, await bcrypt.genSalt(10));
      }
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
        `UPDATE users SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i} RETURNING *`,
        values
      );
      return wrapRow(rows[0]);
    },
    enumerable: false,
  });

  return doc;
}

function toInsertValue(camel, val) {
  if (val === undefined) return null;
  if (JSON_COLUMNS.has(camel) && val !== null) return JSON.stringify(val);
  return val;
}

// Builds `col1 = $1 AND col2 = $2 ...` (plain equality) or `col <> $n` for a
// `{ $ne: value }` filter shape — the only two shapes our controllers use.
function buildWhere(filter, startIndex = 1) {
  const clauses = [];
  const values = [];
  let i = startIndex;
  for (const [camel, rawVal] of Object.entries(filter)) {
    const col = camel === "_id" ? "id" : COLUMNS[camel] || camel;
    if (rawVal && typeof rawVal === "object" && "$ne" in rawVal) {
      clauses.push(`${col} <> $${i}`);
      values.push(rawVal.$ne);
    } else {
      clauses.push(`${col} = $${i}`);
      values.push(rawVal);
    }
    i++;
  }
  return { clause: clauses.join(" AND "), values };
}

// Mongoose-style `.select("firstName lastName")` (allowlist, public/safe
// fields only) vs `.select("+password")` (fields are already present on the
// wrapped row — see HIDDEN_FIELDS — so a `+` select is a no-op here; the
// calling code always clears the field again before responding).
function applySelect(doc, selectString) {
  if (!doc || !selectString) return doc;
  const tokens = selectString.trim().split(/\s+/);
  if (tokens.every((t) => t.startsWith("+"))) return doc;

  const allowed = new Set(tokens.filter((t) => !t.startsWith("+")));
  const projected = {};
  for (const key of allowed) {
    if (key in doc) projected[key] = doc[key];
  }
  return projected;
}

function selectable(promise) {
  // Lets callers chain `.select(...)` onto the result of findOne/findById,
  // same as Mongoose query objects.
  const wrapped = promise.then((doc) => doc);
  wrapped.select = (fields) => promise.then((doc) => applySelect(doc, fields));
  return wrapped;
}

const User = {
  async create(data) {
    const password = await bcrypt.hash(data.password, await bcrypt.genSalt(10));
    const cols = [];
    const placeholders = [];
    const values = [];
    let i = 1;
    for (const [camel, col] of Object.entries(COLUMNS)) {
      if (!(camel in data)) continue;
      cols.push(col);
      placeholders.push(`$${i}`);
      values.push(camel === "password" ? password : toInsertValue(camel, data[camel]));
      i++;
    }
    const { rows } = await pool.query(
      `INSERT INTO users (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    return wrapRow(rows[0]);
  },

  findById(id) {
    return selectable(
      pool.query("SELECT * FROM users WHERE id = $1", [id]).then((r) => wrapRow(r.rows[0]))
    );
  },

  findOne(filter = {}) {
    const { clause, values } = buildWhere(filter);
    const sql = clause ? `SELECT * FROM users WHERE ${clause} LIMIT 1` : "SELECT * FROM users LIMIT 1";
    return selectable(pool.query(sql, values).then((r) => wrapRow(r.rows[0])));
  },

  async findByIdAndUpdate(id, updates = {}) {
    const sets = [];
    const values = [];
    let i = 1;
    for (const [camel, val] of Object.entries(updates)) {
      const col = COLUMNS[camel];
      if (!col) continue;
      sets.push(`${col} = $${i}`);
      values.push(toInsertValue(camel, val));
      i++;
    }
    if (!sets.length) return this.findById(id);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i} RETURNING *`,
      values
    );
    return wrapRow(rows[0]);
  },

  async findByIdAndDelete(id) {
    const { rows } = await pool.query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);
    return wrapRow(rows[0]);
  },
};

module.exports = User;
