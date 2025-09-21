require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const axios = require("axios");

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ACCESS_TOKEN = process.env.CONTENTFUL_ACCESS_TOKEN;
const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;

const TESTIMONIALS_CHANNEL_NAME = "server-testimonials-for-website";
const CONTENTFUL_CONTENT_TYPE = "userTestimonial";

// Create a new Discord client instance with necessary intents
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel, Partials.Message],
});

async function checkIfTestimonialExists(discordMessageId) {
	try {
		const response = await axios.get(
			`https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/entries`,
			{
				headers: {
					Authorization: `Bearer ${CONTENTFUL_ACCESS_TOKEN}`,
				},
				params: {
					content_type: CONTENTFUL_CONTENT_TYPE,
					"fields.userId": discordMessageId,
				},
			}
		);
		return response.data.items.length > 0;
	} catch (error) {
		console.error(
			"Error checking for existing testimonial: Request failed with status code",
			error.response.status
		);
		return false;
	}
}

// A function to fetch and process testimonials
async function processTestimonials() {
	console.log("Starting to process testimonials...");
	try {
		let guild;
		if (client.guilds.cache.size > 0) {
			guild = client.guilds.cache.first();
		} else {
			console.error("Error: Bot is not in any guilds.");
			return;
		}

		const channel = guild.channels.cache.find(
			(c) => c.name === TESTIMONIALS_CHANNEL_NAME && c.type === 0
		); // 0 is for a text channel

		if (!channel) {
			console.error(`Error: Channel #${TESTIMONIALS_CHANNEL_NAME} not found.`);
			return;
		}

		const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

		// Fetch messages from the channel
		const messages = await channel.messages.fetch({ limit: 100 });
		console.log(`Found ${messages.size} messages in the channel.`);

		for (const message of messages.values()) {
			const messageTimestamp = message.createdTimestamp;
			if (messageTimestamp < tenMinutesAgo && message.content.length > 0) {
				const testimonialExists = await checkIfTestimonialExists(message.id);
				if (testimonialExists) {
					console.log(
						`Skipping message ${message.id} as it already exists in Contentful.`
					);
					continue;
				}
				console.log(`Processing message from ${message.author.tag}...`);

				const richTextMessage = {
					nodeType: "document",
					data: {},
					content: [
						{
							nodeType: "paragraph",
							data: {},
							content: [
								{
									nodeType: "text",
									value: message.content,
									marks: [],
									data: {},
								},
							],
						},
					],
				};

				// Prepare the data payload for the Contentful API
				const testimonialData = {
					fields: {
						userId: {
							"en-US": message.id,
						},
						messageContent: {
							"en-US": richTextMessage,
						},
						timestamp: {
							"en-US": new Date(messageTimestamp).toISOString(),
						},
					},
				};

				// Make the POST request to Contentful
				const response = await axios.post(
					`https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/entries`,
					testimonialData,
					{
						headers: {
							Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
							"Content-Type": "application/vnd.contentful.management.v1+json",
							"X-Contentful-Content-Type": CONTENTFUL_CONTENT_TYPE,
						},
					}
				);

				console.log(
					`Successfully posted testimonial to Contentful: ${response.data.sys.id}`
				);

				// Automatically publish the newly created entry
				const entryId = response.data.sys.id;
				const version = response.data.sys.version;
				await axios.put(
					`https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/entries/${entryId}/published`,
					{},
					{
						headers: {
							Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
							"X-Contentful-Version": version,
						},
					}
				);
				console.log(`Successfully published testimonial with ID: ${entryId}`);
			}
		}

		console.log("Testimonial processing complete.");
	} catch (error) {
		if (error.response && error.response.data && error.response.data.details) {
			console.error(
				"An error occurred during testimonial processing:",
				JSON.stringify(error.response.data.details, null, 2)
			);
		} else {
			console.error("An error occurred during testimonial processing:", error.message);
		}
	}
}

// When the bot is ready, it will start the scheduled task
client.once("ready", async () => {
	console.log(`Bot is online! Logged in as ${client.user.tag}`);
	await processTestimonials();
	setInterval(processTestimonials, 12 * 30 * 60 * 1000); // Check every 12 hours
});

// Log in to Discord
client.login(DISCORD_BOT_TOKEN);
