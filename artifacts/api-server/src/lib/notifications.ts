import { logger } from "./logger";

type NotificationRecipient = { email?: string | null; phone?: string | null };

export async function deliverNotification(
  recipient: NotificationRecipient,
  subject: string,
  message: string,
) {
  const deliveries: Promise<unknown>[] = [];

  if (recipient.email && process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL) {
    deliveries.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_FROM_EMAIL,
        to: [recipient.email],
        subject,
        text: message,
      }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    }));
  }

  if (recipient.phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    const body = new URLSearchParams({ From: process.env.TWILIO_FROM_NUMBER, To: recipient.phone, Body: message });
    const credentials = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    deliveries.push(fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).then(async (response) => {
      if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
    }));
  }

  const results = await Promise.allSettled(deliveries);
  const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failed.length) {
    logger.error({ failures: failed.map((result) => String(result.reason)) }, "Notification delivery failed");
  }
}
