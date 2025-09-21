// Load environment variables from a .env file
require("dotenv").config();

// Import required Node.js libraries
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const axios = require("axios");

// Get the necessary keys and IDs from your .env file
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ACCESS_TOKEN = process.env.CONTENTFUL_ACCESS_TOKEN;
const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;

// The channel name to listen for testimonials
const TESTIMONIALS_CHANNEL_NAME = "server-testimonials-for-website";

// The Contentful content type ID for testimonials
const CONTENTFUL_CONTENT_TYPE = "userTestimonial";

// Create a new Discord client instance with necessary intents
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent, // Necessary to read message content
	],
	partials: [Partials.Channel, Partials.Message],
});

// A function to check if a testimonial from a specific Discord message exists in Contentful
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
		// Find the guild the bot is in
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

		// Calculate the timestamp for 10 minutes ago
		const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

		// Fetch messages from the channel
		const messages = await channel.messages.fetch({ limit: 100 });
		console.log(`Found ${messages.size} messages in the channel.`);

		for (const message of messages.values()) {
			// Check if the message is older than 10 minutes and not empty
			const messageTimestamp = message.createdTimestamp;
			if (messageTimestamp < tenMinutesAgo && message.content.length > 0) {
				// Check if the testimonial has already been posted to Contentful
				const testimonialExists = await checkIfTestimonialExists(message.id);
				if (testimonialExists) {
					console.log(
						`Skipping message ${message.id} as it already exists in Contentful.`
					);
					continue; // Skip to the next message
				}

				console.log(`Processing message from ${message.author.tag}...`);

				// Convert plain string message content to Contentful Rich Text format
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
							"en-US": message.id, // Use the message ID as the unique identifier
						},
						messageContent: {
							"en-US": richTextMessage,
						},
						userAvatar: {
							"en-US": message.author.displayAvatarURL(),
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
			// Log the detailed error from Contentful
			console.error(
				"An error occurred during testimonial processing:",
				JSON.stringify(error.response.data.details, null, 2)
			);
		} else {
			// Log a generic error
			console.error("An error occurred during testimonial processing:", error.message);
		}
	}
}

// When the bot is ready, it will start the scheduled task
client.once("ready", async () => {
	console.log(`Bot is online! Logged in as ${client.user.tag}`);
	// Start the processing function immediately and then every 30 minutes
	await processTestimonials();
	setInterval(processTestimonials, 30 * 60 * 1000); // Check every 30 minutes
});

// Log in to Discord
client.login(DISCORD_BOT_TOKEN);
