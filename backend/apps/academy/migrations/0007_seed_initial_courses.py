# Generated data migration for LevelPro Audio OS V3.5 (Post-Audit Remediation)
from decimal import Decimal
from django.db import migrations


def seed_initial_courses(apps, schema_editor):
    Course = apps.get_model("academy", "Course")
    Module = apps.get_model("academy", "Module")
    Lesson = apps.get_model("academy", "Lesson")

    courses_data = [
        {
            "slug": "mezcla-y-masterizacion-audio-en-vivo",
            "title": "Mezcla y Masterización para Iglesias y Espacios Vivos",
            "description": (
                "Curso técnico integral enfocado en operadores de audio en vivo, recintos religiosos "
                "y auditorios. Dominarás la ganancia adecuada, ecualización sustractiva, compresión dinámica, "
                "diseño de envíos auxiliares para monitoreo personal in-ear y prevención de feedback acústico."
            ),
            "short_description": "Domina la consola digital, ecualización quirúrgica, compresión y acústica de recintos.",
            "price": Decimal("49990.00"),
            "price_usd": Decimal("52.00"),
            "price_ars": Decimal("52000.00"),
            "level": "intermediate",
            "is_published": True,
            "order": 1,
            "modules": [
                {
                    "title": "Estructura de Ganancia y Ruteo Digital",
                    "order": 1,
                    "lessons": [
                        {"title": "Preamplificación y Rango Dinámico en Consolas Digitales", "order": 1, "is_free": True},
                        {"title": "Envío a Buses, Grupos DCA y Matriz de Salidas", "order": 2, "is_free": False},
                    ],
                },
                {
                    "title": "Procesamiento y Dinámica",
                    "order": 2,
                    "lessons": [
                        {"title": "Ecualización Paramétrica Quirúrgica en Sala", "order": 1, "is_free": False},
                        {"title": "Compresión y Limitación de Salida Protegida", "order": 2, "is_free": False},
                    ],
                },
            ],
        },
        {
            "slug": "fundamentos-audio-pro-microfonia",
            "title": "Fundamentos de Audio Pro y Microfonía de Precisión",
            "description": (
                "Aprende los principios físicos del sonido, la respuesta en frecuencia, patrones polares "
                "y selección de transductores ideales para voces e instrumentos. Incluye buenas prácticas para "
                "sistemas inalámbricos y asignación de radiofrecuencias limpias."
            ),
            "short_description": "Patrones polares, estructura de ganancia, microfonía inalámbrica y prevención de feedback.",
            "price": Decimal("29990.00"),
            "price_usd": Decimal("32.00"),
            "price_ars": Decimal("32000.00"),
            "level": "beginner",
            "is_published": True,
            "order": 2,
            "modules": [
                {
                    "title": "Física del Sonido y Transductores",
                    "order": 1,
                    "lessons": [
                        {"title": "Ondas, Frecuencia y Presión Sonora (SPL)", "order": 1, "is_free": True},
                        {"title": "Micrófonos Dinámicos vs Condensador", "order": 2, "is_free": False},
                    ],
                },
                {
                    "title": "Técnicas de Microfonía en Escenario",
                    "order": 2,
                    "lessons": [
                        {"title": "Colocación en Voces e Instrumentos Acústicos", "order": 1, "is_free": False},
                        {"title": "Gestión de Frecuencias e Intermodulación en Inalámbricos", "order": 2, "is_free": False},
                    ],
                },
            ],
        },
        {
            "slug": "optimizacion-sistemas-alineacion-acustica",
            "title": "Optimización de Sistemas de Sonido & Alineación Acústica",
            "description": (
                "Técnicas profesionales de ajuste y calibración de sistemas electroacústicos utilizando "
                "analizadores FFT de doble canal. Aprende a sincronizar en tiempo y fase los subwoofers con los "
                "arreglos principales y asegurar cobertura sonora homogénea."
            ),
            "short_description": "Medición con analizadores FFT, gestión de fase en arreglos, retardos y calibración de subwoofers.",
            "price": Decimal("79990.00"),
            "price_usd": Decimal("85.00"),
            "price_ars": Decimal("85000.00"),
            "level": "advanced",
            "is_published": True,
            "order": 3,
            "modules": [
                {
                    "title": "Medición Acústica y Análisis de Fase",
                    "order": 1,
                    "lessons": [
                        {"title": "Fundamentos de Funciones de Transferencia FFT", "order": 1, "is_free": True},
                        {"title": "Interpretación de Magnitud, Coherencia y Trazas de Fase", "order": 2, "is_free": False},
                    ],
                },
                {
                    "title": "Alineación de Arreglos y Subwoofers",
                    "order": 2,
                    "lessons": [
                        {"title": "Alineación Sub-Main mediante Retardos y Filtros", "order": 1, "is_free": False},
                        {"title": "Diseño y Ajuste de Arreglos Cardioides", "order": 2, "is_free": False},
                    ],
                },
            ],
        },
    ]

    for cdata in courses_data:
        modules_data = cdata.pop("modules")
        course, _ = Course.objects.update_or_create(
            slug=cdata["slug"],
            defaults=cdata,
        )
        for mdata in modules_data:
            lessons_data = mdata.pop("lessons")
            module, _ = Module.objects.update_or_create(
                course=course,
                title=mdata["title"],
                defaults={"order": mdata["order"]},
            )
            for ldata in lessons_data:
                Lesson.objects.update_or_create(
                    module=module,
                    title=ldata["title"],
                    defaults={"order": ldata["order"], "is_free": ldata["is_free"]},
                )


def remove_initial_courses(apps, schema_editor):
    Course = apps.get_model("academy", "Course")
    slugs = [
        "mezcla-y-masterizacion-audio-en-vivo",
        "fundamentos-audio-pro-microfonia",
        "optimizacion-sistemas-alineacion-acustica",
    ]
    Course.objects.filter(slug__in=slugs).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("academy", "0006_course_price_ars_course_price_usd"),
    ]

    operations = [
        migrations.RunPython(seed_initial_courses, remove_initial_courses),
    ]
