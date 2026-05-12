/* eslint-disable */
/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Regenerate via:  pnpm --filter @lithosphere/sdk codegen:openapi
 * Source of truth: docs/api-reference/openapi.yaml
 *
 * Drift-gated in CI: `openapi-codegen-check` runs the codegen and fails
 * on `git diff --exit-code`. If you see a diff locally, commit it.
 */
export type paths = {
    "/address/{address}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Address overview — balance, nonce, type (EOA/contract). */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Hex (0x…) or bech32 (`litho1…`) address. Server lowercases hex inputs. */
                    address: components["parameters"]["AddressPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Address summary. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/address/{address}/token-transfers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Token transfers involving an address. */
        get: {
            parameters: {
                query?: {
                    /** @description Page size. Capped server-side at 100. */
                    limit?: components["parameters"]["LimitQuery"];
                    /** @description Skip the first N results. */
                    offset?: components["parameters"]["OffsetQuery"];
                };
                header?: never;
                path: {
                    /** @description Hex (0x…) or bech32 (`litho1…`) address. Server lowercases hex inputs. */
                    address: components["parameters"]["AddressPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Paginated transfer list. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/address/{address}/tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** LEP100 token balances held by an address. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Hex (0x…) or bech32 (`litho1…`) address. Server lowercases hex inputs. */
                    address: components["parameters"]["AddressPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Per-token balance list. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/address/{address}/txs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Transactions involving an address. */
        get: {
            parameters: {
                query?: {
                    /** @description Page size. Capped server-side at 100. */
                    limit?: components["parameters"]["LimitQuery"];
                    /** @description Skip the first N results. */
                    offset?: components["parameters"]["OffsetQuery"];
                };
                header?: never;
                path: {
                    /** @description Hex (0x…) or bech32 (`litho1…`) address. Server lowercases hex inputs. */
                    address: components["parameters"]["AddressPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Paginated tx list. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/blocks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List indexed blocks (newest first). */
        get: {
            parameters: {
                query?: {
                    /** @description Page size. Capped server-side at 100. */
                    limit?: components["parameters"]["LimitQuery"];
                    /** @description Skip the first N results. */
                    offset?: components["parameters"]["OffsetQuery"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Paginated block list. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/blocks/{height}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a block by height. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    height: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Block detail with tx summary. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
                /** @description Block not indexed. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Public chain configuration (chain-id, denom, RPC URLs). */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Frontend bootstrap config. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/debug": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Indexer status — head height, lag, last-poll-error. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operational debug snapshot. Not authenticated; values are coarse. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/faucet/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request a testnet LITHO drip for an address. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description Recipient (hex or bech32). */
                        address: string;
                        /** @description hCaptcha token if enabled. */
                        captcha?: string;
                    };
                };
            };
            responses: {
                /** @description Drip submitted. Response includes tx hash. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Validation error (bad address */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Cooldown active for this address / IP. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/faucet/info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Faucet drip amount, cooldown window, captcha provider. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Faucet policy snapshot. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/litho/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Demo router root — lists demo endpoints. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Demo router descriptor. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/litho/balance/{address}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stub balance endpoint (returns 0; placeholder for SDK examples). */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Hex (0x…) or bech32 (`litho1…`) address. Server lowercases hex inputs. */
                    address: components["parameters"]["AddressPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Address + placeholder balance. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/litho/transfer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Stub transfer endpoint (returns a static demo hash; no signing). */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["JsonObject"];
                };
            };
            responses: {
                /** @description Demo response with a sentinel tx hash. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/price": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** LITHO token price snapshot (external feed, cached). */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Price + change-24h. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/stats/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Chain summary — height, txs, validators, last-block-time. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Headline metrics. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List indexed LEP100 tokens. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Token registry. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tokens/{address}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Token metadata + supply. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description LEP100 token contract address (hex). */
                    address: components["parameters"]["TokenAddressPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Token detail. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
                /** @description Token not indexed. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tokens/{address}/holders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Largest holders of a token. */
        get: {
            parameters: {
                query?: {
                    /** @description Page size. Capped server-side at 100. */
                    limit?: components["parameters"]["LimitQuery"];
                    /** @description Skip the first N results. */
                    offset?: components["parameters"]["OffsetQuery"];
                };
                header?: never;
                path: {
                    /** @description LEP100 token contract address (hex). */
                    address: components["parameters"]["TokenAddressPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Holder leaderboard (paged). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tokens/{address}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** LEP100 role grants for a token (admin / minter / burner). */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description LEP100 token contract address (hex). */
                    address: components["parameters"]["TokenAddressPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Role assignment list. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tokens/{address}/transfers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Recent transfers of a token. */
        get: {
            parameters: {
                query?: {
                    /** @description Page size. Capped server-side at 100. */
                    limit?: components["parameters"]["LimitQuery"];
                    /** @description Skip the first N results. */
                    offset?: components["parameters"]["OffsetQuery"];
                };
                header?: never;
                path: {
                    /** @description LEP100 token contract address (hex). */
                    address: components["parameters"]["TokenAddressPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Paginated transfer list. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/txs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List indexed transactions (newest first). */
        get: {
            parameters: {
                query?: {
                    /** @description Page size. Capped server-side at 100. */
                    limit?: components["parameters"]["LimitQuery"];
                    /** @description Skip the first N results. */
                    offset?: components["parameters"]["OffsetQuery"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Paginated transaction list. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/txs/{hash}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a transaction by hash (Cosmos or EVM). */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Transaction hash (0x-prefixed 32-byte EVM hash or 64-char Cosmos hash). */
                    hash: components["parameters"]["TxHashPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Transaction detail. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Not found in DB or on-chain. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/txs/{hash}/logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** EVM logs emitted by a transaction. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Transaction hash (0x-prefixed 32-byte EVM hash or 64-char Cosmos hash). */
                    hash: components["parameters"]["TxHashPath"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Ordered log array. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/validators": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Active and inactive validator set. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Validator metadata array. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonObject"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        JsonObject: {
            [key: string]: unknown;
        };
        Pagination: {
            limit?: number;
            offset?: number;
            total?: number;
        };
    };
    responses: never;
    parameters: {
        /** @description Hex (0x…) or bech32 (`litho1…`) address. Server lowercases hex inputs. */
        AddressPath: string;
        /** @description Page size. Capped server-side at 100. */
        LimitQuery: number;
        /** @description Skip the first N results. */
        OffsetQuery: number;
        /** @description LEP100 token contract address (hex). */
        TokenAddressPath: string;
        /** @description Transaction hash (0x-prefixed 32-byte EVM hash or 64-char Cosmos hash). */
        TxHashPath: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
