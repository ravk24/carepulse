import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Every SMS the app tried to send during a test (inspected by assertions)
export const sentSms: { to: string; from: string; body: string }[] = [];

const TWILIO_MESSAGES = "https://api.twilio.com/2010-04-01/Accounts/:sid/Messages.json";

// Default: Twilio accepts the message
export const twilioOk = http.post(TWILIO_MESSAGES, async ({ request }) => {
  const form = new URLSearchParams(await request.text());
  sentSms.push({ to: form.get("To")!, from: form.get("From")!, body: form.get("Body")! });
  return HttpResponse.json({ sid: "SM_test_123", status: "queued" }, { status: 201 });
});

// BK-12: the real-world error we hit (a personal number used as the "from" number)
export const twilioError21266 = http.post(TWILIO_MESSAGES, () =>
  HttpResponse.json(
    { code: 21266, message: "'To' and 'From' number cannot be the same", status: 400 },
    { status: 400 }
  )
);

export const server = setupServer(twilioOk);
