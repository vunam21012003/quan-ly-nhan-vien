// src/utils/sendMail.ts
import nodemailer from "nodemailer";

export async function sendEmail({ to, subject, text, attachments }: any) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"HR System" <${process.env.MAIL_USER}>`,
    to,
    subject,
    text,
    attachments,
  });
}
