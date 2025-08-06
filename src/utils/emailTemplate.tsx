export interface EmailTemplateProps {
  name: string;
  email: string;
  password: string;
  clinicName: string;
  loginUrl: string;
}

export function emailTemplate({ name, email, password, clinicName, loginUrl }: EmailTemplateProps): {
  html: string;
  text: string;
} {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${clinicName}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #2d3748;
                background-color: #f7fafc;
            }
            .email-container {
                max-width: 800px;
                margin: 20px auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                border: 2px solid #e2e8f0;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            }
            .header {
                background: linear-gradient(135deg, #9564e9 0%, #7c3aed 100%);
                padding: 40px 30px;
                text-align: center;
                position: relative;
            }
            .header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
                opacity: 0.3;
            }
            .logo {
                width: 60px;
                height: 60px;
                background-color: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                margin: 0 auto 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 1;
            }
            .logo::before {
                content: '🏥';
                font-size: 28px;
            }
            .header h1 {
                color: white;
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 8px;
                position: relative;
                z-index: 1;
            }
            .header p {
                color: rgba(255, 255, 255, 0.9);
                font-size: 16px;
                position: relative;
                z-index: 1;
            }
            .content {
                padding: 40px 30px;
            }
            .greeting {
                font-size: 20px;
                font-weight: 600;
                color: #2d3748;
                margin-bottom: 20px;
            }
            .message {
                font-size: 16px;
                color: #4a5568;
                margin-bottom: 30px;
                line-height: 1.7;
            }
            .credentials-card {
                background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                border: 2px solid #e2e8f0;
                border-radius: 12px;
                padding: 25px;
                margin: 30px 0;
                position: relative;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            }
            .credentials-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
                background: linear-gradient(135deg, #9564e9 0%, #7c3aed 100%);
            }
            .credentials-title {
                font-size: 18px;
                font-weight: 700;
                color: #2d3748;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                text-align: center;
                justify-content: center;
            }
            .credentials-title::before {
                content: '🔐';
                margin-right: 8px;
                font-size: 20px;
            }
            .credential-item {
                background-color: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
            }
            .credential-item:last-child {
                margin-bottom: 0;
            }
            .credential-label {
                font-weight: 600;
                color: #4a5568;
                font-size: 14px;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .credential-value {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                color: #2d3748;
                padding: 12px 16px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 600;
                border: 2px solid #e2e8f0;
                word-break: break-all;
                text-align: center;
                letter-spacing: 1px;
                position: relative;
            }
            .credential-value::before {
                content: '';
                position: absolute;
                top: -1px;
                left: -1px;
                right: -1px;
                bottom: -1px;
                background: linear-gradient(135deg, #9564e9, #7c3aed);
                border-radius: 6px;
                z-index: -1;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .credential-value:hover::before {
                opacity: 0.1;
            }
            .copy-hint {
                font-size: 12px;
                color: #718096;
                text-align: center;
                margin-top: 4px;
                font-style: italic;
            }
            .security-notice {
                background: linear-gradient(135deg, #fef5e7 0%, #fed7aa 20%, #fef5e7 100%);
                border: 2px solid #f6ad55;
                border-radius: 8px;
                padding: 20px;
                margin: 25px 0;
                display: flex;
                align-items: flex-start;
                box-shadow: 0 2px 8px rgba(246, 173, 85, 0.2);
            }
            .security-notice::before {
                content: '⚠️';
                margin-right: 12px;
                font-size: 20px;
                flex-shrink: 0;
            }
            .security-notice-text {
                color: #744210;
                font-size: 14px;
                font-weight: 500;
                line-height: 1.5;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #9564e9 0%, #7c3aed 100%);
                color: white;
                text-decoration: none;
                padding: 16px 32px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                text-align: center;
                margin: 25px 0;
                box-shadow: 0 4px 15px rgba(149, 100, 233, 0.3);
                transition: all 0.3s ease;
            }
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(149, 100, 233, 0.4);
            }
            .support-section {
                background-color: #f7fafc;
                border-radius: 8px;
                padding: 20px;
                margin: 30px 0;
                text-align: center;
            }
            .support-title {
                font-size: 16px;
                font-weight: 600;
                color: #2d3748;
                margin-bottom: 8px;
            }
            .support-text {
                font-size: 14px;
                color: #4a5568;
            }
            .footer {
                background-color: #2d3748;
                padding: 30px;
                text-align: center;
            }
            .footer-text {
                color: #a0aec0;
                font-size: 12px;
                line-height: 1.5;
            }
            .footer-divider {
                width: 50px;
                height: 2px;
                background: linear-gradient(135deg, #9564e9 0%, #7c3aed 100%);
                margin: 15px auto;
                border-radius: 1px;
            }
            @media (max-width: 850px) {
                .email-container {
                    margin: 10px;
                    border-radius: 8px;
                    max-width: calc(100% - 20px);
                }
                .header, .content, .footer {
                    padding: 30px 20px;
                }
            }
            @media (max-width: 600px) {
                .header, .content, .footer {
                    padding: 30px 20px;
                }
                .credentials-card {
                    padding: 20px;
                }
                .credential-value {
                    font-size: 14px;
                    padding: 10px 12px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="logo"></div>
                <h1>Welcome to ${clinicName}!</h1>
                <p>Your healthcare journey starts here</p>
            </div>
            <div class="content">
                <div class="greeting">Hello ${name},</div>
                <div class="message">
                    We're excited to welcome you as a new staff member at <strong>${clinicName}</strong>! 
                    Your account has been successfully created and you're all set to begin your journey with us.
                </div>
                <div class="credentials-card">
                    <div class="credentials-title">Your Login Credentials</div>
                    <div class="credential-item">
                        <div class="credential-label">Email Address</div>
                        <div class="credential-value">${email}</div>
                        <div class="copy-hint">Click to select and copy</div>
                    </div>
                    <div class="credential-item">
                        <div class="credential-label">Temporary Password</div>
                        <div class="credential-value">${password}</div>
                        <div class="copy-hint">Click to select and copy</div>
                    </div>
                </div>
                <div class="security-notice">
                    <div class="security-notice-text">
                        <strong>Important Security Notice:</strong> Please change your password immediately after your first login. 
                        This temporary password is only valid for your initial access.
                    </div>
                </div>
                <div style="text-align: center;">
                    <a href="${loginUrl}" class="cta-button">
                        🚀 Access Your Account
                    </a>
                </div>
                <div class="support-section">
                    <div class="support-title">Need Help Getting Started?</div>
                    <div class="support-text">
                        Our support team is here to help! If you have any questions or need assistance, 
                        please don't hesitate to contact your administrator.
                    </div>
                </div>
            </div>
            <div class="footer">
                <div class="footer-divider"></div>
                <div class="footer-text">
                    This is an automated message from ${clinicName}.<br>
                    Please do not reply to this email.<br><br>
                    © ${new Date().getFullYear()} ${clinicName}. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
        Welcome to ${clinicName}!

        Hello ${name},

        We're excited to welcome you as a new staff member at ${clinicName}! Your account has been successfully created and you're all set to begin your journey with us.

        Your Login Credentials:
        Email Address: ${email}
        Temporary Password: ${password}

        IMPORTANT SECURITY NOTICE: Please change your password immediately after your first login. This temporary password is only valid for your initial access.

        Login to your account: ${loginUrl}

        Need Help Getting Started?
        Our support team is here to help! If you have any questions or need assistance, please don't hesitate to contact your administrator.

        This is an automated message from ${clinicName}.
        Please do not reply to this email.

        © ${new Date().getFullYear()} ${clinicName}. All rights reserved.
  `;

  return { html, text };
}
