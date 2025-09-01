# Excalidraw + Backend + Nginx (with Local TLS)

This project runs Excalidraw and its backend behind an Nginx reverse proxy with **self-signed TLS certificates** generated automatically.

---

## 🚀 Quick Start

```bash
./build.sh
```

* Generates a private key (`conf/site.key`) and self-signed certificate (`conf/site.crt`) with SAN entries for `localhost` and `127.0.0.1`.
* Verifies that key and certificate match.
* Runs `docker compose up --build`.

Once started, open:
👉 [https://localhost](https://localhost)

> ⚠️ Your browser will show a self-signed certificate warning. Accept it for local testing.

---

## 🔧 Options

Run `./build.sh --help`:

```
Usage: ./build.sh [options] [-- <docker-compose-args>]

Options:
  --hosts "h1,h2,ip3"   Comma-separated DNS/IPs for SAN (default: localhost,127.0.0.1)
  --out DIR             Output directory for certs (default: conf)
  --days N              Validity days (default: 825)
  --rsa-bits N          RSA key size (default: 2048)
  --force               Regenerate even if files exist
  -h, --help            Show help

Example:
  ./build.sh --hosts "dev.local,localhost,127.0.0.1" --out conf
```

You can pass extra args to Docker Compose after `--`, e.g.:

```bash
./build.sh -- --build -d
```

---

## 📂 File Layout

```
conf/
  ├── site.crt   # Self-signed certificate
  ├── site.key   # Private key
  └── nginx.conf # Nginx reverse proxy config
```

Nginx mounts this folder as `/etc/nginx/certs/` and uses `site.crt` + `site.key` for TLS.

---

## 🧹 Troubleshooting

* If you see errors like *“mount src … not a directory”*, reset volumes:

  ```bash
  docker compose down -v
  ```

  Then rerun `./build.sh`.

* To regenerate certs explicitly:

  ```bash
  ./build.sh --force
  ```

---

## ✅ Notes

* Certificates are for **local dev only**. For production, use [Let’s Encrypt](https://letsencrypt.org/) or another CA.
* Keys are generated with **2048-bit RSA** by default. Increase with `--rsa-bits 4096` if desired.
* Default validity is **825 days** (browsers often reject longer).

---
