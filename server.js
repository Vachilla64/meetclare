const express = require("express");
const app = express();
const path = require("path");

// Serve all your static files (index.html, images)
app.use(express.static(__dirname));

// Ensure the root path explicitly serves your index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// QuikDB will inject the PORT variable automatically
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Clare frontend live on port ${PORT}`);
});
