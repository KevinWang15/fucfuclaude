import chalk from "chalk";

export const getFormattedTime = () => {
    return new Date().toISOString().replace("T", " ").slice(0, -5);
};

export const formatResponseTime = (startTime) => {
    const elapsed = Date.now() - startTime;
    if (elapsed < 1000) return `${elapsed}ms`;
    return `${(elapsed / 1000).toFixed(2)}s`;
};

// Helper function to color-code status codes
export const getStatusColor = (status) => {
    if (status < 300) return chalk.green;
    if (status < 400) return chalk.cyan;
    if (status < 500) return chalk.yellow;
    return chalk.red;
};

// Function to format cookies into a header string
export const formatCookieHeader = (cookies) => {
    return Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
};

export function redactedMessage() {
    return '🔒🔒🔒 REDACTED_MESSAGE'
}

