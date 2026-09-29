import os
import smtplib
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
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "medora2k26@gmail.com")
    raw_pass = os.getenv("GMAIL_APP_PASSWORD", "qpgy dkwk nfvx ytfi")
    clean_pass = raw_pass.replace(" ", "").strip()
    return server, port, user, clean_pass

def send_email_otp(recipient_email: str, otp_code: str, reason: str = "Registration Verification") -> bool:
    """
    Sends a 6-digit OTP code to the recipient via Gmail SMTP.
    """
    server_host, port, smtp_user, clean_password = get_smtp_config()
    
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

    logger.info(f"Attempting live Gmail SMTP dispatch: User={smtp_user}, Recipient={recipient_email}")

    if not clean_password:
        logger.warning(f"[SMTP WARNING] GMAIL_APP_PASSWORD is empty. Email simulated for {recipient_email}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"MEDORA Security <{smtp_user}>"
        msg["To"] = recipient_email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(server_host, port) as server:
            server.starttls()
            server.login(smtp_user, clean_password)
            server.sendmail(smtp_user, recipient_email, msg.as_string())
        
        logger.info(f"SUCCESS: Delivered 6-digit OTP email to {recipient_email} via Gmail SMTP!")
        return True
    except Exception as e:
        logger.error(f"ERROR: Failed to send email via Gmail SMTP to {recipient_email}: {str(e)}")
        return False

def send_partner_request_email(partner_type: str, full_name: str, email: str, phone: str, details: dict) -> bool:
    """
    Sends a Pharmacy / Delivery Rider application notification directly to medora2k26@gmail.com.
    """
    server_host, port, smtp_user, clean_password = get_smtp_config()
    target_email = "medora2k26@gmail.com"
    subject = f"🚨 New Partner Request: {partner_type.upper()} Application from {full_name}"
    
    detail_rows = "".join([f"<tr><td style='padding: 6px 12px; font-weight: bold; color: #94a3b8;'>{k.replace('_', ' ').title()}:</td><td style='padding: 6px 12px; color: #ffffff;'>{v}</td></tr>" for k, v in details.items() if v])

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

    logger.info(f"[PARTNER REQUEST LOGGED] Role: {partner_type}, Name: {full_name}, Email: {email}, Phone: {phone}")

    if not clean_password:
        logger.warning(f"[SMTP WARNING] GMAIL_APP_PASSWORD empty. Partner email simulated for {full_name}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"MEDORA Portal <{smtp_user}>"
        msg["To"] = target_email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(server_host, port) as server:
            server.starttls()
            server.login(smtp_user, clean_password)
            server.sendmail(smtp_user, target_email, msg.as_string())
        
        logger.info(f"SUCCESS: Delivered partner application email to {target_email}!")
        return True
    except Exception as e:
        logger.error(f"ERROR: Failed to send partner request email to {target_email}: {str(e)}")
        return False

def send_partner_approval_email(recipient_email: str, full_name: str, partner_type: str, temp_password: str) -> bool:
    """
    Sends an Application Approval notification to the partner with login instructions and temporary password.
    """
    server_host, port, smtp_user, clean_password = get_smtp_config()
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

    if not clean_password:
        logger.info(f"[SIMULATION] Sent approval email to {recipient_email}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"MEDORA Executive Team <{smtp_user}>"
        msg["To"] = recipient_email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(server_host, port) as server:
            server.starttls()
            server.login(smtp_user, clean_password)
            server.sendmail(smtp_user, recipient_email, msg.as_string())
        logger.info(f"Delivered approval email to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send approval email: {str(e)}")
        return False

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
    server_host, port, smtp_user, clean_password = get_smtp_config()
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
Website: http://localhost:3000
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

    if not clean_password:
        logger.info(f"[SIMULATION] Rejection email simulated for {recipient_email} with reason: '{clean_reason}'")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"MEDORA Partner Onboarding <{smtp_user}>"
        msg["To"] = recipient_email
        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(server_host, port, timeout=20) as server:
            server.starttls()
            server.login(smtp_user, clean_password)
            recipients = [recipient_email]
            if smtp_user and smtp_user.lower() != recipient_email.lower():
                recipients.append(smtp_user)  # Admin copy so admin can verify exact mail in their inbox
            server.sendmail(smtp_user, recipients, msg.as_string())
        logger.info(f"SUCCESS: Delivered rejection email with reason to {recipient_email} and copy to {smtp_user}")
        return True
    except Exception as e:
        logger.error(f"Failed to send rejection email: {str(e)}")
        return False

