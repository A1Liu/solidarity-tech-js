import { createClient } from "../index";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("Missing API_KEY environment variable");
  process.exit(1);
}

const client = createClient({ apiKey });

const res = await client.createUserAction({
  page_id: 19961,
  user_id: 10713639,
});

if (!res.ok) {
  console.error("Request failed:", res.error);
  process.exit(1);
}

console.log(JSON.stringify(res.data, null, 2));
