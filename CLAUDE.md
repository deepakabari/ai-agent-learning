# AI Agent Learning — Skills-First Architecture

## Stack
- **Backend:** Node.js 24 + Fastify + TypeScript
- **Frontend:** React 19 + Vite + TypeScript
- **Agent Framework:** MCP SDK (`@modelcontextprotocol/sdk`) + LangGraph.js
- **LLM Provider:** Google Gemini 2.5 Flash (`@langchain/google-genai`)
- **Database:** AWS DynamoDB (perpetual free tier)
- **Infrastructure:** AWS ECS Fargate + ECR
- **CI/CD:** GitHub Actions (OIDC auth, no stored credentials)

## Architecture
- `/backend/` — Fastify API server + MCP Client + LangGraph agent orchestration
- `/backend/mcp-servers/` — Custom MCP tool servers (stdio transport)
- `/frontend/` — React 19 chat interface with streaming support
- `/skills/` — Skill definitions (SKILL.md persona + index.ts logic)
- `.github/workflows/` — CI/CD pipeline

## Code Standards
- Use strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`)
- Use ESM modules (`"type": "module"` in package.json)
- Use functional components only (React)
- Extract logic into custom hooks (React)
- Keep components under 200 lines
- Write JSDoc for all public functions
- Use Zod for all schema validation

## Key Commands
- `npm run dev` — Start backend dev server (tsx watch)
- `npm run build` — Compile TypeScript
- `npm run test` — Run Vitest
- `npm run lint` — ESLint check
- `docker compose up` — Start full stack locally