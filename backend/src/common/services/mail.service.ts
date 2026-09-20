import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { config } from '../../config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private getTransporter(): nodemailer.Transporter | null {
    const user = process.env.GMAIL_USER || process.env.SMTP_USER || config.mail.user;
    const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || config.mail.pass;
    const host = process.env.SMTP_HOST || config.mail.host || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '', 10) || config.mail.port || 587;

    if (!user || !pass) {
      return null;
    }

    const isGmail = host.includes('gmail.com');
    return nodemailer.createTransport(
      isGmail
        ? {
            service: 'gmail',
            auth: {
              user,
              pass,
            },
          }
        : {
            host,
            port,
            secure: port === 465,
            auth: {
              user,
              pass,
            },
          },
    );
  }

  async sendPasswordResetEmail(toEmail: string, resetLink: string, firstName?: string): Promise<boolean> {
    const recipientName = firstName ? firstName : 'TileVista User';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password - TileVista</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F9F9F7; margin: 0; padding: 20px; color: #1A1A1A; }
          .container { max-width: 550px; margin: 0 auto; background-color: #ffffff; padding: 32px; border: 1px solid #E5E7EB; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
          .header { text-align: center; border-bottom: 1px solid #F3F4F6; padding-bottom: 20px; margin-bottom: 24px; }
          .brand { font-size: 20px; font-weight: 700; tracking-widest: 0.1em; text-transform: uppercase; color: #1A1A1A; text-decoration: none; }
          .title { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #1A1A1A; }
          .content { font-size: 14px; line-height: 1.6; color: #4B5563; margin-bottom: 24px; }
          .btn-container { text-align: center; margin: 30px 0; }
          .btn { background-color: #1A1A1A; color: #ffffff !important; text-decoration: none; padding: 14px 28px; font-weight: 600; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; display: inline-block; transition: background-color 0.2s ease; }
          .footer { font-size: 12px; color: #9CA3AF; text-align: center; border-top: 1px solid #F3F4F6; padding-top: 20px; margin-top: 30px; }
          .link-box { word-break: break-all; font-size: 12px; background-color: #F3F4F6; padding: 12px; border: 1px solid #E5E7EB; margin-top: 15px; color: #4B5563; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="brand">TILEVISTA</span>
          </div>
          <div class="title">Reset Your Password</div>
          <div class="content">
            Hello ${recipientName},<br/><br/>
            We received a request to reset your password for your TileVista account. Click the button below to choose a new password:
          </div>
          <div class="btn-container">
            <a href="${resetLink}" class="btn" target="_blank">Reset Password</a>
          </div>
          <div class="content">
            This password reset link will expire in <strong>15 minutes</strong>.<br/>
            If you did not request a password reset, you can safely ignore this email and your password will remain unchanged.
          </div>
          <div class="footer">
            If the button above does not work, copy and paste the following link into your web browser:<br/>
            <div class="link-box">${resetLink}</div>
            <br/>
            &copy; ${new Date().getFullYear()} TileVista. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // Log generated link to server console for development tracing
    this.logger.log(`\n==================================================`);
    this.logger.log(`🔑 PASSWORD RESET LINK GENERATED FOR [${toEmail}]:`);
    this.logger.log(`👉 ${resetLink}`);
    this.logger.log(`==================================================\n`);

    const transporter = this.getTransporter();
    const senderUser = process.env.GMAIL_USER || process.env.SMTP_USER || config.mail.user;
    const fromAddress = process.env.SMTP_FROM || config.mail.from || `TileVista Support <${senderUser}>`;

    if (transporter) {
      try {
        this.logger.log(`Attempting to send email via Gmail SMTP (from: ${senderUser} to: ${toEmail})...`);
        const info = await transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          subject: 'Reset your TileVista Account Password',
          html: htmlContent,
        });
        this.logger.log(`✅ Password reset email successfully sent to ${toEmail}. Message ID: ${info.messageId}`);
        return true;
      } catch (error) {
        this.logger.error(`❌ Failed to send password reset email to ${toEmail}:`, error);
        return false;
      }
    } else {
      this.logger.warn(`⚠️ SMTP credentials not found in process.env. [Dev Mode] Email notification simulated for ${toEmail}. Link printed to console above.`);
      return true;
    }
  }
}
