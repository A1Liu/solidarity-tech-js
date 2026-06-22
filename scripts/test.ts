import { createClient } from "../index";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("Missing API_KEY environment variable");
  process.exit(1);
}

const client = createClient({ apiKey });

const res = await client.createEventRsvp({
  user_id: 10713639,
  event_id: 20524,
  event_session_id: 56883,
  is_attending: "yes",
  is_confirmed: true,
  agent_user_id: 10713639,
});

if (!res.ok) {
  console.error("Request failed:", res.error);
  process.exit(1);
}

console.log(JSON.stringify(res.data, null, 2));
