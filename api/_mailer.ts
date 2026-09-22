import nodemailer from 'nodemailer';

export interface SendMailResult {
  sent: boolean;
  messageId?: string;
  reason?: string;
  error?: string;
}

export async function sendOtpEmail(email: string, code: string, name: string = 'there'): Promise<SendMailResult> {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465');

  if (!user || !pass) {
    console.log(`🔐 [Nexus Notes] No SMTP credentials in environment. Simulated OTP for ${email}: ${code}`);
    return {
      sent: false,
      reason: 'No SMTP credentials configured. In dev/preview, use the Dev Mode OTP code displayed in the app.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"Nexus Notes" <${user}>`,
      to: email,
      subject: `🔐 Your Nexus Notes Verification Code: ${code}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /></head>
        <body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B0F19; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" style="max-width: 480px; background-color: #0F1626; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); padding: 36px 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <h2 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">Nexus Notes</h2>
                      <p style="color: #94A3B8; font-size: 13px; margin: 6px 0 0 0;">Local-First Collaborative Intelligence Platform</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #E2E8F0; font-size: 15px; line-height: 1.6; padding-bottom: 15px;">
                      Hi <strong>${name}</strong>,
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #94A3B8; font-size: 14px; line-height: 1.6; padding-bottom: 25px;">
                      Please use the 6-digit verification code below to activate your account:
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 25px;">
                      <div style="display: inline-block; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 14px; padding: 16px 32px;">
                        <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #FFFFFF; font-family: monospace;">${code}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #64748B; font-size: 13px; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px;">
                      This code expires in 10 minutes. If you did not create a Nexus Notes account, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log(`✉️ [Nexus Notes] Email sent to ${email}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`❌ [Nexus Notes] Failed to send email to ${email}:`, err);
    return { sent: false, error: err.message };
  }
}
