# Installation

Get Zoe Agent up and running in your environment. Choose the installation method that fits your workflow.

## Prerequisites

Before installing Zoe Agent, ensure you have:

- **Node.js 18+** installed ([download here](https://nodejs.org/))
- **npm**, **pnpm**, or **bun** as your package manager
- An API key for your preferred LLM provider (OpenAI, Anthropic, or GLM)

::: tip Recommendation
We recommend using **pnpm** for faster installs and better disk space efficiency, but any package manager works fine.
:::

## Install as an SDK

Use Zoe Agent as a library in your Node.js projects.

### npm

```bash
npm install zoe-agent
```

### pnpm

```bash
pnpm add zoe-agent
```

### bun

```bash
bun add zoe-agent
```

### Verify Installation

Create a file called `test.js`:

```javascript
import { generateText } from 'zoe-agent'

const result = await generateText('Hello, Zoe Agent!', {
  provider: 'openai',
  model: 'gpt-5.4'
})

console.log(result.text)
```

Run it with your API key:

```bash
OPENAI_API_KEY=your-key node test.js
```

::: info TypeScript Support
Zoe Agent is written in TypeScript and includes full type definitions. No additional `@types` package needed.
:::

## Install as a CLI

Install Zoe Agent globally to use the command-line interface.

### npm

```bash
npm install -g zoe-agent
```

### pnpm

```bash
pnpm add -g zoe-agent
```

### Verify CLI Installation

```bash
zoe-agent --version
```

You should see the version number printed.

## Use with Docker

Zoe Agent includes a Dockerfile in the repository. Build the image and run the server or CLI without a local Node.js installation.

### Build the Image

```bash
git clone https://github.com/hashangit/zoe.git
cd zoe
docker build -t zoe-server .
```

### Run the Server

```bash
docker run -p 7337:7337 \
  -e OPENAI_API_KEY=your-key \
  zoe-server
```

The server will start on `http://localhost:7337`.

### Generate an API Key

```bash
docker exec -it <container-name> zoe server --generate-api-key
```

### Run the CLI

```bash
docker run -it -e OPENAI_API_KEY=your-key \
  zoe-server \
  zoe chat
```

## Deploy to Cloud Run

Deploy Zoe Agent to Google Cloud Run in one command:

```bash
# First, push the image to a registry (e.g., Artifact Registry)
docker tag zoe-server us-central1-docker.pkg.dev/YOUR_PROJECT/repo/zoe:latest
docker push us-central1-docker.pkg.dev/YOUR_PROJECT/repo/zoe:latest

# Deploy to Cloud Run
gcloud run deploy zoe \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT/repo/zoe:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=your-key
```

::: tip Environment Variables
For production, use Secret Manager or a similar service to store your API keys securely.
:::

## Development Setup

If you want to contribute to Zoe Agent or run it from source:

```bash
# Clone the repository
git clone https://github.com/hashangit/zoe.git
cd zoe

# Install dependencies
pnpm install

# Build the project
pnpm build

# Link globally for CLI development
pnpm link --global
```

## Next Steps

After installation:

1. [Configure your provider](/getting-started/configuration) with API keys
2. Follow the [Quick Start guide](/getting-started/quick-start) to build your first agent
3. Explore the [SDK Reference](/sdk/overview) for advanced usage

::: info Troubleshooting
If you encounter any issues during installation, check our [GitHub Issues](https://github.com/zoe/zoe/issues) or join our community discussions.
:::
