import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export const sendVerificationEmail = async (email, username, code) => {
  await transporter.sendMail({
    from: `"Chat App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your Chat App account",
    html: `
      <div>
        <h2>Welcome to Chat App, ${username}!</h2>

        <p>Your verification code is:</p>

        <h1>${code}</h1>

        <p>This code will expire in 10 minutes.</p>

        <p>If you didn't create this account, you can ignore this email.</p>
      </div>
    `,
  });
};
