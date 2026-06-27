const express = require("express");
const app = express();
const path = require("path");

// OAuth configurations from environment variables
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;

// Serve all your static files (index.html, images)
app.use(express.static(__dirname));

// Ensure the root path explicitly serves your index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --- Slack OAuth ---
app.get("/api/auth/slack", (req, res) => {
  const localPort = req.query.localPort;
  if (!localPort) {
    return res.status(400).send("Missing localPort parameter");
  }
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=app_mentions:read,chat:write&state=${localPort}`;
  res.redirect(authUrl);
});

app.get("/api/auth/slack/callback", async (req, res) => {
  const { code, state } = req.query;
  const localPort = state;

  if (!code || !localPort) {
    return res.status(400).send("Missing code or state parameter");
  }

  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', SLACK_CLIENT_ID);
    params.append('client_secret', SLACK_CLIENT_SECRET);

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Slack OAuth Error:", data);
      return res.status(500).send(`Slack OAuth failed: ${data.error}`);
    }

    const accessToken = data.access_token;
    
    // Redirect back to the local machine
    res.redirect(`http://localhost:${localPort}/auth/slack/callback?token=${accessToken}&appToken=${SLACK_APP_TOKEN}`);
  } catch (error) {
    console.error("Error during Slack callback:", error);
    res.status(500).send("Internal server error during Slack callback");
  }
});

// QuikDB will inject the PORT variable automatically
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Clare frontend live on port ${PORT}`);
  });
}

// Export the app for Vercel Serverless
module.exports = app;
