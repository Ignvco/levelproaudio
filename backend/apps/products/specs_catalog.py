# apps/products/specs_catalog.py
"""
LEVELPRO OS V4.0 — GATE 2 (BF-44)
Catálogo de definiciones de atributos técnicos estructurados por familia de audio profesional,
con validación tipada, unidades y plantillas por categoría.
"""

from decimal import Decimal, InvalidOperation


AUDIO_ATTRIBUTE_DEFINITIONS = [
    {
        "key": "frequency_response",
        "label": "Respuesta en frecuencia",
        "data_type": "text",
        "unit": "Hz – kHz",
        "is_comparable": True,
        "is_filterable": False,
        "order": 10,
    },
    {
        "key": "max_spl_db",
        "label": "SPL máximo",
        "data_type": "decimal",
        "unit": "dB SPL",
        "min_value": Decimal("40"),
        "max_value": Decimal("180"),
        "is_comparable": True,
        "is_filterable": False,
        "order": 20,
    },
    {
        "key": "impedance_ohm",
        "label": "Impedancia",
        "data_type": "decimal",
        "unit": "Ω",
        "min_value": Decimal("0.1"),
        "max_value": Decimal("100000"),
        "is_comparable": True,
        "is_filterable": True,
        "order": 30,
    },
    {
        "key": "sensitivity",
        "label": "Sensibilidad",
        "data_type": "text",
        "unit": "dB / mV/Pa",
        "is_comparable": True,
        "is_filterable": False,
        "order": 40,
    },
    {
        "key": "polar_pattern",
        "label": "Patrón polar",
        "data_type": "multiselect",
        "unit": "",
        "options": [
            "Cardioide",
            "Supercardioide",
            "Hipercardioide",
            "Omnidireccional",
            "Bidireccional (Figura en 8)",
            "Multi-patrón",
        ],
        "is_comparable": True,
        "is_filterable": True,
        "order": 50,
    },
    {
        "key": "rms_power_w",
        "label": "Potencia RMS",
        "data_type": "decimal",
        "unit": "W RMS",
        "min_value": Decimal("0.1"),
        "max_value": Decimal("50000"),
        "is_comparable": True,
        "is_filterable": True,
        "order": 60,
    },
    {
        "key": "peak_power_w",
        "label": "Potencia Pico",
        "data_type": "decimal",
        "unit": "W",
        "min_value": Decimal("0.1"),
        "max_value": Decimal("100000"),
        "is_comparable": True,
        "is_filterable": False,
        "order": 70,
    },
    {
        "key": "thd_percent",
        "label": "THD (Distorsión armónica)",
        "data_type": "decimal",
        "unit": "%",
        "min_value": Decimal("0"),
        "max_value": Decimal("100"),
        "is_comparable": True,
        "is_filterable": False,
        "order": 80,
    },
    {
        "key": "snr_db",
        "label": "Relación señal / ruido (SNR)",
        "data_type": "decimal",
        "unit": "dB",
        "min_value": Decimal("20"),
        "max_value": Decimal("160"),
        "is_comparable": True,
        "is_filterable": False,
        "order": 90,
    },
    {
        "key": "channels",
        "label": "Canales",
        "data_type": "number",
        "unit": "ch",
        "min_value": Decimal("1"),
        "max_value": Decimal("256"),
        "is_comparable": True,
        "is_filterable": True,
        "order": 100,
    },
    {
        "key": "connectivity",
        "label": "Conectividad",
        "data_type": "text",
        "unit": "",
        "is_comparable": True,
        "is_filterable": True,
        "order": 110,
    },
    {
        "key": "sample_rate",
        "label": "Resolución / Sample Rate",
        "data_type": "text",
        "unit": "bit / kHz",
        "is_comparable": True,
        "is_filterable": False,
        "order": 120,
    },
    {
        "key": "phantom_power",
        "label": "Alimentación Phantom +48V",
        "data_type": "boolean",
        "unit": "",
        "is_comparable": True,
        "is_filterable": True,
        "order": 130,
    },
    {
        "key": "driver_size",
        "label": "Transductor / Driver",
        "data_type": "text",
        "unit": "",
        "is_comparable": True,
        "is_filterable": False,
        "order": 140,
    },
    {
        "key": "cable_length_m",
        "label": "Longitud de cable",
        "data_type": "decimal",
        "unit": "m",
        "min_value": Decimal("0.1"),
        "max_value": Decimal("500"),
        "is_comparable": True,
        "is_filterable": True,
        "order": 150,
    },
    {
        "key": "connector_type",
        "label": "Tipo de conector",
        "data_type": "text",
        "unit": "",
        "is_comparable": True,
        "is_filterable": True,
        "order": 160,
    },
    {
        "key": "material_finish",
        "label": "Material / Aleación / Construcción",
        "data_type": "text",
        "unit": "",
        "is_comparable": True,
        "is_filterable": False,
        "order": 170,
    },
    {
        "key": "dimensions_mm",
        "label": "Dimensiones",
        "data_type": "text",
        "unit": "mm",
        "is_comparable": True,
        "is_filterable": False,
        "order": 180,
    },
    {
        "key": "weight_kg",
        "label": "Peso",
        "data_type": "decimal",
        "unit": "kg",
        "min_value": Decimal("0.01"),
        "max_value": Decimal("500"),
        "is_comparable": True,
        "is_filterable": False,
        "order": 190,
    },
]


