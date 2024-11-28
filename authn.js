// Generate random user key and signature
import crypto from "crypto";
import {getConfig} from "./config.js";

export const generateAuthTokens = () => {
  const userKey = crypto.randomBytes(32).toString("hex");
  const signature = crypto
    .createHmac("sha256", getConfig().signingSecret) // Using separate signing secret
    .update(userKey)
    .digest("hex");
  return { userKey, signature };
};

// Verify user key and signature
const verifyAuth = (userKey, signature) => {
  const expectedSignature = crypto
    .createHmac("sha256", getConfig().signingSecret) // Using separate signing secret
    .update(userKey)
    .digest("hex");
  return signature === expectedSignature;
};

// Authentication middleware
export const authMiddleware = (req, res, next) => {
  // Skip auth check for login route
  if (req.path === "/login") {
    return next();
  }

  const cookies = req.headers.cookie
    ? Object.fromEntries(
        req.headers.cookie.split(";").map((c) => {
          const [key, value] = c.trim().split("=");
          return [key, value];
        }),
      )
    : {};

  const userKey = cookies["user-key"];
  const signature = cookies["signature"];

  if (!userKey || !signature || !verifyAuth(userKey, signature)) {
    return res.status(404).send(`  
        <html>  
            <body style="text-align: center; padding-top: 50px; font-family: Arial, sans-serif;">  
                <h2>There's Nothing Here</h2>  
                <p>If you were given a link, enter from the link</p>    
            </body>  
        </html>  
    `);
  }

  next();
};

export function getUserKey(req) {
    // Get user-key from cookies
    const cookies = req.headers.cookie
        ? Object.fromEntries(
            req.headers.cookie.split(";").map((c) => {
                const [key, value] = c.trim().split("=");
                return [key, value];
            }),
        )
        : {};
    const userKey = cookies["user-key"];
    const signature = cookies["signature"];

    if (!userKey || !signature || !verifyAuth(userKey, signature)) {
        return null;
    }

    return userKey;
}