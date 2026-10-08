import "dotenv/config";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

async function backupDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL is missing.");
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  const fileName = `colapia_backup_${timestamp}.sql`;
  const filePath = path.join(backupDir, fileName);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  console.log(`⏳ Starting database backup to ${fileName}...`);

  try {
    // Requires pg_dump installed on the system
    await execAsync(`pg_dump "${dbUrl}" -F p -f "${filePath}"`);
    console.log(`✅ Backup completed successfully: ${filePath}`);

    // Optional: Upload to S3 or R2 here
  } catch (error) {
    console.error("❌ Backup failed:", error);
    process.exit(1);
  }
}

backupDatabase();