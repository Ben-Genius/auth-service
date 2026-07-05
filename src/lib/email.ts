import nodemailer from "nodemailer";

type EmailOptions = {
  to: string;
  subject: string;
  html: string;
};

const resendApiKey = process.env.RESEND_API_KEY;
const sendgridApiKey = process.env.SENDGRID_API_KEY;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromEmail = process.env.EMAIL_FROM || "noreply@auth-service.dev";

async function sendViaResend(options: EmailOptions): Promise<boolean> {
  if (!resendApiKey) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("[Email] Resend failed:", err);
    return false;
  }
}

async function sendViaSendGrid(options: EmailOptions): Promise<boolean> {
  if (!sendgridApiKey) return false;
  try {
    const sgMail = await import("@sendgrid/mail");
    sgMail.default.setApiKey(sendgridApiKey);
    await sgMail.default.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return true;
  } catch (err) {
    console.warn("[Email] SendGrid failed:", err);
    return false;
  }
}

async function sendViaSmtp(options: EmailOptions): Promise<boolean> {
  if (!smtpHost || !smtpUser || !smtpPass) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: (Number(smtpPort) || 587) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return true;
  } catch (err) {
    console.warn("[Email] SMTP failed:", err);
    return false;
  }
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (await sendViaResend(options)) return;
  if (await sendViaSendGrid(options)) return;
  if (await sendViaSmtp(options)) return;
  console.log(`\n📧 [Email preview]\n   To: ${options.to}\n   Subject: ${options.subject}\n   ${options.html.replace(/<[^>]*>/g, "").trim().slice(0, 200)}...\n`);
}
