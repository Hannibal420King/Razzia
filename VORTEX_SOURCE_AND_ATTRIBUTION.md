# Source and attribution

This Vortex adaptation is based on **Razzia** by Ralex:

- Upstream source: <https://github.com/Ralex91/Razzia>
- Vortex fork: <https://github.com/Hannibal420King/Razzia>
- Integration branch: `vortex-v2`

The repository-level source is distributed under the MIT License. The complete
upstream MIT notice is preserved verbatim in `LICENSE` and is copied into the
runtime image at `/usr/share/licenses/razzia/LICENSE`.

`packages/socket/package.json` has declared the socket workspace as `ISC` since
its upstream introduction. No separate ISC notice accompanied that metadata.
This fork preserves that declaration and discloses the runtime image as
containing MIT- and ISC-declared source instead of silently changing upstream
license metadata.

Vortex-specific integration code added on this branch follows the repository's
MIT license. The three generated promotional catalog images under
`vortex/assets/catalog/` are project-owned originals created for
Hannibal420King. They use no upstream Razzia artwork; exact prompts, checksums,
provenance, review status, and their custom project-owned license reference are
recorded in `vortex/assets/catalog/asset-manifest.json`.

The three catalog gameplay screenshots are truthful 1920x1080 Playwright
captures from a completed two-player match running the hardened standalone
image. Their exact dimensions, byte sizes, SHA-256 checksums, capture
provenance, and preserved MIT-and-ISC source attribution are recorded alongside
the generated artwork in `vortex/assets/catalog/asset-manifest.json`.
