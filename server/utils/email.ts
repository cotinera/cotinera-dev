import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("Warning: SENDGRID_API_KEY environment variable is not set. Email notifications will not be sent.");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("Cannot send email: SENDGRID_API_KEY is not set");
    return false;
  }
  
  try {
    await mailService.send({
      to: params.to,
      from: params.from, // This should be a verified sender in SendGrid
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

// Email template for trip invitations
export async function sendTripInvitationEmail({
  to,
  inviterName,
  tripTitle,
  inviteLink,
}: {
  to: string;
  inviterName: string;
  tripTitle: string;
  inviteLink: string;
}): Promise<boolean> {
  const subject = `${inviterName} invited you to join a trip: ${tripTitle}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Trip Invitation</h2>
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> has invited you to join a trip: <strong>${tripTitle}</strong></p>
      <p>Click the button below to view the invitation and respond:</p>
      <div style="margin: 30px 0;">
        <a href="${inviteLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View Invitation
        </a>
      </div>
      <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
      <p style="color: #6B7280; word-break: break-all;">${inviteLink}</p>
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
        <p style="color: #6B7280; font-size: 14px;">
          This email was sent from TravelPlanner. If you didn't expect this invitation, you can ignore this email.
        </p>
      </div>
    </div>
  `;
  
  const text = `
    Trip Invitation
    
    Hello,
    
    ${inviterName} has invited you to join a trip: ${tripTitle}
    
    Click the link below to view the invitation and respond:
    ${inviteLink}
    
    If you didn't expect this invitation, you can ignore this email.
  `;
  
  return sendEmail({
    to,
    from: 'travelplanner@example.com', // Replace with your verified sender
    subject,
    html,
    text,
  });
}

// Email template for trip invitation reminders
export async function sendTripInvitationReminderEmail({
  to,
  inviterName,
  tripTitle,
  inviteLink,
}: {
  to: string;
  inviterName: string;
  tripTitle: string;
  inviteLink: string;
}): Promise<boolean> {
  const subject = `Reminder: ${inviterName}'s trip invitation is waiting for your response`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Trip Invitation Reminder</h2>
      <p>Hello,</p>
      <p>This is a friendly reminder that <strong>${inviterName}</strong> has invited you to join a trip: <strong>${tripTitle}</strong></p>
      <p>The invitation is still waiting for your response.</p>
      <div style="margin: 30px 0;">
        <a href="${inviteLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Respond to Invitation
        </a>
      </div>
      <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
      <p style="color: #6B7280; word-break: break-all;">${inviteLink}</p>
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
        <p style="color: #6B7280; font-size: 14px;">
          This email was sent from TravelPlanner. If you didn't expect this invitation, you can ignore this email.
        </p>
      </div>
    </div>
  `;
  
  const text = `
    Trip Invitation Reminder
    
    Hello,
    
    This is a friendly reminder that ${inviterName} has invited you to join a trip: ${tripTitle}
    The invitation is still waiting for your response.
    
    Click the link below to respond to the invitation:
    ${inviteLink}
    
    If you didn't expect this invitation, you can ignore this email.
  `;
  
  return sendEmail({
    to,
    from: 'travelplanner@example.com', // Replace with your verified sender
    subject,
    html,
    text,
  });
}