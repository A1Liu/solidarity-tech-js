import { createClient } from "../index";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("Missing API_KEY environment variable");
  process.exit(1);
}

const client = createClient({ apiKey });

// const res = await client.createEvent({
//   event_type: "hybrid",
//   scope_id: 3355,
//   scope_type: "Chapter",
//
//   title: "test event",
//
//   start_time: Date.now(),
//   end_time: Date.now() + 1000,
// });

const res = await client.getEvent(35754);

// 866534
// const res = await client.listEventRsvps({
//   event_id: 20524,
//   session_id: 56886,
// });

/*
const res = await client.updateEventRsvp(866534, {
  is_attending: "yes",
  is_confirmed: true,
  agent_user_id: 10713639,
  source: "hello",
  source_system: "blah",
});
*/

if (!res.ok) {
  console.error("Request failed:", res.error);
  process.exit(1);
}

console.log(JSON.stringify(res.data, null, 2));