# Mapeo de familias de audio a las claves de atributos recomendados (sin imponer
# las mismas especificaciones a todas las categorías).
CATEGORY_FAMILY_TEMPLATES = {
    "microfonos": [
        "polar_pattern", "frequency_response", "sensitivity",
        "max_spl_db", "impedance_ohm", "snr_db", "connectivity",
        "phantom_power", "dimensions_mm", "weight_kg",
    ],
    "audifonos": [
        "driver_size", "frequency_response", "impedance_ohm",
        "sensitivity", "thd_percent", "connectivity", "cable_length_m", "weight_kg",
    ],
    "interfaces": [
        "channels", "sample_rate", "frequency_response", "snr_db",
        "thd_percent", "phantom_power", "connectivity", "dimensions_mm", "weight_kg",
    ],
    "consolas": [
        "channels", "frequency_response", "thd_percent", "snr_db",
        "phantom_power", "connectivity", "dimensions_mm", "weight_kg",
    ],
    "parlantes": [
        "rms_power_w", "peak_power_w", "frequency_response", "max_spl_db",
        "driver_size", "impedance_ohm", "connectivity", "dimensions_mm", "weight_kg",
    ],
    "subwoofers": [
        "rms_power_w", "peak_power_w", "frequency_response", "max_spl_db",
        "driver_size", "impedance_ohm", "connectivity", "dimensions_mm", "weight_kg",
    ],
    "amplificadores": [
        "channels", "rms_power_w", "peak_power_w", "impedance_ohm",
        "frequency_response", "thd_percent", "snr_db", "connectivity",
        "dimensions_mm", "weight_kg",
    ],
    "procesadores": [
        "channels", "sample_rate", "frequency_response", "thd_percent",
        "snr_db", "connectivity", "dimensions_mm", "weight_kg",
    ],
    "instrumentos": [
        "material_finish", "connectivity", "dimensions_mm", "weight_kg",
    ],
    "cables": [
        "connector_type", "cable_length_m", "impedance_ohm", "material_finish",
    ],
    "baterias": [
        "driver_size", "material_finish", "dimensions_mm", "weight_kg",
    ],
}


def infer_family_for_category_name(name_or_slug: str) -> str:
    """Infiere la familia pro-audio según nombre o slug de categoría."""
    s = (name_or_slug or "").lower()
    if any(k in s for k in ("micro", "mic")):
        return "microfonos"
    if any(k in s for k in ("audifono", "auricular", "headphone", "in-ear", "iem")):
        return "audifonos"
    if any(k in s for k in ("interfaz", "interface")):
        return "interfaces"
    if any(k in s for k in ("consola", "mezclador", "mixer")):
        return "consolas"
    if any(k in s for k in ("subwoofer", "sub-")):
        return "subwoofers"
    if any(k in s for k in ("parlante", "monitor", "altavoz", "speaker", "caja")):
        return "parlantes"
    if any(k in s for k in ("amplificador", "amp", "etapa")):
        return "amplificadores"
    if any(k in s for k in ("procesador", "dsp", "ecualizador", "compresor", "efecto")):
        return "procesadores"
    if any(k in s for k in ("cable", "conector", "plug", "xlr")):
        return "cables"
    if any(k in s for k in ("bateria", "platillo", "percusion", "drum", "cymbal")):
        return "baterias"
    return "instrumentos"


