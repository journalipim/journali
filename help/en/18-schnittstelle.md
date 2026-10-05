# Interface (API)

journali is headless: the user interface calls the same HTTP interface that any other system calls. There is no second way to the data.

## Description

`GET /api/openapi.json` returns the description (OpenAPI 3.0). It is generated from the endpoints of the running server and therefore matches it: path, method, parameters, body and the right a call needs (`x-recht`). The responses are not described. In the interface it is readable under **?** → **Interface (API)**.

## Signing in

- **Session:** `POST /api/auth/login` with `{ "user": …, "password": … }` sets a cookie. This is how the interface works.
- **Token:** Under ⚙ Settings → ◐ My account an API token is created; it is visible only when created. Send it in the header of every request: `Authorization: Bearer <token>`.
- **Encryption:** journali itself speaks only HTTP. Over a network, TLS belongs in front of it (a reverse proxy); otherwise the sign-in password travels unencrypted. The session cookie carries the `Secure` flag as soon as the connection is HTTPS.
- **Without a session** only `GET /api/health` (version and build), the calls for signing in (`/api/auth/login`, `state`, `setup`, `claim`) and the files of the Office add-ins are available. Everything else answers `401`.
- **Without users** in the installation everything is open; the author of an entry then comes from the header `X-Actor`. With users it comes from the session or the token.

## Rights

Every call requires a right (`x-recht` in the description). The role of the user or the token determines which rights apply. If one is missing, the server answers `403`.

## Errors

An error response is JSON: `{ "error": …, "template": …, "args": […] }`. `error` is the finished text. `template` with `args` is the template and its values, from which the interface translates.

## Writing

<!-- lizenz -->
A writing call creates entries in the journal; a call that creates several forms a batch. Entries that cost journali tokens are rejected by the server when the team has no quota left.
<!-- /lizenz -->
<!-- startphase -->
A writing call creates entries in the journal; a call that creates several forms a batch.
<!-- /startphase -->

## Example

```
curl -H "Authorization: Bearer $TOKEN" https://<server>/api/tree
```
