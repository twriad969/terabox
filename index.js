const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const express = require('express');

const token = '6419032561:AAGYoiVQjdHrLzUwJYu0WIXcFkG-r90wgFI'; // Replace with your bot's token
const bot = new TelegramBot(token, { polling: true });
const updatesChannel = '@usefulltgbots';

const app = express();
const port = process.env.PORT || 3000;

let data = {};
const dataFile = 'data.json';

// Load data from JSON file
const loadData = () => {
    if (fs.existsSync(dataFile)) {
        data = JSON.parse(fs.readFileSync(dataFile));
    }
};

// Save data to JSON file
const saveData = () => {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
};

loadData();

const teraboxDomains = [
    "www.mirrobox.com", "www.nephobox.com", "freeterabox.com", "www.freeterabox.com", "1024tera.com",
    "4funbox.co", "www.4funbox.com", "teraboxlink.com", "terasharelink.com", "terabox.app", "terabox.com",
    "www.terabox.app", "terabox.fun", "www.terabox.com", "www.1024tera.com", "www.momerybox.com",
    "teraboxapp.com", "momerybox.com", "tibibox.com", "www.teraboxshare.com", "www.teraboxapp.com"
];

const isTeraboxLink = (link) => {
    return teraboxDomains.some(domain => link.includes(domain));
};

const checkSubscription = async (userId) => {
    try {
        const chatMember = await bot.getChatMember(updatesChannel, userId);
        return chatMember.status === 'member' || chatMember.status === 'administrator' || chatMember.status === 'creator';
    } catch (error) {
        console.error(error);
        return false;
    }
};

const sendStartMessage = (chatId) => {
    bot.sendMessage(chatId, `👋 Welcome! Please subscribe to our [updates channel](https://t.me/usefulltgbots) to use this bot.`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔔 Updates Channel', url: 'https://t.me/usefulltgbots' }]]
        }
    });
};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const isSubscribed = await checkSubscription(chatId);

        if (isSubscribed) {
            bot.sendMessage(chatId, `🎉 Welcome! Send a Terabox link to watch or download it.`);
        } else {
            sendStartMessage(chatId);
            bot.sendMessage(chatId, `❗️ Please subscribe and click /start again.`);
        }
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, `❌ An error occurred. Please try again later.`);
    }
});

bot.onText(/\/stat/, (msg) => {
    const chatId = msg.chat.id;
    try {
        const userCount = Object.keys(data).length;
        const linkCount = Object.values(data).reduce((sum, userData) => sum + userData.links.length, 0);
        bot.sendMessage(chatId, `📊 Stats:\n\n👥 Users: ${userCount}\n🔗 Links processed: ${linkCount}`);
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, `❌ An error occurred while retrieving statistics. Please try again later.`);
    }
});

bot.onText(/\/broad (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const broadcastMessage = match[1];

    for (const userId in data) {
        bot.sendMessage(userId, `📢 Broadcast Message:\n\n${broadcastMessage}`).catch(error => {
            console.error(`Failed to send message to ${userId}:`, error);
        });
    }

    bot.sendMessage(chatId, `✅ Broadcast message sent to all users.`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text.startsWith('/start') || text.startsWith('/stat') || text.startsWith('/broad')) {
        return;
    }

    try {
        const isSubscribed = await checkSubscription(chatId);

        if (!isSubscribed) {
            sendStartMessage(chatId);
            bot.sendMessage(chatId, `❗️ Please subscribe and click /start again.`);
            return;
        }

        if (!isTeraboxLink(text)) {
            bot.sendMessage(chatId, `❌ That is not a valid Terabox link.`);
            return;
        }

        if (!data[chatId]) {
            data[chatId] = { links: [] };
        }

        const userLinks = data[chatId].links;
        const existingLink = userLinks.find(linkData => linkData.original === text);

        if (existingLink) {
            bot.sendMessage(chatId, `✅ Your video is already processed. Click the button to view or download it.`, {
                reply_markup: {
                    inline_keyboard: [[{ text: '📥 Watch/Download', url: existingLink.download }]]
                }
            });
            return;
        }

        bot.sendMessage(chatId, `🔄 Processing your link...`).then(sentMessage => {
            const messageId = sentMessage.message_id;

            axios.get(`https://teraboxdownloader.top/api.php?link=${text}`)
                .then(response => {
                    const downloadUrl = response.data.url;

                    userLinks.push({ original: text, download: downloadUrl });
                    saveData();

                    bot.editMessageText(`✅ Your video is processed. Click the button to view or download it.`, {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [[{ text: '📥 Watch/Download', url: downloadUrl }]]
                        }
                    });
                })
                .catch(error => {
                    console.error(error);
                    bot.editMessageText(`❌ There was an error processing your link. Please try again later.`, {
                        chat_id: chatId,
                        message_id: messageId
                    });
                });
        });
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, `❌ An error occurred. Please try again later.`);
    }
});

app.get('/', (req, res) => {
    res.send('Telegram bot is running!');
});

app.listen(port, () => {
    console.log(`Express server is running on port ${port}`);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason, 'at', promise);
});

process.on('SIGINT', () => {
    saveData();
    process.exit();
});
