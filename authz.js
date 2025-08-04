import { dbPromise } from "./database.js";

export const conversationOwnershipMiddleware = async (req, res, next) => {

  if (req.url.endsWith("chat_conversations/count") || req.url.endsWith("chat_conversations/count_all")) {
    return res.status(200).json(0);
  }

  // Regular expression to match conversation URLs
  const conversationRegex = /\/chat_conversations\/([a-z0-9-]+)/;
  const match = req.url.match(conversationRegex);

  if (!match) {
    return next();
  }

  const conversationId = match[1];
  const cookies = req.headers.cookie
    ? Object.fromEntries(
        req.headers.cookie.split(";").map((c) => {
          const [key, value] = c.trim().split("=");
          return [key, value];
        }),
      )
    : {};
  const userKey = cookies["user-key"];

  try {
    const db = await dbPromise;
    const row = await db.get(
      "SELECT user_key FROM conversation_mappings WHERE conversation_id = ?",
      [conversationId],
    );

    if (!row) {
      console.log(`No binding found for conversation ${conversationId}`);
      return res.status(403).send("Access denied");
    }

    if (row.user_key !== userKey) {
      console.log(`User key mismatch for conversation ${conversationId}`);
      return res.status(403).send("Access denied");
    }

    next();
  } catch (err) {
    console.error("Database error in conversation ownership check:", err);
    return res.status(500).send("Internal server error");
  }
};
