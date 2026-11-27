# Gate 13 — Custodia documental (Checkpoint 01)

Baseline aprobado: `df702949c74bcf3df97f98096d3dc2ee4f40aa44`. QA histórico `PARTIAL`; cierre técnico local aceptado con ISS-10 P1 abierto.

- 85 originales: 55.466.647 bytes, 12 documentos, 2 ZIP y 71 PNG.
- Respaldo verificado: `LEVELPRO_GATE13_CUSTODY_85_ORIGINALS.zip` (SHA-256 `570b51e5267acfd01cf6a23277c12868ba5c5c72386d7bdc55ac07d1ca01f473`). Copia local preparada; no publicada ni subida a GCS/Releases/LFS.
- Doce documentos maestros preparados para Git. Once conservan bytes originales; `owner-visual-approval-board.md` normaliza enlaces obsoletos, preservando el original en el ZIP.
- `custody-manifest.json` conserva hash de cada original y de cada versión preparada.
- El manifiesto histórico `visual-board/manifest.json` está referenciado pero no fue incluido en el handoff; no afirmar que se recuperó. Los 33 PNG históricos sí están inventariados.
- El paquete maestro Phase 1.2 y ambos tableros están preservados. No se autorizan borrados ni limpieza automática.
- No declarar que el respaldo está en almacenamiento remoto hasta verificar el destino y su hash.
