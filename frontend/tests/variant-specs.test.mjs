import test from "node:test"
import assert from "node:assert/strict"
import { resolveEffectiveSpecs } from "../src/utils/variantSpecs.js"

test("PIM-04: resolveEffectiveSpecs sustituye impedancia y conserva atributos comunes del maestro", () => {
  const masterSpecs = [
    { id: "1", key: "frequency_response", label: "Respuesta en Frecuencia", unit: "", data_type: "text", display_value: "5 Hz – 35 kHz" },
    { id: "2", key: "impedance_ohm", label: "Impedancia", unit: "Ω", data_type: "number", display_value: "80 Ω" },
    { id: "3", key: "weight_kg", label: "Peso", unit: "kg", data_type: "decimal", display_value: "0.35 kg" },
  ]

  const v250 = {
    id: "v-250",
    sku: "DT770-250",
    name: "250 Ohm / Estudio",
    weight: "0.38",
    attributes: {
      impedance: "250 Ohm",
      connection: "Jack 6.3mm",
    },
  }

  const effective = resolveEffectiveSpecs(masterSpecs, v250)
  const byKey = Object.fromEntries(effective.map(s => [s.key, s]))

  assert.equal(byKey.frequency_response.display_value, "5 Hz – 35 kHz")
  assert.equal(byKey.impedance_ohm.display_value, "250 Ω")
  assert.equal(byKey.weight_kg.display_value, "0.38 kg")
  assert.equal(byKey.connection.display_value, "Jack 6.3mm")
})
