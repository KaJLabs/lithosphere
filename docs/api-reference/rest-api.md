# REST API Reference

> **Work in Progress** -- This document is under active development. Some endpoints and details may change.

## Overview

The Lithosphere REST API provides HTTP endpoints for interacting with the Lithosphere network. The API returns JSON responses and follows standard REST conventions.

## Base URL

The base URL is configurable via the `LITHO_RPC_URL` environment variable.

```
LITHO_RPC_URL=https://your-node-url.example.com
```

## Authentication

Authentication details are to be determined. This section will be updated once the authentication mechanism is finalized.

## Endpoints

### GET /health

Health check endpoint. Returns the current status of the node.

**Request:**

```bash
curl -X GET ${LITHO_RPC_URL}/health
```

**Response (200 OK):**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-14T00:00:00.000Z"
}
```

### GET /api/litho

Returns chain information for the Lithosphere network.

**Request:**

```bash
curl -X GET ${LITHO_RPC_URL}/api/litho
```

**Response (200 OK):**

```json
{
  "chainId": 61,
  "network": "lithosphere",
  "version": "1.0.0"
}
```

## Response Format

All responses are returned in JSON format with appropriate `Content-Type: application/json` headers.

## Status Codes

| Code | Description |
|------|-------------|
| 200  | OK -- The request was successful. |
| 400  | Bad Request -- The request was malformed or missing required parameters. |
| 401  | Unauthorized -- Authentication failed or was not provided. |
| 500  | Internal Server Error -- An unexpected error occurred on the server. |

## Rate Limiting

Rate limiting details are to be determined. This section will be updated once rate limiting policies are implemented.

## Further Reading

Full API documentation is coming soon. Check back for comprehensive endpoint references, request/response schemas, and integration guides.
