import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../agent.css", import.meta.url), "utf8");

assert.match(css, /\.agent-chat-window\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0, auto\) auto;/, "chat window should keep heading, messages, and composer as explicit rows");
assert.match(css, /\.agent-chat-window \.agent-chat\s*\{[\s\S]*align-content:\s*start;[\s\S]*grid-auto-rows:\s*max-content;/, "chat messages should stack at their content height instead of stretching vertically");
assert.match(css, /\.agent-chat-window \.agent-message\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*52rem;/, "chat message tracks should use the available reading width");
assert.match(css, /\.agent-chat-window \.agent-message-user\s*\{[\s\S]*justify-self:\s*end;/, "user message tracks should align to the right edge of the chat");
assert.match(css, /\.agent-message-body\s*\{[\s\S]*overflow-wrap:\s*anywhere;/, "long model replies should wrap inside the bubble");
assert.match(css, /\.agent-chat-window\s*\{[\s\S]*background:\s*rgba\(255, 255, 255, \.78\)/, "chat window should use a translucent surface");
assert.match(css, /\.agent-chat-window\s*\{[\s\S]*backdrop-filter:\s*blur\(/, "translucent chat window should soften the page behind it");
assert.match(css, /\.agent-chat-window \.agent-chat\s*\{[\s\S]*assets\/ui\/stages\/mission_2_0\.webp/, "chat conversation should use a calm game scene as its visual background");
assert.match(css, /\.agent-chat-window \.agent-chat\s*\{[\s\S]*rgba\(251, 253, 254, \.35\)/, "game scene should fade into a readable conversation surface");

console.log("agent chat layout tests passed");
