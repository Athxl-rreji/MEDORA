import os
import json
import smtplib
import urllib.request
import urllib.error
import dotenv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.logger import logger

# Explicitly load .env file
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
dotenv.load_dotenv(dotenv_path)

def get_smtp_config():
    dotenv.load_dotenv(dotenv_path, override=True)
    server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "465"))
    user = os.getenv("SMTP_USER", "medora2k26@gmail.com")
    raw_pass = os.getenv("GMAIL_APP_PASSWORD", "qpgy dkwk nfvx ytfi")
    clean_pass = raw_pass.replace(" ", "").strip()
    return server, port, user, clean_pass

def get_relay_urls():
    """Returns candidate HTTPS relay endpoints to bypass cloud firewall port blocks (Render/VPS)."""
    urls = []
    custom = os.getenv("EMAIL_RELAY_URL")
    if custom:
        urls.append(custom.strip())
    # Production Vercel Next.js endpoint (unrestricted ports 465/587)
    urls.append("https://frontend-user-athxl-rrejis-projects.vercel.app/api/send-email")
    # Local development Next.js endpoint
    urls.append("http://localhost:3000/api/send-email")
    return urls

def dispatch_email_message(
    recipient_email: str,
    subject: str,
    html_content: str,
    plain_text: str = "",
    sender_name: str = "MEDORA Health Ecosystem",
    extra_recipients: list = None
) -> bool:
    """
    Intelligent Multi-Strategy Email Dispatcher:
    Strategy 1: Google Apps Script Webhook (Direct from medora2k26@gmail.com over HTTPS Port 443)
    Strategy 2: Resend API (HTTPS Port 443)
    Strategy 3: Brevo API (HTTPS Port 443)
    Strategy 4: Vercel Next.js Gateway (HTTPS Port 443 with bypass support)
    Strategy 5: Direct SMTP SSL on Port 465 (Localhost / Unrestricted VPS)
    Strategy 6: Direct SMTP TLS on Port 587
    """
    server_host, configured_port, smtp_user, clean_password = get_smtp_config()
    recipients = [recipient_email]
    if extra_recipients:
        for er in extra_recipients:
            if er and er not in recipients:
                recipients.append(er)

    # -------------------------------------------------------------
    # STRATEGY 1: Google Apps Script Webhook (Port 443 HTTPS)
    # Direct dispatch from medora2k26@gmail.com with zero firewall or auth blocks
    # -------------------------------------------------------------
    gas_url = os.getenv("GOOGLE_APPS_SCRIPT_URL") or os.getenv("GMAIL_WEBHOOK_URL")
    if gas_url and gas_url.startswith("https://script.google.com/"):
        try:
            payload = {
                "to": recipient_email,
                "subject": subject,
                "html": html_content,
                "text": plain_text or subject,
                "from_name": sender_name
            }
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                gas_url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201, 302):
                    logger.info(f"SUCCESS: Delivered email to {recipient_email} via Google Apps Script Webhook!")
                    return True
        except Exception as e_gas:
            logger.warning(f"Google Apps Script Webhook dispatch failed: {e_gas}")

    # -------------------------------------------------------------
    # STRATEGY 2: Resend HTTP API (Port 443 HTTPS)
    # -------------------------------------------------------------
    resend_key = os.getenv("RESEND_API_KEY")
    if resend_key and resend_key.startswith("re_"):
        try:
            payload = {
                "from": f"{sender_name} <onboarding@resend.dev>",
                "to": [recipient_email],
                "subject": subject,
                "html": html_content,
                "text": plain_text or subject
            }
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {resend_key}"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status in (200, 201):
                    logger.info(f"SUCCESS: Delivered email to {recipient_email} via Resend API!")
                    return True
        except Exception as e_resend:
            logger.warning(f"Resend API dispatch failed: {e_resend}")

    # -------------------------------------------------------------
    # STRATEGY 3: Brevo (Sendinblue) HTTP API (Port 443 HTTPS)
    # -------------------------------------------------------------
    brevo_key = os.getenv("BREVO_API_KEY")
    if brevo_key:
        try:
            payload = {
                "sender": {"name": sender_name, "email": smtp_user},
                "to": [{"email": recipient_email}],
                "subject": subject,
                "htmlContent": html_content
            }
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                "https://api.brevo.com/v3/smtp/email",
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "api-key": brevo_key
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status in (200, 201):
                    logger.info(f"SUCCESS: Delivered email to {recipient_email} via Brevo API!")
                    return True
        except Exception as e_brevo:
            logger.warning(f"Brevo API dispatch failed: {e_brevo}")

    # -------------------------------------------------------------
    # STRATEGY 4: Vercel Next.js Gateway (Port 443 HTTPS)
    # -------------------------------------------------------------
    bypass_secret = os.getenv("VERCEL_AUTOMATION_BYPASS_SECRET", "")
    for relay_url in get_relay_urls():
        try:
            payload = {
                "to": recipient_email,
                "subject": subject,
                "html": html_content,
                "text": plain_text or subject,
                "from_name": sender_name
            }
            req_data = json.dumps(payload).encode("utf-8")
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "MEDORA-Backend-Relay/2.0"
            }
            if bypass_secret:
                headers["x-vercel-protection-bypass"] = bypass_secret

            req = urllib.request.Request(
                relay_url,
                data=req_data,
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=7) as resp:
                if resp.status in (200, 201):
                    logger.info(f"SUCCESS: Delivered email to {recipient_email} via HTTPS Gateway ({relay_url})!")
                    return True
        except Exception as e:
            pass

    # -------------------------------------------------------------
    # STRATEGY 2: Direct SMTP SSL (Port 465)
    # Works locally or on VPS/hosts with open SMTP ports
    # -------------------------------------------------------------
    if clean_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{sender_name} <{smtp_user}>"
            msg["To"] = recipient_email
            if plain_text:
                msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP_SSL(server_host, 465, timeout=6) as server:
                server.login(smtp_user, clean_password)
                server.sendmail(smtp_user, recipients, msg.as_string())
            logger.info(f"SUCCESS: Delivered email to {recipient_email} via direct SMTP_SSL (Port 465)!")
            return True
        except Exception as e_ssl:
            logger.warning(f"SMTP_SSL (Port 465) connection failed: {e_ssl}. Trying STARTTLS (Port 587)...")

        # -------------------------------------------------------------
        # STRATEGY 3: Direct SMTP STARTTLS (Port 587)
        # -------------------------------------------------------------
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{sender_name} <{smtp_user}>"
            msg["To"] = recipient_email
            if plain_text:
                msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(server_host, 587, timeout=6) as server:
                server.starttls()
                server.login(smtp_user, clean_password)
                server.sendmail(smtp_user, recipients, msg.as_string())
            logger.info(f"SUCCESS: Delivered email to {recipient_email} via direct SMTP (Port 587)!")
            return True
        except Exception as e_tls:
            logger.error(f"ERROR: Direct SMTP also failed: {e_tls}")

    logger.warning(f"[EMAIL SIMULATION LOG] Subject: '{subject}' -> Recipient: {recipient_email}")
    return False

