# Contentful Discord Bridge

A Discord bot that automatically syncs testimonials from a Discord channel to Contentful CMS.

## Features

- Monitors a specified Discord channel for testimonials
- Automatically syncs messages older than 10 minutes to Contentful
- Processes user mentions and removes custom emojis
- Publishes entries automatically in Contentful
- Prevents duplicate entries by checking existing testimonials

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file with the following variables:

   ```
   DISCORD_BOT_TOKEN=your_discord_bot_token
   CONTENTFUL_SPACE_ID=your_contentful_space_id
   CONTENTFUL_ACCESS_TOKEN=your_contentful_access_token
   CONTENTFUL_MANAGEMENT_TOKEN=your_contentful_management_token
   ```

3. Run the bot:
   ```bash
   npm start
   ```

## Configuration

- `TESTIMONIALS_CHANNEL_NAME`: The Discord channel to monitor (default: "server-testimonials-for-website")
- `CONTENTFUL_CONTENT_TYPE`: The Contentful content type ID (default: "userTestimonial")

## How it works

The bot checks for new testimonials every 30 minutes. Messages must be:

- Older than 10 minutes
- Not empty
- Not already synced to Contentful

Each testimonial includes:

- User ID (Discord message ID)
- Username (Discord display name or username)
- Message content (cleaned and formatted)
- User avatar URL
- Timestamp
