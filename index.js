import express from "express";
import https from "node:https";
import chalk from "chalk";
import {getConfig} from "./config.js";
import {formatCookieHeader, formatResponseTime, getFormattedTime, getStatusColor, redactedMessage,} from "./helpers.js";
import {dbPromise, initializeDatabase} from "./database.js";
import {authMiddleware, generateAuthTokens, getUserKey} from "./authn.js";
import {conversationOwnershipMiddleware} from "./authz.js";


const app = express();
const PORT = 3000;

app.use(express.json({limit: '500mb', strict: false}));

class responseInterceptor {
    predicate;
    callback;

    constructor(predicate, callback) {
        this.predicate = predicate;
        this.callback = callback;
    }
}

const responseInterceptors = [
    new responseInterceptor(
        (req, proxyRes) =>
            req.method === "POST" &&
            req.url.endsWith("/chat_conversations") &&
            proxyRes.statusCode === 201,
        async (req, rawData) => {
            const parsedData = JSON.parse(rawData);

            const conversationId = parsedData.uuid;
            const userKey = getUserKey(req);

            // Store in database
            const db = await dbPromise;
            await db.run(
                "INSERT OR REPLACE INTO conversation_mappings (conversation_id, user_key) VALUES (?, ?)",
                [conversationId, userKey],
            );

            return ({updatedData: rawData})
        },
    ),
    new responseInterceptor(
        (req, proxyRes) =>
            req.method === "GET" &&
            /\/api\/organizations\/(.+?)\/chat_conversations/.test(req.url) && req.url.indexOf("/chat_conversations/") < 0,
        async (req, rawData) => {
            const parsedData = JSON.parse(rawData);

            const conversationIds = parsedData.map(x => x.uuid);

            // Store in database
            const db = await dbPromise;
            // Get all valid mappings for this user
            const validMappings = await db.all(
                `SELECT conversation_id
                 FROM conversation_mappings
                 WHERE user_key = ?
                   AND conversation_id IN (${conversationIds.map(() => '?').join(',')})`,
                [getUserKey(req), ...conversationIds]
            );

            // Create a Set of valid conversation IDs for efficient lookup
            const validConversationIds = new Set(validMappings.map(row => row.conversation_id));

            // Filter out conversations that don't have a valid mapping
            // const filteredData = parsedData.filter(conversation =>
            //     validConversationIds.has(conversation.uuid)
            // );

            const redactedData = parsedData.map(conversation => {
                if (validConversationIds.has(conversation.uuid)) {
                    return conversation;
                }
                return ({...conversation, name: redactedMessage()});
            })

            // Return the filtered data
            return {updatedData: JSON.stringify(redactedData)};
        },
    ),
    new responseInterceptor(
        (req, proxyRes) =>
            req.headers['accept'].startsWith("text/html"),
        async (req, rawData) => {
            rawData = rawData.replaceAll(getConfig().redactEmailAddress, "Super Duper Pro User");
            rawData = rawData.replace('</head>', '<script src="/inject.js"></script></head>');
            return ({updatedData: rawData})
        },
    ),
];

function getResponseInterceptor(req, proxyRes) {
    for (let responseInterceptor of responseInterceptors) {
        if (responseInterceptor.predicate(req, proxyRes)) {
            return responseInterceptor;
        }
    }

    return null;
}

// Login route
app.get("/login", (req, res) => {
    const {password} = req.query;

    if (password !== getConfig().password) {
        return res.status(401).send("Invalid password");
    }

    if (getUserKey(req)) {
        res.redirect("/");
    }

    const {userKey, signature} = generateAuthTokens();

    // Set cookies with appropriate security flags
    res.cookie("user-key", userKey, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000 * 365,
    });

    res.cookie("signature", signature, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000 * 365,
    });

    res.send(`  
        <html>  
            <body style="text-align: center; padding-top: 50px; font-family: Arial, sans-serif;">  
                <h2>Account Created Successfully!</h2>  
                <p><a href="/login_token?session_key=FUCFUCLAUDE_SESSION_KEY">Click here to continue</a></p>  
                <p style="color: #666; font-size: 0.9em;">Note: First load may take a few moments. Subsequent loads will be faster once cached.<br>If you encounter any issues, try refreshing your browser.</p>
                ${getConfig().accountCreationSuccessfulExtraHtml || ''}  
            </body>  
        </html>  
    `);
});

app.use(authMiddleware);
app.use(conversationOwnershipMiddleware);
app.use(express.static('public'));

const fileCache = new Map();

