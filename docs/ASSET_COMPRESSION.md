## Asset compression (models + textures)

This project now has runtime support for:
- **Meshopt-compressed glTF/GLB** (via `GLTFLoader.setMeshoptDecoder(...)`)
- **KTX2 textures (Basis Universal)** (via `KTX2Loader`)

Those changes live in:
- `src/appConfig/loaders.js` (Meshopt + KTX2 support, caching)
- `scripts/copy-assets.js` (copies Basis transcoders into `public/basis/` during builds)

### Model compression (Meshopt)

**Goal**: reduce download size and reduce parse/decode stutter for large GLBs (Star Destroyer, Death Star, asteroid pack).

Recommended tool:
- `gltfpack` (from `meshoptimizer`)

Example workflow (run locally):

```bash
# Example: compress a GLB with meshopt
gltfpack -i src/assets/models/death_star_highres.glb -o src/assets/models/death_star_highres.meshopt.glb -cc
```

Then update `src/appConfig/modelRegistry.js` to point to the new file.

Notes:
- You can keep the original `.glb` as a fallback until you’re confident.
- Meshopt only helps if the file is actually meshopt-compressed; the loader support is already in place.

### Texture compression (KTX2 / BasisU)

**Goal**: reduce texture decode + GPU upload cost (especially the skybox + large planet textures).

Recommended tool:
- `toktx` (KTX-Software) or other BasisU pipelines

Example (conceptual):

```bash
# Convert a JPEG to a KTX2 (BasisU) texture
toktx --bcmp --t2 --uastc 1 src/assets/textures/2k_earth_daymap.ktx2 src/assets/textures/2k_earth_daymap.jpg
```

Then update `src/appConfig/textureRegistry.js` to reference the `.ktx2` file.

Notes:
- `scripts/copy-assets.js` copies the required transcoders into `public/basis/` so Netlify can serve them.
- KTX2 brings the biggest win on mobile / lower-end GPUs and for very large textures (like the skybox images).

### Sanity check: asset report

You can always see what’s currently referenced by the registries + their sizes:

```bash
npm run assets:report
```

