
// logger.js
// Simple, memory-efficient log watcher (like `tail -f`)

const fs = require("fs");
const EventEmitter = require("events");

class Logger extends EventEmitter {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.offset = 0;        // store how many bytes read so far
    this.lines = [];        // keep last 10 lines
    this.MAX_LINES = 10;
  }

  // Get last 10 lines efficiently from file end
  async getLast10Lines() {
    const stat = await fs.promises.stat(this.filePath);
    const CHUNK = 64 * 1024; // 64 KB
    const fd = await fs.promises.open(this.filePath, "r");
    let position = Math.max(0, stat.size - CHUNK);
    let data = "";
    let lines = [];

    while (position >= 0) {
      const buffer = Buffer.alloc(Math.min(CHUNK, stat.size - position));
      await fd.read(buffer, 0, buffer.length, position);
      data = buffer.toString() + data;
      lines = data.split("\n");
      if (lines.length > this.MAX_LINES + 2 || position === 0) break;
      position = Math.max(0, position - CHUNK);
    }

    await fd.close();
    lines = lines.filter((l) => l.trim() !== "");
    return lines.slice(-this.MAX_LINES);
  }

  // Start watching file for updates
  async start() {
    this.lines = await this.getLast10Lines();
    const stat = await fs.promises.stat(this.filePath);
    this.offset = stat.size;

    // emit initial data
    this.emit("init", this.lines);

    // Watch for new changes in file
    fs.watchFile(this.filePath, { interval: 1000 }, async (curr, prev) => {
      if (curr.size > prev.size) {
        const newLines = await this.readNewData(prev.size, curr.size - prev.size);
        newLines.forEach((l) => {
          this.lines.push(l);
          if (this.lines.length > this.MAX_LINES) this.lines.shift();
        });
        this.emit("update", newLines);
      }
    });
  }

  // Read only newly appended part
  async readNewData(start, length) {
    const fd = await fs.promises.open(this.filePath, "r");
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await fd.read(buffer, 0, length, start);
    await fd.close();

    const data = buffer.slice(0, bytesRead).toString();
    return data.split("\n").filter((l) => l.trim() !== "");
  }

  // Get current in-memory logs
  getLogs() {
    return this.lines;
  }
}

module.exports = Logger;

