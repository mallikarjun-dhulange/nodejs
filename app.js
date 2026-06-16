const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENT_ID = "agent_01PwkFY6DPf4VVvf7pRt9Y3P";
const ENVIRONMENT_ID = "env_018AfU4FyP9ocynS1xYzcLRi";
const VAULT_ID = "vlt_011CbSqtyJgWy3i3iDmF7SpQ";

app.post("/slack/events", async (req, res) => {
  const { type, event, challenge } = req.body;

  if (type === "url_verification") return res.json({ challenge });

  if (type !== "event_callback" || event?.type !== "app_mention") {
    return res.sendStatus(200);
  }

  res.sendStatus(200);

  const question = event.text.replace(/<@[^>]+>/g, "").trim();
  const thread_ts = event.thread_ts || event.ts;

  try {
    const session = await client.beta.sessions.create({
      agent: AGENT_ID,
      environment_id: ENVIRONMENT_ID,
      vault_ids: [VAULT_ID],
    });

    await client.beta.sessions.events.send(session.id, {
      events: [{ type: "user.message", content: [{ type: "text", text: question }] }],
    });

    let answer = "";
    for await (const ev of client.beta.sessions.events.stream(session.id)) {
      if (ev.type === "agent.message") {
        for (const block of ev.content ?? []) {
          if (block.type === "text") answer += block.text;
        }
      }
      if (ev.type === "session.status_idle") break;
    }

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: event.channel,
        thread_ts,
        text: answer,
      }),
    });
  } catch (err) {
    console.error("Agent error:", err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));