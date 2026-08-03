require("dotenv").config();

console.log("USER:", JSON.stringify(process.env.EMAIL_USER));
console.log("PASS:", JSON.stringify(process.env.EMAIL_PASS), "LENGTH:", process.env.EMAIL_PASS.length);

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.sendMail(
  {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: "Test",
    text: "Hello from BlessMed test",
  },
  (err, info) => {
    if (err) return console.log("FAILED:", err);
    console.log("SUCCESS:", info.response);
  }
);