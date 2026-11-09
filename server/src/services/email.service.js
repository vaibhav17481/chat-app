import nodemailer from "nodemailer";

const getTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "Email delivery is not configured (EMAIL_USER / EMAIL_APP_PASSWORD missing)"
    );
  }

  // A custom host is used for local development and for automated tests,
  // Gmail stays the default for production.
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
};

/** Escapes user supplied values before they are embedded in the email HTML. */
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]
  );

export const sendVerificationEmail = async (email, username, code) => {
  const transporter = getTransporter();
  const safeUsername = escapeHtml(username);

  await transporter.sendMail({
    from: `"Chat App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your Chat App account",
    text: `Hi ${username}, your Chat App verification code is ${code}. It expires in 10 minutes. If you did not create this account, ignore this email.`,
    html: `
      <div>
        <h2>Welcome to Chat App, ${safeUsername}!</h2>

        <p>Your verification code is:</p>

        <h1>${code}</h1>

        <p>This code will expire in 10 minutes.</p>

        <p>If you didn't create this account, you can ignore this email.</p>
      </div>
    `,
  });
};
