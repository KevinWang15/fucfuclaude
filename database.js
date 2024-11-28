import { open } from "sqlite";
import sqlite3 from "sqlite3";

export const dbPromise = open({
  filename: "./database.sqlite",
  driver: sqlite3.Database,
});

export const initializeDatabase = async () => {
  const db = await dbPromise;
  await db.exec(`
        CREATE TABLE IF NOT EXISTS conversation_mappings
        (
            conversation_id
            TEXT
            PRIMARY
            KEY,
            user_key
            TEXT
            NOT
            NULL,
            created_at
            TIMESTAMP
            DEFAULT
            CURRENT_TIMESTAMP
        )
    `);
};
