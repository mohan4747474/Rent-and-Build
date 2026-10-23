import { logger } from "./logger";

type NotificationRecipient = { email?: string | null; phone?: string | null };
type DeliveryChannel = "email" | "sms";
const warnedUnconfiguredChannels = new Set<DeliveryChannel>();

function warnChannelNotConfigured(channel: DeliveryChannel, provider: string) {
  if (warnedUnconfiguredChannels.has(channel)) return;
  warnedUnconfiguredChannels.add(channel);
  logger.warn({ channel }, `${provider} notification channel is not configured`);
}

export async function deliverNotification(
  recipient: NotificationRecipient,
  subject: string,
  message: string,
) {
  const deliveries: { channel: DeliveryChannel; delivery: Promise<void> }[] = [];
  const timeoutSignal = AbortSignal.timeout(15_000);

  if (recipient.email) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFICATION_FROM_EMAIL;
    if (!apiKey || !from) {
      warnChannelNotConfigured("email", "Resend");
    } else {
      deliveries.push({
        channel: "email",
        delivery: fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: [recipient.email], subject, text: message }),
          signal: timeoutSignal,
        }).then((response) => {
          if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
        }),
      });
    }
  }

  if (recipient.phone) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !from) {
      warnChannelNotConfigured("sms", "Twilio");
    } else {
      const body = new URLSearchParams({ From: from, To: recipient.phone, Body: message });
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      deliveries.push({
        channel: "sms",
        delivery: fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: timeoutSignal,
        }).then((response) => {
          if (!response.ok) throw new Error(`Twilio returned HTTP ${response.status}`);
        }),
      });
    }
  }

  const results = await Promise.allSettled(deliveries.map(({ delivery }) => delivery));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error({ channel: deliveries[index].channel, error: result.reason }, "Notification delivery failed");
    } else {
      logger.info({ channel: deliveries[index].channel }, "Notification accepted by provider");
    }
  });
}
