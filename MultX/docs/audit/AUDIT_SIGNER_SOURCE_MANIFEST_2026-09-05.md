# MultX non-AWS signer source manifest

Status: review candidate; signing and mainnet activation remain disabled.

This manifest defines the non-AWS signer source boundary submitted for
independent review. SHA-256 values are lowercase hashes of the exact file
bytes. The final release evidence must regenerate and compare these values
from the merged immutable tag.

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `MultX/signer/.dockerignore` | 6 | `8655e8d313ed7c3ed807463c94852fa4f1afabdbb56f3dc66eb917f5890d6de7` |
| `MultX/signer/Dockerfile` | 15 | `b1364a324742a470554cc192e2324f97b331d040e80930ebe7b7b08c2b696aad` |
| `MultX/signer/OPERATOR_RUNBOOK.md` | 71 | `b29b5c5ae108111ec6b49d65b5c24c502d0770a629677679aac138b455efb6d2` |
| `MultX/signer/README.md` | 54 | `ccf98b1feea255d3fafde9f2b55f60cf734998515f68bd63c7d83b35987cf909` |
| `MultX/signer/compose.example.yaml` | 31 | `4e9bf5144c94aaf21d23ffd915c9b665f202b204e2173ebfe8db22b152358e3e` |
| `MultX/signer/package-lock.json` | 121 | `5466a8cd539d1cec91224e45ad3612aa7496bac1a35cf173cd3c88817835f5c3` |
| `MultX/signer/package.json` | 13 | `53862cc703af9023a1a13d63e88a321561bf6c93d6a46bc79f8bd2871a44f6f1` |
| `MultX/signer/policy.example.json` | 19 | `fb73596391f12f7abf456b2c4620691a5e01049a85cf5feee9c5dd9c60f9f579` |
| `MultX/signer/signer.env.example` | 13 | `0dc9f851a022ec9b184c9cb80d6d2edd5f575b439cbb12fe15ec29dbcd9bf3e2` |
| `MultX/signer/src/auth.js` | 27 | `89af267afe6ba7a08a3bf344b5314a9cea910ec66cc433e20ca8452a32cb97fb` |
| `MultX/signer/src/deploymentMode.js` | 27 | `eb08fb924e328c7199fb1b3e4852be0b7560a20de5d74d6d1a9cd2ac6bce5ca5` |
| `MultX/signer/src/index.js` | 193 | `793b379ba3d0e0ae2eba70072b9debe3c192ccad1c4a293b1a0154061b33f74e` |
| `MultX/signer/src/journal.js` | 89 | `b94e2497e50a8fef054893d099b26b9442e1ac08ff769e466b4cc72d3dbda075` |
| `MultX/signer/src/policy.js` | 151 | `48a63c63cad4830e18b7ec0d366d712a347917cd75d04e1325e0d0db02f39f33` |
| `MultX/signer/src/runtimeConfig.js` | 31 | `c1d28695837e06fef7d92e36de825f506997cbb0b9a2b2acbb2be343802cee2c` |
| `MultX/signer/src/signingKey.js` | 41 | `ec61224152135ccb417aa82d6c77e47d0dd92ba4a7e911805ffe9b027b1ea626` |
| `MultX/signer/test/auth.test.js` | 21 | `64ed8ed2f7e186688fad1c9586aa5814455ecd7b267c4df5129d698ee04d491c` |
| `MultX/signer/test/deploymentMode.test.js` | 35 | `451efc83be19a0738168f3a31d0c3425d90896a25c554981021503b133d38aad` |
| `MultX/signer/test/journal.test.js` | 66 | `16e8afa94f089d0d870066a2e4cc471e1a7faab7c8cb08954a7a7e66ba9f9ffa` |
| `MultX/signer/test/policy.test.js` | 138 | `dc7769571503108004c6165b02d62b43a776b54bc1f61f4cf17c03f64ad313b2` |
| `MultX/signer/test/runtimeConfig.test.js` | 36 | `083f382e7ab2e3836a8cde4bd3568edc2744ffdf17177346a1f0ea6564bd6cea` |
| `MultX/signer/test/signingKey.test.js` | 60 | `6c0adfaa2c07f284b9a4c2cc9e9ec59cca9342a9dc28e48e2c92cc7fa68cbccd` |

The removed Fargate, KMS, and DynamoDB implementation files are not part of
this boundary. Their documentation is retained only under
`MultX/docs/archive/rejected-aws/` for historical traceability.
