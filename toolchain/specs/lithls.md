# `lithls` implementation specification

Status: reviewed specification only. The `lithls` crate remains at `0.0.1` and
must not advertise or start an LSP server. This boundary follows the original
toolchain target, which lists `lithls` as specification-only in this scaffold.

Normative references verified on 2026-08-16:

- Language Server Protocol 3.17 specification:
  <https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/>
- JSON-RPC 2.0 specification: <https://www.jsonrpc.org/specification>

## Minimum implementation boundary

A future implementation may be called an LSP server only when all requirements
in this section are implemented and tested together.

1. **Transport:** stdio framing uses ASCII headers, a required `Content-Length`
   measured in content bytes, the header/content separator required by LSP, and
   UTF-8 JSON content. Truncated, oversized, duplicate, malformed, or unsupported
   headers fail deterministically without panicking or allocating unbounded input.
2. **JSON-RPC 2.0:** use a conforming JSON parser. Preserve string, number, and
   `null` request IDs exactly; never reply to notifications; distinguish parse
   error, invalid request, invalid params, method-not-found, and internal error;
   and emit exactly one of `result` or `error` in a response.
3. **Lifecycle:** enforce `initialize` before normal requests, accept
   `initialized`, implement `shutdown`, and honor `exit` with the protocol-defined
   success/failure behavior. Capabilities must describe only implemented features.
4. **Document synchronization:** implement `didOpen`, `didChange`, and `didClose`
   as one coherent capability. Version updates must be ordered and stale changes
   rejected. The initial implementation uses full-document synchronization unless
   incremental synchronization is separately implemented and accepted.
5. **Positions:** negotiate an LSP 3.17 position encoding or correctly use the
   protocol fallback. Parser byte offsets must be converted to the negotiated
   character units, including non-ASCII and non-BMP text and all supported line
   endings.
6. **Diagnostics:** publish syntax and conservative declaration diagnostics for
   the synchronized document version. Every diagnostic needs a real source span;
   closing a document clears its diagnostics.
7. **Document symbols:** return only symbols backed by declaration spans in the
   parser AST. Placeholder ranges such as `0:0..0:1` are forbidden.

Completion, hover, go-to-definition, incremental synchronization, workspace
features, and lint configuration are not part of this minimum boundary. They
must not be advertised until their semantics and release priority are approved.

## Required verification

- Framing tests for byte lengths, partial reads, multiple sequential messages,
  UTF-8 content, malformed headers, bounded message size, and clean EOF.
- JSON-RPC conformance tests covering every accepted ID type, notifications,
  malformed JSON, invalid requests/params, unknown methods, and escaping.
- Lifecycle state-machine tests, including requests before initialization,
  repeated initialize/shutdown, and both exit paths.
- Synchronization tests for open/change/close, monotonically increasing versions,
  multiple documents, and diagnostic clearing.
- Position/range fixtures containing ASCII, multibyte UTF-8, non-BMP characters,
  LF, CRLF, and CR line endings.
- Real-span diagnostic and document-symbol fixtures against both tracked Makalu
  contracts.
- End-to-end stdio sessions from at least two approved editor clients on Linux,
  Windows, and macOS, followed by editor-owner and release-owner acceptance.

## Rejected draft boundary

The local uncommitted draft reviewed on 2026-08-16 is not an acceptable basis for
release. It promotes the package to `0.1.0`, extracts JSON fields with substring
search, ignores required JSON-RPC validation/error behavior, emits placeholder
symbol and semantic ranges, does not implement position encoding, and has no
editor conformance evidence. None of that draft is included in this slice.
