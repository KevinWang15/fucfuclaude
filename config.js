import fs from "node:fs";

let config = {};

function loadConfig() {
  try {
    config = JSON.parse(fs.readFileSync("config.json", "utf8"));
  } catch (error) {
    console.error("Error reading cookies.json:", error);
    return {};
  }
}

loadConfig();

// Watch for changes in config.json
fs.watch("config.json", (eventType, filename) => {
  if (eventType === "change") {
    loadConfig();
    console.log(
      "Config file changed, will use updated config in next requests",
    );
  }
});

export function getConfig() {
  return config;
}
