# Link contract

`index.mjs` is the canonical, runtime-independent link protocol. The Next.js
application imports it directly. Lambda source directories contain generated
copies because SAM builds each function from its own `CodeUri`.

Run `node packages/contracts/sync.mjs` after changing the contract. CI uses
`node packages/contracts/sync.mjs --check` to reject drift before the separate
Lambda `CodeUri` directories are packaged.