// Handle all incoming requests
app.all("*", (req, res) => {
    const startTime = Date.now();

    // Check if request is for static files that should be cached
    if (/\.(woff2|otf|js|css)$/.test(req.url)) {
        // Check cache first
        const cachedResponse = fileCache.get(req.url);
        if (cachedResponse) {
            const responseTime = formatResponseTime(startTime);
            console.log(
                `${chalk.gray(getFormattedTime())} ` +
                `${chalk.yellow(req.method)} ${chalk.cyan(req.url)} ` +
                `${chalk.green('200')} ` +
                `${chalk.magenta(responseTime)} ` +
                `${chalk.blue('[cached]')}`
            );

            res.writeHead(200, cachedResponse.headers);
            res.end(cachedResponse.data);
            return;
        }
    }

    const injectedCookies = getConfig().cookies;

    const existingCookies = req.headers.cookie || "";
    const combinedCookies = [existingCookies, formatCookieHeader(injectedCookies)]
        .filter(Boolean)
        .join("; ");

    const host = getConfig().host;
    const url = new URL(`https://${host}`);

    req.url = req.url.replaceAll("FUCFUCLAUDE_SESSION_KEY", getConfig().sessionKey);
    const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: host,
            cookie: combinedCookies || undefined,
            'Accept-Encoding': 'identity',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
    };

    // Remove content-length header as we'll handle it specifically based on the case
    delete options.headers['content-length'];

    const proxyReq = https.request(options, (proxyRes) => {
        const responseTime = formatResponseTime(startTime);

        console.log(
            `${chalk.gray(getFormattedTime())} ` +
            `${chalk.yellow(req.method)} ${chalk.cyan(req.url)} ` +
            `${getStatusColor(proxyRes.statusCode)(proxyRes.statusCode)} ` +
            `${chalk.magenta(responseTime)} `
        );

        // Only cache successful responses for static files
        if (proxyRes.statusCode === 200 && /\.(woff2|otf|js|css)$/.test(req.url)) {
            let rawData = Buffer.from([]);

            proxyRes.on("data", (chunk) => {
                rawData = Buffer.concat([rawData, chunk]);
            });

            proxyRes.on("end", () => {
                // Cache the successful response
                fileCache.set(req.url, {
                    data: rawData,
                    headers: proxyRes.headers
                });

                // Send response
                res.writeHead(200, proxyRes.headers);
                res.end(rawData);
            });
        } else {
            const interceptor = getResponseInterceptor(req, proxyRes);
            if (interceptor) {
                let rawData = Buffer.from([]); // Use Buffer instead of string

                proxyRes.on("data", (chunk) => {
                    rawData = Buffer.concat([rawData, chunk]);
                });

                proxyRes.on("end", async () => {
                    try {
                        const stringData = rawData.toString('utf8');
                        const {updatedData} = await interceptor.callback(req, stringData);

                        const responseHeaders = {
                            ...proxyRes.headers,
                        };

                        delete responseHeaders['Content-Length'];
                        delete responseHeaders['content-length'];

                        // Set response headers
                        res.writeHead(proxyRes.statusCode, responseHeaders);

                        // Send the full response
                        res.end(updatedData);
                    } catch (e) {
                        console.error("Error parsing response:", e);
                        res.status(500).send("Error processing response");
                    }
                });
            } else {
                // Set response headers
                res.writeHead(proxyRes.statusCode, proxyRes.headers);

                // Stream the response
                proxyRes.pipe(res);
            }
        }
    });

    // Handle proxy request errors
    proxyReq.on("error", (error) => {
        console.error(
            `${chalk.gray(getFormattedTime())} ` +
            `${chalk.yellow(req.method)} ${chalk.cyan(req.url)} ` + " proxy Request Error:", error);
        res.status(500).send("Proxy Request Failed");
    });

    // Handle request body based on content type
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data')) {
        // For multipart form data, pipe directly
        req.pipe(proxyReq);
    } else if (req.body) {
        // For JSON/form data, set correct content length
        const bodyData = JSON.stringify(req.body);
        proxyReq.write(bodyData);
        proxyReq.end();
    } else {
        proxyReq.end();
    }

    req.on("error", (error) => {
        console.error(
            `${chalk.gray(getFormattedTime())} ` +
            `${chalk.yellow(req.method)} ${chalk.cyan(req.url)} ` + " client Request Error:", error);
        res.status(500).send("Client Request Failed");
    });
});

app.listen(PORT, async () => {
    await initializeDatabase();
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
