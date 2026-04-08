# 🤖 AI Agent Learning

A production-grade AI Agent application built with a **Skills-First** architecture using the Model Context Protocol (MCP) and LangGraph.js for orchestration.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                   │
│              Chat Interface + Streaming UI               │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────┐
│                   Backend (Fastify)                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Routes   │──│ LangGraph    │──│ Lifecycle Hooks   │  │
│  │          │  │ Agent Graph  │  │ Pre/Post ToolUse  │  │
│  └──────────┘  └──────┬───────┘  └───────────────────┘  │
│                       │                                  │
│            ┌──────────▼──────────┐                       │
│            │    MCP Client       │                       │
│            └──┬──────┬──────┬───┘                       │
│               │      │      │                            │
└───────────────┼──────┼──────┼────────────────────────────┘
                │      │      │
         ┌──────▼┐ ┌───▼──┐ ┌▼────────┐
         │Calc   │ │File  │ │External │
         │Server │ │Reader│ │GitHub,  │
         │(MCP)  │ │(MCP) │ │Maps...  │
         └───────┘ └──────┘ └─────────┘
```

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Backend | Node.js 24, Fastify, TypeScript |
| Frontend | React 19, Vite, TypeScript |
| Agent | LangGraph.js, MCP SDK |
| LLM | Google Gemini 2.5 Flash (free tier) |
| Database | AWS DynamoDB (perpetual free tier) |
| Infra | AWS ECS Fargate, ECR |
| CI/CD | GitHub Actions (OIDC) |

## Getting Started

### Prerequisites
- Node.js 24+
- Docker & Docker Compose
- AWS CLI configured
- Google AI Studio API key

### Setup

```bash
# Clone the repo
git clone https://github.com/deepakabari/ai-agent-learning.git
cd ai-agent-learning

# Create environment file
cp .env.example .env
# Edit .env with your GOOGLE_API_KEY and AWS settings

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Start the full stack
docker compose up
```

### Development

```bash
# Backend (hot reload)
cd backend && npm run dev

# Frontend (hot reload)
cd frontend && npm run dev
```

## Project Structure

```
├── backend/           # Fastify API + MCP Client + LangGraph Agent
│   ├── src/
│   │   ├── agent/     # LangGraph StateGraph orchestration
│   │   ├── mcp-client/# MCP Client for tool discovery
│   │   ├── hooks/     # PreToolUse / PostToolUse lifecycle hooks
│   │   ├── routes/    # API endpoints
│   │   └── db/        # DynamoDB conversation storage
│   └── mcp-servers/   # Custom MCP tool servers
├── frontend/          # React 19 chat interface
├── skills/            # Skill definitions (persona + logic)
└── .github/workflows/ # CI/CD pipeline
```

## Skills System

Each skill in `/skills/` contains:
- **`SKILL.md`** — Persona definition, instructions, constraints
- **`index.ts`** — Logic, tool bindings, skill configuration

## License

MIT
