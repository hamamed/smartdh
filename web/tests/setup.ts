// Every test file gets its own empty data folder and a fixed session secret.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "kanzup-test-"));
process.env.UPLOAD_DIR = path.join(process.env.DATA_DIR, "uploads");
process.env.SESSION_SECRET = "test-secret";
