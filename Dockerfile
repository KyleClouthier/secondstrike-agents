FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY mcp ./mcp
# stdio MCP server: passes every JSON-RPC message to the hosted SECOND STRIKE endpoint (no dependencies)
ENTRYPOINT ["node", "mcp/server.mjs"]
