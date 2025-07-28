# Excalidraw Custom Backend

This is a small express server used for storing share links and uploaded images
when running Excalidraw locally. Data is stored on disk in the `data` directory
inside the container.

## Endpoints

- `POST /api/v2/post/` – stores an encrypted scene and returns `{ id }`.
- `GET /api/v2/:id` – retrieves a stored scene.
- `POST /api/files/upload?prefix=<path>&id=<fileId>` – stores a binary file.
- `GET /api/files?prefix=<path>&id=<fileId>` – retrieves a stored file.

## Running

The repository provides a `docker-compose.yml` setup which starts this backend
alongside the Excalidraw frontend. Run:

```bash
yarn docker:up
```

The frontend will be available on `http://localhost:3000` and the backend on
`http://localhost:5000`.
