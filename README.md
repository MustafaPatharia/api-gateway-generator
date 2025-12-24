## 🚀 API Gateway Generator

Create a ready-to-import OpenAPI (Swagger) JSON file for AWS API Gateway — with an option to upload and deploy directly. Fun, fast, and CLI-driven.

---

## ✨ Highlights
- 🎯 Generates an OpenAPI JSON from service config
- 📤 Option to download the file or upload & deploy to an existing API Gateway
- 🔁 Auto-increments `version.txt` for safe versioning

## 🧰 Required environment variables
Set these before running the script (Development environment):

| Variable | Purpose | Example |
|---|---:|---|
| `DEV_USER_POOL` | Cognito user pool ID for authorizer | `us-east-1_AbCdEf123` |
| `DEV_API_URL` | Base API URL (non-proxy services) | `https://api.example.com` |
| `DEV_API_GATEWAY_URL` | Integration base URL for proxied services | `https://internal-service.local` |
| `DEV_API_GATEWAY_REGION` | AWS region | `us-east-1` |
| `DEV_ACCOUNT_ID` | AWS account ID (for authorizer ARN) | `123456789012` |
| `AWS_ACCESS_KEY` | AWS access key ID (for API calls) | — |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | — |

> Note: The script currently supports selecting the `Development` environment from the prompt and will read the variables above.

## ⚡ Quick start
```bash
# Install deps
npm install

# Run the generator
npm run start
```

Follow the interactive prompts: choose `Development`, generate the OpenAPI JSON, then pick `Download` or `Upload` to select an API Gateway and stage.

---

> - ✅ Current setup: `Development` environment is implemented and working out of the box.
> - ➕ To add more environments: define environment-specific variables (e.g., `STAGING_USER_POOL`, ?`STAGING_API_URL`) and extend the `configureEnvironment(environment)` function in `index.js` to handle the new environment. Optionally add the environment choices in the interactive prompt.

## 🧾 Output & files
- `Open_API_AWS_Gateway_Development.json` — generated OpenAPI file
- `version.txt` — auto-incremented semantic-ish version used in the OpenAPI `info.version`


## ❤️ Nice-to-haves (ideas)
- Add a GitHub Action to publish the generated OpenAPI file on PRs
- Add configurable environments beyond `Development`


---

Made with ❤️ — enjoy!

