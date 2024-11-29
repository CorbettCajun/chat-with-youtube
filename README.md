# Chat with YouTube 🎥💬

An AI-powered application that enables interactive conversations with YouTube video content using OpenAI's advanced language models and Pinecone vector database. Ask questions, get summaries, and engage with video content in a natural, conversational way.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-powered-blue.svg)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT-green.svg)

## ✨ Features

- 🤖 Natural language conversations with video content
- 🎯 Precise answers from specific video timestamps
- 📝 Generate video summaries and key points
- 🔍 Search across multiple videos simultaneously
- 🔒 Secure API key management
- 🐳 Easy deployment with Docker
- 🚀 Simple setup wizard

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- 🐳 [Docker](https://www.docker.com/products/docker-desktop/) installed
- 🔑 [OpenAI API key](https://platform.openai.com/account/api-keys)
- 📊 [Pinecone account](https://app.pinecone.io/) and API key

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/CorbettCajun/chat-with-youtube.git
   cd chat-with-youtube
   ```

2. Start the application:

   ```bash
   docker compose up -d
   ```

3. Open your browser and visit:

   ```bash
   http://localhost:3001/setup
   ```

4. Complete the setup wizard by providing:
   - OpenAI API Key
   - Pinecone API Key
   - Pinecone Index Name

## 🔧 Configuration

### Environment Setup

The application supports two configuration methods:

#### 1. Setup Wizard (Recommended)

- Visit `http://localhost:3001/setup`
- Follow the guided process
- Automatic secure storage of credentials

#### 2. Manual Configuration

Create a `secrets` directory and add your API keys:

```bash
mkdir -p secrets
echo -n "your-openai-key" > secrets/openai_api_key.txt
echo -n "your-pinecone-key" > secrets/pinecone_api_key.txt
echo -n "your-index-name" > secrets/pinecone_index.txt
```

### API Keys Guide

#### OpenAI Setup

1. Visit [OpenAI API Keys](https://platform.openai.com/account/api-keys)
2. Click "Create new secret key"
3. Copy and save your key securely

#### Pinecone Setup

1. Create account at [Pinecone](https://app.pinecone.io/)
2. Create a new project
3. Create an index with:
   - Dimensions: 1536
   - Metric: Cosine
   - Pod Type: p1.x1 (or higher)

## 📝 Usage

1. Start a conversation by entering a YouTube URL
2. Ask questions about the video content
3. Get timestamps and relevant quotes
4. Generate summaries and key points

## 🛠️ Development

For local development:

```bash
# Install dependencies
npm install

# Start in development mode
docker compose -f docker-compose.dev.yml up -d
```

## 🔍 Troubleshooting

### Common Issues

1. **API Connection Issues**
   - Verify API keys are correct
   - Check network connectivity
   - Ensure Pinecone index exists

2. **Docker Issues**
   - Run `docker compose ps` to check container status
   - View logs: `docker compose logs -f`
   - Verify port 3001 is available

3. **Performance Issues**
   - Check system resources
   - Verify Pinecone plan limits
   - Monitor OpenAI API usage

## 🔒 Security

- API keys stored using Docker secrets
- Encrypted communication
- Setup page accessible only during initial configuration
- Regular security updates

## 📚 Documentation

For detailed documentation, visit our [Wiki](https://github.com/CorbettCajun/chat-with-youtube/wiki).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for their powerful language models
- Pinecone for vector search capabilities
- Docker for containerization
- The open-source community
