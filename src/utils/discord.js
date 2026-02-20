import fetch from 'node-fetch';
import { createReadStream, existsSync } from 'fs';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function emitDiscordWebhook(content) {
    if (!DISCORD_WEBHOOK_URL) return;

    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        });
    } catch (e) {
        console.error("[DiscordLog] Failed to send:", e);
    }
}

export async function uploadDiscordFile(filePath, content = "") {
    if (!DISCORD_WEBHOOK_URL) return;

    if (!filePath || !existsSync(filePath)) {
        return await emitDiscordWebhook(content);
    }

    try {
        const fileName = filePath.split("/").pop();

        const form = new FormData();

        form.append(
            "file",
            createReadStream(filePath),
            fileName
        );

        form.append(
            "payload_json",
            JSON.stringify({
                content,
                embeds: [
                    {
                        image: {
                            url: `attachment://${fileName}`
                        }
                    }
                ]
            })
        );

        await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            body: form
        });

    } catch (e) {
        console.error("[DiscordFileUpload] Failed:", e);
    }
}

export async function sendDiscord(message, imagePath = null) {
    if (imagePath && existsSync(imagePath)) {
        await uploadDiscordFile(imagePath, message);
    } else {
        await emitDiscordWebhook(message);
    }
}