def send_email_otp(recipient_email: str, otp_code: str, reason: str = "Registration Verification") -> bool:
    """
    Sends a 6-digit OTP code to the recipient via Multi-Strategy Dispatcher.
    """
    subject = f"MEDORA Security Code: {otp_code} for {reason}"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; background-color: #121316; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #30363d;">
      <h2 style="color: #4ade80; margin-bottom: 10px;">MEDORA Health Ecosystem</h2>
      <p style="font-size: 15px; color: #e2e8f0;">Here is your 6-digit security verification code for <strong>{reason}</strong>:</p>
      <div style="background-color: #1e2025; padding: 15px 25px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4ade80; display: inline-block; margin: 15px 0;">
        {otp_code}
      </div>
      <p style="font-size: 13px; color: #94a3b8;">This code is valid for 5 minutes. If you did not request this, please ignore this message.</p>
    </div>
    """
    plain_text = f"Your MEDORA security verification code for {reason} is: {otp_code} (Valid for 5 minutes)."

    logger.info(f"Dispatching OTP email for {recipient_email} [Reason: {reason}, Code: {otp_code}]")
    return dispatch_email_message(
        recipient_email=recipient_email,
        subject=subject,
        html_content=html_content,
        plain_text=plain_text,
        sender_name="MEDORA Security"
    )

def send_partner_request_email(partner_type: str, full_name: str, email: str, phone: str, details: dict) -> bool:
    """
    Sends a Pharmacy / Delivery Rider application notification directly to medora2k26@gmail.com.
    """
    target_email = "medora2k26@gmail.com"
    subject = f"🚨 New Partner Request: {partner_type.upper()} Application from {full_name}"
    
    safe_details = {}
    for k, v in (details or {}).items():
        if not v:
            continue
        if isinstance(v, str) and (v.startswith("data:image") or len(v) > 300):
            safe_details[k] = "✓ [Digital QR Image Uploaded & Stored]"
        else:
            safe_details[k] = v

    detail_rows = "".join([f"<tr><td style='padding: 6px 12px; font-weight: bold; color: #94a3b8;'>{k.replace('_', ' ').title()}:</td><td style='padding: 6px 12px; color: #ffffff;'>{v}</td></tr>" for k, v in safe_details.items()])

    html_content = f"""
    <div style="font-family: Arial, sans-serif; background-color: #0d1117; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #30363d;">
      <h2 style="color: #38bdf8; margin-bottom: 8px;">MEDORA Partner Onboarding Request</h2>
      <p style="font-size: 14px; color: #8b949e; margin-bottom: 20px;">A new partner application has been submitted on the MEDORA Web Portal:</p>
      
      <table style="width: 100%; border-collapse: collapse; background-color: #161b22; border-radius: 8px; overflow: hidden;">
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #94a3b8;">Partner Role:</td><td style="padding: 6px 12px; color: #38bdf8; font-weight: bold;">{partner_type.upper()}</td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #94a3b8;">Applicant Name:</td><td style="padding: 6px 12px; color: #ffffff;">{full_name}</td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #94a3b8;">Email Address:</td><td style="padding: 6px 12px; color: #ffffff;">{email}</td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #94a3b8;">Phone Number:</td><td style="padding: 6px 12px; color: #ffffff;">{phone}</td></tr>
        {detail_rows}
      </table>
      <p style="font-size: 12px; color: #8b949e; margin-top: 20px;">Review and approve this application in the MEDORA Admin Portal.</p>
    </div>
    """
    plain_text = f"New {partner_type.upper()} application from {full_name} ({email}, {phone}). Please review in Admin Portal."

    logger.info(f"[PARTNER REQUEST LOGGED] Role: {partner_type}, Name: {full_name}, Email: {email}, Phone: {phone}")
    return dispatch_email_message(
        recipient_email=target_email,
        subject=subject,
        html_content=html_content,
        plain_text=plain_text,
        sender_name="MEDORA Portal"
    )

def send_partner_approval_email(recipient_email: str, full_name: str, partner_type: str, temp_password: str) -> bool:
    """
    Sends an Application Approval notification to the partner with login instructions and temporary password.
    """
    subject = f"🎉 Application Approved! Welcome to MEDORA as a {partner_type.capitalize()} Partner"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; background-color: #0d1117; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #4ade80;">
      <h2 style="color: #4ade80; margin-bottom: 8px;">Congratulations {full_name}!</h2>
      <p style="font-size: 15px; color: #e2e8f0; margin-bottom: 16px;">Your application to join MEDORA as a <strong>{partner_type.capitalize()} Partner</strong> has been reviewed and <span style="color: #4ade80; font-weight: bold;">APPROVED</span> by our Executive Team!</p>
      
      <div style="background-color: #161b22; padding: 18px; border-radius: 8px; border: 1px solid #30363d; margin: 15px 0;">
        <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 13px; font-weight: bold;">YOUR INITIAL PARTNER LOGIN CREDENTIALS:</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Email Portal Identifier:</strong> {recipient_email}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Temporary Password:</strong> <span style="font-family: monospace; color: #4ade80; font-weight: bold;">{temp_password}</span></p>
      </div>

      <p style="font-size: 13px; color: #8b949e; margin-top: 20px;">You can now sign in directly on the MEDORA Web Portal under <strong>'Pharmacy or Rider Sign In'</strong>.</p>
    </div>
    """
    plain_text = f"Congratulations {full_name}! Your application to join MEDORA as a {partner_type.capitalize()} Partner is APPROVED. Email: {recipient_email}, Temporary Password: {temp_password}"

    return dispatch_email_message(
        recipient_email=recipient_email,
        subject=subject,
        html_content=html_content,
        plain_text=plain_text,
        sender_name="MEDORA Executive Team"
    )

