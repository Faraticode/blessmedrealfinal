const nodemailer = require("nodemailer");

// Reuses a single transporter across requests instead of creating one per email.
// Uses Gmail via nodemailer's built-in "gmail" service shortcut — requires a
// Google Account App Password (not the regular account password) in EMAIL_PASS.
// See: https://myaccount.google.com/apppasswords
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error(
      "Email is not configured. Set EMAIL_USER and EMAIL_PASS (a Gmail App Password) in backend/.env"
    );
  }

  transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // STARTTLS, not SSL
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

  return transporter;
}

// Sends a 6-digit verification code to the user's email during registration.
const sendOtpEmail = async ({ to, otp, firstName }) => {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: `"BlessMed" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your BlessMed verification code",
    text: `Hi ${firstName || "there"},\n\nYour BlessMed verification code is: ${otp}\n\nThis code expires in 10 minutes. If you didn't request this, you can ignore this email.\n\n— BlessMed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1b7a5b;">Bless<span style="color:#111;">Med</span></h2>
        <p>Hi ${firstName || "there"},</p>
        <p>Use the code below to verify your email and finish creating your account:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; text-align: center; margin: 24px 0; color:#1b7a5b;">${otp}</p>
        <p style="color:#666;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};

module.exports = { sendOtpEmail };
