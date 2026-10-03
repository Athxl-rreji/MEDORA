import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER || 'medora2k26@gmail.com';
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || 'qpgy dkwk nfvx ytfi').replace(/\s+/g, '');

// Create reusable transporter object using Gmail SMTP over SSL (Port 465)
// Port 465 is fully supported on Vercel serverless functions
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: SMTP_USER,
    pass: GMAIL_APP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, subject, html, text, from_name } = body;

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { error: 'Missing required parameters: to, subject, and html or text body.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const senderTitle = from_name || 'MEDORA Health Ecosystem';
    const mailOptions = {
      from: `"${senderTitle}" <${SMTP_USER}>`,
      to,
      subject,
      text: text || '',
      html: html || text,
    };

    // Await the transporter sendMail to ensure serverless execution completes
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MEDORA Mailer] Successfully delivered email to ${to}. MessageID: ${info.messageId}`);

    return NextResponse.json(
      {
        status: 'success',
        message: 'Email delivered successfully',
        messageId: info.messageId,
        recipient: to
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[MEDORA Mailer Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to dispatch email via SMTP transporter',
        code: error.code || 'SMTP_ERROR'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
