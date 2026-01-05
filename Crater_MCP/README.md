# Crater MCP Server

This module provides a Model Context Protocol (MCP) server for the Crater invoicing application. It allows external systems (like LLMs, CRMs, or other agents) to interact with the Crater API to manage customers, invoices, estimates, payments, and items.

## Features

- **Protocol Support**: Supports both SSE (Server-Sent Events) and Stdio transports.
- **Resources**:
  - Customers (Create, Read, List, Delete)
  - Invoices (Create, Read, List, Send, Delete)
  - Estimates (Create, Read, List)
  - Payments (Create, Read, List)
  - Items (Create, Read, List)

## Configuration

The server requires the following environment variables to connect to your Crater instance:

- `CRATER_URL`: The base URL of your Crater application (e.g., `https://facturacion.arden.mx`).
- `CRATER_EMAIL`: The email address of the user to authenticate as.
- `CRATER_PASSWORD`: The password of the user.
- `CRATER_API_TOKEN`: (Optional) Use an API token instead of email/password.
- `MCP_SERVER_TOKEN`: (Required for public access) A secret token to secure the MCP server. Clients must send this in the `Authorization` header.
- `PORT`: (Optional) The port for the SSE server (default: 3001).

## Installation & Usage

### Docker

This module is designed to be run as a Docker container alongside your Crater stack.

Add the following to your `docker-compose.yml` (or `docker-compose.dokploy.yml`):

```yaml
  crater-mcp:
    build: ./Crater_MCP
    restart: always
    environment:
      - CRATER_URL=http://crater:80
      - CRATER_EMAIL=${CRATER_EMAIL}
      - CRATER_PASSWORD=${CRATER_PASSWORD}
      # - CRATER_API_TOKEN=${CRATER_API_TOKEN} # Use this if you want to use a token
      - MCP_SERVER_TOKEN=${MCP_SERVER_TOKEN:-my-secret-token} # SECURE THIS!
      - PORT=3001
    ports:
      - "3001:3001"
    networks:
      - dokploy-network
```

### Nginx Proxy

With the updated configuration, the MCP server is accessible via the main URL path `/mcp/`.
- SSE Endpoint: `https://your-crater-url.com/mcp/sse`

### Local Development

1.  Navigate to the `Crater_MCP` directory:
    ```bash
    cd Crater_MCP
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file with the configuration variables.
4.  Run the server:
    ```bash
    # For SSE (HTTP)
    node index.js

    # For Stdio (CLI/Agent)
    node index.js --stdio
    ```

## Connecting to the MCP Server

### SSE (HTTP)

The SSE endpoint is available at `http://<your-host>:3001/sse`. You can connect your MCP client (e.g., Claude Desktop, specialized CRM integration) to this URL.

### Stdio

You can run the server directly as a subprocess if your client supports Stdio transport.

## API Tools

The following tools are exposed:

- `create_customer`: Create a new customer.
- `list_customers`: List all customers.
- `get_customer`: Get details of a specific customer.
- `create_invoice`: Create a new invoice.
- `list_invoices`: List all invoices.
- `get_invoice`: Get details of a specific invoice.
- `send_invoice`: Send an invoice via email.
- `create_estimate`: Create a new estimate.
- `create_payment`: Record a payment.
- `create_item`: Create a new item/product.
- `list_items`: List all items.