def validate_and_normalize_spec_value(attr_def, raw_value):
    """
    Valida y normaliza un valor técnico según TechnicalAttributeDefinition.
    Retorna (value_text, value_number, value_json).
    Lanza ValueError si el dato viola tipo, opciones o rango.
    """
    if raw_value is None or raw_value == "":
        return "", None, None

    dtype = attr_def.data_type
    if dtype == "number":
        if isinstance(raw_value, bool):
            raise ValueError(f"{attr_def.label} debe ser un número entero.")
        try:
            num = Decimal(str(raw_value).strip())
            if num != num.to_integral_value():
                raise ValueError(f"{attr_def.label} debe ser un entero.")
        except (InvalidOperation, ValueError):
            raise ValueError(f"{attr_def.label} debe ser un número entero válido.")
        if attr_def.min_value is not None and num < attr_def.min_value:
            raise ValueError(f"{attr_def.label} no puede ser menor que {attr_def.min_value}.")
        if attr_def.max_value is not None and num > attr_def.max_value:
            raise ValueError(f"{attr_def.label} no puede ser mayor que {attr_def.max_value}.")
        return str(int(num)), num, None

    if dtype == "decimal":
        if isinstance(raw_value, bool):
            raise ValueError(f"{attr_def.label} debe ser un número decimal.")
        try:
            num = Decimal(str(raw_value).strip().replace(",", "."))
        except (InvalidOperation, ValueError):
            raise ValueError(f"{attr_def.label} debe ser un número válido.")
        if attr_def.min_value is not None and num < attr_def.min_value:
            raise ValueError(f"{attr_def.label} no puede ser menor que {attr_def.min_value}.")
        if attr_def.max_value is not None and num > attr_def.max_value:
            raise ValueError(f"{attr_def.label} no puede ser mayor que {attr_def.max_value}.")
        norm_text = format(num.normalize(), "f") if "." in str(num) else str(num)
        if "." in norm_text:
            norm_text = norm_text.rstrip("0").rstrip(".")
        return norm_text, num, None

    if dtype == "boolean":
        if isinstance(raw_value, bool):
            b = raw_value
        else:
            s = str(raw_value).strip().lower()
            if s in ("true", "1", "si", "sí", "yes"):
                b = True
            elif s in ("false", "0", "no"):
                b = False
            else:
                raise ValueError(f"{attr_def.label} debe ser booleano (Sí/No).")
        return ("Sí" if b else "No"), None, b

    if dtype == "select":
        val = str(raw_value).strip()
        if attr_def.options and val not in attr_def.options:
            raise ValueError(
                f"{attr_def.label}: '{val}' no es una opción válida ({', '.join(attr_def.options)})."
            )
        return val, None, val

    if dtype == "multiselect":
        if isinstance(raw_value, str):
            items = [x.strip() for x in raw_value.split(",") if x.strip()]
        elif isinstance(raw_value, (list, tuple)):
            items = [str(x).strip() for x in raw_value if str(x).strip()]
        else:
            raise ValueError(f"{attr_def.label} debe ser una lista de opciones.")
        if attr_def.options:
            invalid = [it for it in items if it not in attr_def.options]
            if invalid:
                raise ValueError(
                    f"{attr_def.label}: opciones inválidas {', '.join(invalid)}."
                )
        return ", ".join(items), None, items

    # text
    val = str(raw_value).strip()
    if len(val) > 500:
        raise ValueError(f"{attr_def.label} supera el máximo de 500 caracteres.")
    return val, None, None


def ensure_default_audio_attribute_definitions():
    """Idempotente: crea o actualiza las definiciones base de atributos de audio pro."""
    from apps.products.models import TechnicalAttributeDefinition

    created_or_updated = {}
    for item in AUDIO_ATTRIBUTE_DEFINITIONS:
        obj, _ = TechnicalAttributeDefinition.objects.update_or_create(
            key=item["key"],
            defaults={
                "label": item["label"],
                "data_type": item["data_type"],
                "unit": item.get("unit", ""),
                "options": item.get("options", []),
                "min_value": item.get("min_value"),
                "max_value": item.get("max_value"),
                "is_comparable": item.get("is_comparable", True),
                "is_filterable": item.get("is_filterable", False),
                "is_active": True,
                "order": item.get("order", 0),
            },
        )
        created_or_updated[obj.key] = obj
    return created_or_updated
