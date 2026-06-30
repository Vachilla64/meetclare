const express = require("express");
const app = express();
const path = require("path");

// OAuth configurations from environment variables
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

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

// --- GitHub OAuth ---
app.get("/api/auth/github", (req, res) => {
  const localPort = req.query.localPort;
  if (!localPort) {
    return res.status(400).send("Missing localPort parameter");
  }
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&state=${localPort}&scope=repo,read:org,user`;
  res.redirect(authUrl);
});

app.get("/api/auth/github/callback", async (req, res) => {
  const { code, state } = req.query;
  const localPort = state;

  if (!code || !localPort) {
    return res.status(400).send("Missing code or state parameter");
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("GitHub OAuth Error:", data);
      return res.status(500).send(`GitHub OAuth failed: ${data.error_description || data.error}`);
    }

    const accessToken = data.access_token;
    res.redirect(`http://localhost:${localPort}/auth/github/callback?token=${accessToken}`);
  } catch (error) {
    console.error("Error during GitHub callback:", error);
    res.status(500).send("Internal server error during GitHub callback");
  }
});

// --- Google Unified OAuth (Calendar, Gmail, Drive, Sheets) ---
app.get("/api/auth/google", (req, res) => {
  const localPort = req.query.localPort;
  const service = req.query.service || "gcal";
  if (!localPort) {
    return res.status(400).send("Missing localPort parameter");
  }

  const WORKSPACE_MCP_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.readonly"
  ].join(" ");

  const redirectUri = "https://meetclare.vercel.app/api/auth/google/callback";
  
  // prompt=consent ensures a refresh token is generated with all these scopes
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(WORKSPACE_MCP_SCOPES)}&access_type=offline&prompt=consent&state=${localPort}_${service}`;
  
  res.redirect(authUrl);
});

app.get("/api/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const [localPort, service] = (state || "").split("_");

  if (!code || !localPort) {
    return res.status(400).send("Missing code or state parameter");
  }

  try {
    const redirectUri = "https://meetclare.vercel.app/api/auth/google/callback";
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Google OAuth Error:", data);
      return res.status(500).send(`Google OAuth failed: ${data.error_description || data.error}`);
    }

    const refreshToken = data.refresh_token || "";
    const accessToken = data.access_token || "";
    const expiresIn = data.expires_in || 3599;

    res.redirect(`http://localhost:${localPort}/auth/google/callback?refresh_token=${refreshToken}&access_token=${accessToken}&expires_in=${expiresIn}&service=${service || 'gcal'}`);
  } catch (error) {
    console.error("Error during Google callback:", error);
    res.status(500).send("Internal server error during Google callback");
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
