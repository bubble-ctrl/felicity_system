const nodemailer = require('nodemailer');

// --- Transporter Strategies ---
// 1. SENDGRID_API_KEY → use SendGrid HTTP API (works on Render — no SMTP port needed)
// 2. SMTP_HOST + SMTP_USER → use real SMTP (works locally / services that allow SMTP)
// 3. Neither → Ethereal fake SMTP (dev only, viewable at ethereal.email)

let transporter;

const getTransporter = async () => {
    if (transporter) return transporter;

    if (process.env.SENDGRID_API_KEY) {
        // SendGrid uses its own SMTP relay on port 587, but via authenticated API key
        // This actually works even on restricted hosts because SendGrid's SMTP host
        // is allowlisted by many providers. However, we use their nodemailer transport.
        transporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: {
                user: 'apikey', // SendGrid requires literal string "apikey" as user
                pass: process.env.SENDGRID_API_KEY,
            },
        });
        console.log('[Email] Using SendGrid SMTP transport');
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        // Generic SMTP (Gmail, Mailgun, etc.)
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        console.log('[Email] Using SMTP transport:', process.env.SMTP_HOST);
    } else {
        // Fallback: Ethereal test account (emails viewable at ethereal.email)
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log('[Email] Using Ethereal test account:', testAccount.user);
    }
    return transporter;
};

/**
 * Send a registration confirmation email with ticket details
 */
const sendRegistrationEmail = async ({ to, eventName, ticketId, qrCode }) => {
    try {
        const t = await getTransporter();
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || '"Felicity Events" <noreply@felicity.iiit.ac.in>';

        const info = await t.sendMail({
            from: fromEmail,
            to,
            subject: `🎫 Registration Confirmed — ${eventName}`,
            html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                    <h2 style="color:#6c5ce7;">Registration Confirmed! 🎉</h2>
                    <p>You have successfully registered for <strong>${eventName}</strong>.</p>
                    <p><strong>Ticket ID:</strong> ${ticketId}</p>
                    <p>Show this QR code at the venue:</p>
                    <img src="${qrCode}" alt="QR Code" style="width:200px;height:200px;" />
                    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
                    <p style="color:#888;font-size:12px;">Felicity Event Management System</p>
                </div>
            `,
        });
        // Log Ethereal preview URL if available
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) console.log('[Email] Preview:', previewUrl);
        return info;
    } catch (err) {
        console.error('[Email] Failed to send:', err.message);
        // Don't throw — email failure shouldn't block registration
    }
};

module.exports = { sendRegistrationEmail };
