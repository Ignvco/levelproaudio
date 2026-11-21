// utils/variantSpecs.js — Resolución determinista de especificaciones técnicas por variante (PIM-04)

const VARIANT_SPEC_KEY_ALIASES = {
  impedance_ohm: ["impedance_ohm", "impedance"],
  connector_type: ["connector_type", "connection"],
  connectivity: ["connectivity", "connection"],
  material_finish: ["material_finish", "color"],
  cable_length_m: ["cable_length_m", "size"],
}

const EXTRA_VARIANT_ATTR_LABELS = {
  impedance: { label: "Impedancia", unit: "Ω", data_type: "text" },
  connection: { label: "Conexión", unit: "", data_type: "text" },
  color: { label: "Color / Acabado", unit: "", data_type: "text" },
  size: { label: "Tamaño / Longitud", unit: "", data_type: "text" },
  configuration: { label: "Configuración", unit: "", data_type: "text" },
}

function formatVariantOverrideValue(rawVal, unit = "", key = "") {
  const str = String(rawVal ?? "").trim()
  if (!str) return ""
  const cleanUnit = String(unit || "").trim()

  if (key === "impedance_ohm" || key === "impedance") {
    const match = str.match(/^(\d+(?:[.,]\d+)?)\s*(ohm|ohms|ω)?$/i)
    if (match) {
      return `${match[1]} ${cleanUnit || "Ω"}`
    }
  }

  if (cleanUnit && !str.toLowerCase().includes(cleanUnit.toLowerCase())) {
    if (cleanUnit.toLowerCase() === "ω" && /\bohm(s)?\b/i.test(str)) {
      return str.replace(/\bohm(s)?\b/i, "Ω")
    }
    return `${str} ${cleanUnit}`
  }

  return str
}

/**
 * Combina las especificaciones técnicas comunes del producto maestro con los
 * valores específicos de la variante seleccionada, respetando tipos y unidades.
 */
export function resolveEffectiveSpecs(technicalSpecs = [], selectedVariant = null) {
  const baseSpecs = Array.isArray(technicalSpecs) ? technicalSpecs : []
  if (!selectedVariant) {
    return baseSpecs
  }

  const attrs = selectedVariant.attributes && typeof selectedVariant.attributes === "object"
    ? selectedVariant.attributes
    : {}

  const consumedAttrKeys = new Set()

  const merged = baseSpecs.map((spec) => {
    // 1. Peso específico de la variante
    if (spec.key === "weight_kg" && selectedVariant.weight != null && selectedVariant.weight !== "") {
      return {
        ...spec,
        display_value: formatVariantOverrideValue(selectedVariant.weight, spec.unit || "kg", spec.key),
        from_variant: true,
      }
    }

    // 2. Atributos de variante que sobrescriben un spec maestro
    const candidateKeys = VARIANT_SPEC_KEY_ALIASES[spec.key] || [spec.key]
    for (const candidateKey of candidateKeys) {
      if (attrs[candidateKey] !== undefined && attrs[candidateKey] !== null && String(attrs[candidateKey]).trim() !== "") {
        consumedAttrKeys.add(candidateKey)
        return {
          ...spec,
          display_value: formatVariantOverrideValue(attrs[candidateKey], spec.unit, spec.key),
          from_variant: true,
        }
      }
    }

    return spec
  })

  // 3. Añadir atributos propios de la variante que no existían en la ficha maestra
  Object.entries(EXTRA_VARIANT_ATTR_LABELS).forEach(([attrKey, meta]) => {
    if (consumedAttrKeys.has(attrKey)) return
    const val = attrs[attrKey]
    if (val === undefined || val === null || String(val).trim() === "") return
    merged.push({
      id: `variant-attr-${attrKey}`,
      key: attrKey,
      label: meta.label,
      unit: meta.unit,
      data_type: meta.data_type,
      display_value: formatVariantOverrideValue(val, meta.unit, attrKey),
      from_variant: true,
    })
  })

  return merged
}
