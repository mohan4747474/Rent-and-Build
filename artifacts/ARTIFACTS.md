# RentBuild India artifacts

## Build a production frontend artifact

Run from the repository root:

```powershell
pnpm install
pnpm run package:web
```

The generated deployable frontend is written to:

```text
artifacts/rentbuild-india/dist/rentbuild-india-web
```

It contains the compiled `index.html`, JavaScript/CSS assets, and
`artifact-manifest.json`. Do not commit generated output; it is ignored by Git.

## Run the artifact locally

```powershell
pnpm --filter @workspace/rentbuild-india serve
```

Open:

```text
http://localhost:5173/
```

## Full local package and serve

```powershell
pnpm run package:web
pnpm --filter @workspace/rentbuild-india serve
```

The API is a separate process:

```powershell
pnpm start:api
```

Keep credentials in `.env` or Azure Key Vault. Never place Razorpay secrets,
bank settlement details, JWT secrets, or database passwords in the frontend artifact.
