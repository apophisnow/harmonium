import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getConfig } from '../../config.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const config = getConfig();
  if (!config.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth:
      config.SMTP_USER && config.SMTP_PASS
        ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
        : undefined,
  });

  return transporter;
}

export function isSmtpConfigured(): boolean {
  return !!getConfig().SMTP_HOST;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const config = getConfig();
  const verifyUrl = `${config.CLIENT_URL}/verify-email?token=${token}`;

  const transport = getTransporter();

  if (!transport) {
    console.log('──────────────────────────────────────────');
    console.log('📧 Email verification (no SMTP configured)');
    console.log(`   To: ${to}`);
    console.log(`   URL: ${verifyUrl}`);
    console.log('──────────────────────────────────────────');
    return;
  }

  await transport.sendMail({
    from: config.SMTP_FROM,
    to,
    subject: 'Verify your Harmonium account',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #333; font-size: 24px; margin-bottom: 16px;">Welcome to Harmonium</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          Click the button below to verify your email address and activate your account.
        </p>
        <a href="${verifyUrl}" style="display: inline-block; background-color: #5865f2; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;">
          Verify Email
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 32px; line-height: 1.4;">
          If you didn't create an account on Harmonium, you can ignore this email.
          This link expires in 24 hours.
        </p>
      </div>
    `,
    text: `Welcome to Harmonium!\n\nClick the link below to verify your email address:\n${verifyUrl}\n\nThis link expires in 24 hours.\nIf you didn't create this account, you can ignore this email.`,
  });
}