def send_partner_rejection_email(
    recipient_email: str,
    full_name: str,
    partner_type: str,
    reason: str,
    details: dict = None,
    request_id: str = None
) -> bool:
    """
    Sends a formal Application Rejection notification with full submission details,
    the explicit stated reason for rejection, and instructions to the applicant.
    Also sends a copy to the system administrator (medora2k26@gmail.com).
    """
    p_type_label = partner_type.capitalize()
    subject = f"❌ Application Status: Your MEDORA {p_type_label} Partner Request Was Not Approved"

    app_id_display = request_id or (details.get("id") if details else "N/A")
    store_name = details.get("store_name") if details else None
    license_no = details.get("license_no") or (details.get("driving_license") if details else None)
    vehicle_type = details.get("vehicle_type") if details else None
    store_addr = details.get("store_address") if details else None

    # Context items for the email
    info_rows = []
    if app_id_display and app_id_display != "N/A":
        info_rows.append(f"<tr><td style='padding: 6px 12px; color: #94a3b8; font-size: 13px;'>Application ID:</td><td style='padding: 6px 12px; color: #ffffff; font-family: monospace; font-size: 13px;'>{app_id_display}</td></tr>")
    if store_name:
        info_rows.append(f"<tr><td style='padding: 6px 12px; color: #94a3b8; font-size: 13px;'>Pharmacy Store Name:</td><td style='padding: 6px 12px; color: #ffffff; font-size: 13px; font-weight: bold;'>{store_name}</td></tr>")
    if license_no:
        label = "Drug License No." if partner_type.lower() == "pharmacy" else "Driving License No."
        info_rows.append(f"<tr><td style='padding: 6px 12px; color: #94a3b8; font-size: 13px;'>{label}:</td><td style='padding: 6px 12px; color: #38bdf8; font-family: monospace; font-size: 13px; font-weight: bold;'>{license_no}</td></tr>")
    if vehicle_type:
        info_rows.append(f"<tr><td style='padding: 6px 12px; color: #94a3b8; font-size: 13px;'>Registered Vehicle:</td><td style='padding: 6px 12px; color: #fbbf24; font-size: 13px;'>{vehicle_type}</td></tr>")
    if store_addr:
        info_rows.append(f"<tr><td style='padding: 6px 12px; color: #94a3b8; font-size: 13px;'>Location Address:</td><td style='padding: 6px 12px; color: #ffffff; font-size: 13px;'>{store_addr}</td></tr>")

    info_table = "".join(info_rows)
    clean_reason = reason.strip() if reason and reason.strip() else "Documentation or license credentials could not be verified with official records."

    plain_text = f"""
MEDORA Partner Application Status Update

Dear {full_name},

Thank you for your interest in joining the MEDORA Health Ecosystem as a registered {p_type_label} partner.

After thorough verification of your application details and KYC documentation, we regret to inform you that your application has NOT BEEN APPROVED at this time.

--------------------------------------------------
OFFICIAL REASON FOR DECISION:
{clean_reason}
--------------------------------------------------

APPLICATION DETAILS:
- Partner Role: {p_type_label}
- Application ID: {app_id_display}
- Applicant: {full_name} ({recipient_email})

NEXT STEPS:
If you believe this decision was made in error, or if you have updated licensing documentation or certificates to provide, please reply directly to this email or contact MEDORA Partner Support at medora2k26@gmail.com with your application ID.

Sincerely,
MEDORA Partner Compliance & Onboarding Team
    """.strip()

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 24px; background-color: #0b0c0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #12141a; border-radius: 14px; border: 1px solid rgba(239, 68, 68, 0.35); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #1f1114 0%, #16181d 100%); padding: 24px 28px; border-bottom: 1px solid rgba(239, 68, 68, 0.25);">
          <div style="margin-bottom: 8px;">
            <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">MEDORA <span style="font-size: 13px; font-weight: normal; color: #94a3b8;">Health Ecosystem</span></span>
          </div>
          <div style="display: inline-block; background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px;">
            APPLICATION NOT APPROVED
          </div>
          <h1 style="margin: 0; font-size: 20px; color: #f87171; font-weight: 700;">Partner Onboarding Decision Notice</h1>
        </div>

        <!-- Body -->
        <div style="padding: 28px;">
          <p style="font-size: 15px; line-height: 1.6; color: #f1f5f9; margin-top: 0;">
            Dear <strong>{full_name}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
            Thank you for applying to join MEDORA as a registered <strong>{p_type_label} Partner</strong>. Our compliance and onboarding committee has reviewed your application.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
            We regret to inform you that your application has <strong style="color: #ef4444;">not been approved</strong> at this time.
          </p>

          <!-- Reason Callout Card -->
          <div style="margin: 22px 0; background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(185, 28, 28, 0.08) 100%); border-left: 4px solid #ef4444; border-radius: 8px; padding: 18px 20px; border-top: 1px solid rgba(239, 68, 68, 0.2); border-right: 1px solid rgba(239, 68, 68, 0.2); border-bottom: 1px solid rgba(239, 68, 68, 0.2);">
            <div style="font-size: 12px; font-weight: 800; color: #fca5a5; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
              ⚠️ OFFICIAL REASON FOR REJECTION:
            </div>
            <div style="font-size: 15px; font-weight: 600; color: #ffffff; line-height: 1.5;">
              "{clean_reason}"
            </div>
          </div>

          <!-- Application Summary Table -->
          {f'''
          <div style="margin: 20px 0; background-color: #0b0d11; border-radius: 8px; border: 1px solid #1e2430; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Submission Record:</div>
            <table style="width: 100%; border-collapse: collapse;">
              {info_table}
            </table>
          </div>
          ''' if info_table else ''}

          <!-- Guidance / Next Steps -->
          <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #1e293b;">
            <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Next Steps & Re-application:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 13px; line-height: 1.7;">
              <li>If this decision was caused by missing or unverified license documentation, you may reply directly to this email with updated documents.</li>
              <li>You may also submit a new application once the required compliance criteria have been addressed.</li>
              <li>For appeals or clarifications, contact our compliance desk at <a href="mailto:medora2k26@gmail.com" style="color: #38bdf8; text-decoration: none;">medora2k26@gmail.com</a>.</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #0d0f14; padding: 16px 28px; border-top: 1px solid #1e2430; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #64748b;">
            This is an automated operational notification dispatched by MEDORA Partner Compliance.<br/>
            MEDORA Inc. • All Rights Reserved
          </p>
        </div>

      </div>
    </body>
    </html>
    """

    return dispatch_email_message(
        recipient_email=recipient_email,
        subject=subject,
        html_content=html_content,
        plain_text=plain_text,
        sender_name="MEDORA Partner Onboarding",
        extra_recipients=["medora2k26@gmail.com"]
    )
