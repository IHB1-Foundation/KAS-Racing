# Security Policy

## Reporting a vulnerability
Please do not open public issues for security vulnerabilities.

Preferred: use GitHub Security Advisories / Private Vulnerability Reporting (if enabled for this repo).

If that is not available, email: **security@example.com** (replace with your preferred address).

## Secrets
- Never commit private keys, seeds, mnemonics, or API keys.
- Do not commit `.env` files; use `.env.example` when needed.

## Security Checklist (T-092)

### Secrets Management
- [x] `.env` is in `.gitignore`
- [x] `.env.example` provided with empty values
- [x] Private keys are only loaded at runtime from environment
- [x] Keys are never logged (masked in EVM tx engine logs)

### API Security
- [x] Rate limiting enabled (100 req/min general, 30 req/min for game events)
- [x] Request body size limited to 1MB
- [x] CORS configurable via environment variable
- [x] Standardized error codes (no sensitive info in errors)

### Wallet Security
- [x] Operator private key isolated in EVM tx engine
- [x] Contract addresses configured via environment
- [x] Key format validated before signing transactions

### Network Security
- [x] HTTPS enforced in production (via hosting provider)
- [x] WebSocket path is `/ws`
- [x] Trust proxy enabled for rate limiting behind reverse proxy

### Pre-Commit Recommendations
For additional security, consider:
```bash
# Install git-secrets (macOS)
brew install git-secrets

# Configure patterns
git secrets --register-aws
git secrets --add '[a-f0-9]{64}'  # Detect 64-char hex (private keys)

# Enable for this repo
git secrets --install
```
