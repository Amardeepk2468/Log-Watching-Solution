
// server.js
// Simple Node.js + WebSocket based real-time log viewer

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Logger = require("./logger");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const LOG_FILE = "log.txt";

const logger = new Logger(LOG_FILE);

// Serve a minimal HTML + JS UI
app.get("/log", (req, res) => {
  res.send(`
  <html>
  <body >
    <h2> Real-time Log Viewer</h2>
    <div id="log"></div>
    <script>
      const ws = new WebSocket('ws://' + location.host);
      const logBox = document.getElementById('log');
      function addLine(line){
        const div=document.createElement('div');
        div.textContent=line;
        logBox.appendChild(div);
        if(logBox.children.length>10) logBox.removeChild(logBox.firstChild);
        logBox.scrollTop=logBox.scrollHeight;
      }
      ws.onmessage=(e)=>{
        const msg=JSON.parse(e.data);
        if(msg.type==='init'){ logBox.innerHTML=''; msg.data.forEach(addLine); }
        else if(msg.type==='update'){ msg.data.forEach(addLine); }
      };
    </script>
  </body>
  </html>
  `);
});

// WebSocket communication
wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send(JSON.stringify({ type: "init", data: logger.getLogs() }));
});

// Broadcast events to all connected clients
logger.on("init", (lines) => {
  const msg = JSON.stringify({ type: "init", data: lines });
  wss.clients.forEach((c) => c.readyState === WebSocket.OPEN && c.send(msg));
});

logger.on("update", (newLines) => {
  const msg = JSON.stringify({ type: "update", data: newLines });
  wss.clients.forEach((c) => c.readyState === WebSocket.OPEN && c.send(msg));
});

// Start watching file
logger.start();

// // Optional: Generate demo logs automatically
// setInterval(() => {
//   fs.appendFile(LOG_FILE, `Log Entry: ${new Date().toISOString()}\n`, () => {});
// }, 1500);

server.listen(PORT, () =>
  console.log(`✅ Open http://localhost:${PORT}/log to view logs`)
);

