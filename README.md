# 🏰 Merlin's Tower

<p align="center">
  <img alt="Merlin's Tower - A magical conversational experience powered by Next.js and Supabase" src="https://demo-nextjs-with-supabase.vercel.app/opengraph-image.png">
</p>

<p align="center">
  An enchanted chatbot experience featuring three mystical personas: Merlin the Wise, Tempest the Weather Wizard, and Chronicle the News Scribe.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a> ·
  <a href="#environment-setup"><strong>Environment Setup</strong></a> ·
  <a href="#development"><strong>Development</strong></a>
</p>
<br/>

## ✨ Features

- **Magical Personas**
  - 🧙‍♂️ **Merlin**: The wise elder wizard who orchestrates conversations
  - 🌪️ **Tempest**: A young weather wizard providing real-time weather information
  - 📜 **Chronicle**: An ancient scribe delivering the latest news with mystical flair

- **Enhanced User Experience**
  - 🎙️ Voice Input Support
  - 💬 Multi-modal conversation handling
  - 🔄 Real-time streaming responses
  - 🎨 Color-coded messages by wizard
  - 📝 Conversation history persistence
  - 🔍 Multiple commands in single messages

- **Technical Magic**
  - 🔐 Secure authentication via Supabase
  - 💾 Conversation storage in Supabase
  - 🌐 Integration with OpenWeather API
  - 📰 Integration with NewsAPI
  - 🎯 Server-side streaming
  - 🌙 Dark/Light theme support

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/davisouza-plank/chatbot-training.git
   cd chatbot-training
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

## 🔮 Environment Setup

1. Create a `.env.local` file in the root directory with the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=[Your Supabase Project URL]
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[Your Supabase Anon Key]
   OPENWEATHER_API_KEY=[Your OpenWeather API Key]
   NEWSAPI_API_KEY=[Your NewsAPI Key]
   OPENAI_API_KEY=[Your OpenAI API Key]
   ```

2. Set up your Supabase project:
   - Create a new project at [database.new](https://database.new)
   - Set up authentication (Email providers)
   - Create necessary database tables for conversation storage

## 💫 Development

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to enter Merlin's Tower.

## 🧙‍♂️ How It Works

1. **Authentication**
   - Users must sign in to access the magical realm
   - Supports email/password and OAuth providers
   - Secure session management via Supabase

2. **Conversation Flow**
   - Messages are processed by Merlin who delegates to specialized wizards
   - Tempest handles weather-related queries
   - Chronicle manages news-related inquiries
   - Multiple commands can be processed in a single message

3. **Voice Interaction**
   - Click the microphone icon to activate voice input
   - Speech is automatically transcribed and processed
   - Supports natural language commands

4. **Message Display**
   - Each wizard has a unique color and icon
   - Responses are streamed in real-time
   - Weather and news information are beautifully formatted
   - Links are properly styled and clickable

5. **Conversation Management**
   - Conversations are automatically saved
   - Users can access their conversation history
   - Clear history option available
   - Real-time updates across devices

## 🛠️ Built With

- [Next.js 14](https://nextjs.org/) - React Framework
- [Supabase](https://supabase.com/) - Backend and Authentication
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI Components
- [OpenWeather API](https://openweathermap.org/api) - Weather Data
- [NewsAPI](https://newsapi.org/) - News Data

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
