import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Reads SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM
 * from the environment. If SMTP_HOST is unset, sending is skipped
 * entirely and the email content is logged instead — this is a
 * deliberate choice, not an oversight: it means a fresh deployment
 * that hasn't configured SMTP yet still works for every OTHER
 * feature (forgot-password requests won't 500), and a developer can
 * see exactly what would have been sent in the server log during
 * local development. Nothing in this service throws for a
 * legitimate "SMTP isn't configured" case — only for genuine SMTP
 * transport failures once it IS configured.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.fromAddress = this.config.get<string>('SMTP_FROM') ?? 'no-reply@example.com';

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') ?? '587'),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? {
              user: this.config.get<string>('SMTP_USER'),
              pass: this.config.get<string>('SMTP_PASSWORD'),
            }
          : undefined,
      });
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your password';
    const text = `We received a request to reset your password.\n\nClick the link below to choose a new one. This link expires in 1 hour and can only be used once.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email — your password will not be changed.`;
    const html = `<p>We received a request to reset your password.</p><p>Click the link below to choose a new one. This link expires in 1 hour and can only be used once.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>`;

    if (!this.transporter) {
      this.logger.warn(
        `SMTP is not configured (SMTP_HOST unset) — password reset email NOT sent. Would have sent to ${to}: ${resetUrl}`,
      );
      return;
    }

    await this.transporter.sendMail({ from: this.fromAddress, to, subject, text, html });
  }
}
