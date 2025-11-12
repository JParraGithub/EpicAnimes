"""Implementa el chatbot basado en FAQ y los mecanismos de respaldo semántico."""

import logging
import re
import unicodedata
from decimal import Decimal
from pathlib import Path
from typing import Iterable, List, Tuple

import numpy as np
from django.apps import apps

try:
    import tensorflow as tf
except Exception as exc:
    tf = None
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


BASE_DIR = Path(__file__).resolve().parent
FAQ_PATH = BASE_DIR / "chatbot_faq.txt"

_MODEL = None
_LABELS: List[int] = []
_ANSWERS: List[str] = []
_FAQ_CACHE: List[Tuple[str, str]] = []

_VOCAB = {}
_IDF: np.ndarray | None = None
_QUESTION_MATRIX: np.ndarray | None = None
_QUESTION_NORMS: np.ndarray | None = None

_TOKEN_PATTERN = re.compile(r"[a-z0-9ñ]+", re.IGNORECASE)

logger = logging.getLogger(__name__)

_GREETING_KEYWORDS = {
    "hola",
    "hey",
    "buenas",
    "saludos",
    "que tal",
    "qué tal",
    "que onda",
    "qué onda",
    "como estas",
    "cómo estás",
}
_PRODUCT_STOPWORDS = {
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "un",
    "una",
    "unos",
    "unas",
    "al",
    "lo",
    "para",
    "por",
    "con",
    "que",
    "cual",
    "cuales",
    "quiero",
    "quisiera",
    "saber",
    "informacion",
    "info",
    "sobre",
    "algo",
    "mas",
    "me",
    "de",
    "el",
    "la",
    "los",
    "las",
    "donde",
    "como",
    "cuanto",
    "cuanta",
    "precio",
    "precios",
    "vale",
    "cuesta",
    "tienen",
    "hay",
}
_RECOMMEND_TERMS = {
    "recomendacion",
    "recomendaciones",
    "recomendable",
    "recomienda",
    "recomiendas",
    "recomendar",
    "recomiendame",
    "recomiendanos",
    "recomiendate",
    "recomiendo",
    "recomendarias",
    "sugerencia",
    "sugerencias",
    "sugerir",
    "sugerirme",
}
_GREETING_VARIANTS = [
    "¡Hola! ¿Qué tal?",
    "¡Hola! Bienvenido a EpicAnimes.",
    "¡Buenas! ¿En qué puedo ayudarte hoy?",
]
_SMALL_TALK_PHRASES = [
    "que tal",
    "como estas",
    "como va",
    "todo bien",
]
_THANKS_KEYWORDS = {"gracias"}
_GOODBYE_KEYWORDS = {"chau", "chao", "adios", "nos vemos", "hasta luego"}
_OFFENSIVE_KEYWORDS = {"idiota", "tonto", "estupido", "imbecil", "mierda", "maldito"}
_HELP_KEYWORDS = {
    "ayuda",
    "ayudame",
    "ayudar",
    "orientacion",
    "orientarme",
    "orientame",
    "orienta",
    "orientar",
    "guiame",
    "guia",
    "guiar",
    "guiarme",
    "sugerencias",
    "sugerencia",
    "ideas",
    "idea",
}
DEFAULT_UNKNOWN_RESPONSE = "No tengo esa información exacta, pero puedo derivarte con soporte si lo deseas."


def _pick_variant(options, seed: str = "") -> str:
    """Devuelve una variante determinista según la semilla entregada."""
    if not options:
        return ""
    idx = abs(hash(seed or "")) % len(options)
    return options[idx]


def _compose_response(*segments: str) -> str:
    """Ensambla una respuesta corta (máximo 3 líneas) limpiando espacios."""
    lines: List[str] = []
    for segment in segments:
        if not segment:
            continue
        for piece in str(segment).splitlines():
            cleaned = piece.strip()
            if not cleaned:
                continue
            lines.append(cleaned)
            if len(lines) >= 3:
                return "\n".join(lines[:3])
    if not lines:
        return DEFAULT_UNKNOWN_RESPONSE
    return "\n".join(lines[:3])


_ROLE_GREETING_SEGMENTS = {
    "administrador": (
        "Veo que eres administrador; puedo ayudarte a navegar informes y tareas operativas.",
        "Te acompaño con dashboards, usuarios, vendedores y configuraciones globales.",
        "¿En qué proceso necesitas apoyo hoy?",
    ),
    "vendedor": (
        "Estás en el modo vendedor certificado de EpicAnimes.",
        "Gestionemos productos, stock, alertas críticas y métricas del dashboard.",
        "Recuerda que avisamos cuando tu stock baja de 5 unidades.",
    ),
    "comprador": (
        "Veo tu sesión como comprador registrado.",
        "Te ayudo con compras, envíos, devoluciones y métodos de pago.",
        "Si buscas un pedido revisa Mis compras o el correo de confirmación.",
    ),
    "anonimo": (
        "Bienvenido a EpicAnimes, la tienda online de coleccionables de anime.",
        "Puedes registrarte o iniciar sesión desde el menú principal para guardar tus pedidos.",
        "Pregúntame lo que necesites sobre catálogo o registro.",
    ),
}

_ROLE_HELP_SEGMENTS = {

  "invitado": [
    {
      "pregunta": "¿Qué es EpicAnimes?",
      "respuesta": "Es una tienda online especializada en productos de anime, figuras, poleras, posters y mucho más."
    },
    {
      "pregunta": "¿Necesito una cuenta para comprar?",
      "respuesta": "Sí, debes registrarte o iniciar sesión para poder finalizar tus compras y recibir seguimiento del pedido."
    },
    {
      "pregunta": "¿Cuál es el horario de atención?",
      "respuesta": "Atendemos todos los días de 09:00 a 21:00 hrs. Fuera de horario te responderemos al siguiente día hábil."
    }
  ],

  "comprador": [
    {
      "pregunta": "¿Cómo hago seguimiento a mi pedido?",
      "respuesta": "Revisa el correo de confirmación o entra a 'Mis compras' en tu panel para ver el número de seguimiento."
    },
    {
      "pregunta": "¿Cuánto tarda el envío?",
      "respuesta": "En Santiago entre 24 y 48 horas hábiles; en regiones, de 3 a 5 días hábiles."
    },
    {
      "pregunta": "¿Qué hago si mi producto llega dañado?",
      "respuesta": "Escríbenos dentro de 5 días con fotos y el número de orden para coordinar cambio o reembolso."
    }
  ],

  "vendedor": [
    {
      "pregunta": "¿Cómo agrego un producto?",
      "respuesta": "En tu Dashboard Vendedor, entra a 'Mis productos' y presiona 'Agregar nuevo'."
    },
    {
      "pregunta": "¿Qué significa stock crítico?",
      "respuesta": "Es una alerta automática cuando el inventario baja de 5 unidades para que repongas stock."
    },
    {
      "pregunta": "¿Dónde veo mis ventas?",
      "respuesta": "En tu Dashboard puedes revisar tus ventas totales, productos más vendidos y métricas diarias."
    }
  ],
  
  "administrador": [
    {
      "pregunta": "¿Dónde veo las métricas globales?",
      "respuesta": "Desde el Dashboard Administrador, donde verás ventas, usuarios activos y desempeño por vendedor."
    },
    {
      "pregunta": "¿Cómo gestiono reportes del sistema?",
      "respuesta": "En la sección 'Reportes' puedes revisar errores o reclamos y marcarlos como resueltos."
    },
    {
      "pregunta": "¿Puedo enviar notificaciones a todos los vendedores?",
      "respuesta": "Sí, desde el panel de administración puedes enviar avisos o correos masivos a todos los vendedores activos."
    }
  ]
}


_FAQ_RULES = [
    {
        "phrases": ["recomiendame algo", "recomiendame"],
        "response": (
            "Depende de tus gustos: tenemos figuras, poleras, posters y accesorios.",
            "Dime tu anime favorito y te sugiero algo puntual.",
        ),
    },
    {
        "any": {"pago"},
        "response": (
            "Aceptamos tarjeta, transferencia bancaria y MercadoPago.",
            "Elige el medio preferido durante el checkout.",
        ),
    },
]

def _match_rule(question: str, tokens: List[str], user_role: str | None, rules: List[dict]) -> str | None:
    """Evalúa un conjunto de reglas y retorna la respuesta correspondiente."""
    if not question:
        return None
    normalized_question = _normalize_text(question)
    token_set = _normalize_tokens(tokens)
    role = (user_role or "comprador").lower()
    for rule in rules:
        roles = rule.get("roles")
        if roles and role not in roles:
            continue
        all_tokens = rule.get("all")
        if all_tokens:
            if not _normalize_tokens(all_tokens).issubset(token_set):
                continue
        any_tokens = rule.get("any")
        if any_tokens:
            if not (token_set & _normalize_tokens(any_tokens)):
                continue
        phrases = rule.get("phrases")
        if phrases:
            if not any(_normalize_text(phrase) in normalized_question for phrase in phrases):
                continue
        response_segments = rule.get("response") or ()
        if response_segments:
            return _compose_response(*response_segments)
    return None


def _strip_accents(text: str) -> str:
    """Elimina tildes y caracteres combinados para estandarizar el texto."""
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _normalize_text(text: str) -> str:
    """Normaliza texto para coincidencias: minúsculas sin acentos ni espacios extras."""
    cleaned = _strip_accents(text or "").lower()
    return re.sub(r"\s+", " ", cleaned).strip()


def _normalize_tokens(tokens: Iterable[str]) -> set[str]:
    return { _normalize_text(token) for token in tokens if token }


def _tokenize(text: str) -> List[str]:
    """Convierte una oración en tokens normalizados para búsquedas."""
    if not text:
        return []
    lowered = _strip_accents(text.lower())
    return _TOKEN_PATTERN.findall(lowered)


def _role_greeting(role: str | None, *, seed: str = "") -> str:
    """Devuelve un saludo contextualizado según el rol del usuario."""
    normalized_role = role or "comprador"
    segments = _ROLE_GREETING_SEGMENTS.get(normalized_role, _ROLE_GREETING_SEGMENTS["comprador"])
    variant = _pick_variant(_GREETING_VARIANTS, seed or normalized_role)
    return _compose_response(variant, *segments)


def _role_help_message(role: str | None) -> str:
    """Entrega sugerencias rápidas para orientar al usuario según su rol."""
    normalized_role = role or "comprador"
    segments = _ROLE_HELP_SEGMENTS.get(normalized_role, _ROLE_HELP_SEGMENTS["comprador"])
    return _compose_response(*segments)


def _special_response(question: str, *, user_role: str | None = None) -> str | None:
    """Provee respuestas rápidas para saludos, despedidas y entradas breves."""
    normalized = _strip_accents((question or "").lower()).strip()
    cleaned = re.sub(r"[^a-z0-9\s]", " ", normalized)
    tokens = [tok for tok in cleaned.split() if tok]
    if not tokens:
        return _compose_response(
            "Parece que solo enviaste signos o espacios.",
            "Cuéntame tu pregunta sobre EpicAnimes y con gusto respondo.",
        )
    token_set = set(tokens)
    if token_set & _OFFENSIVE_KEYWORDS:
        return _compose_response(
            "Prefiero mantener una conversación respetuosa.",
            "¿Deseas que te ayude con algo relacionado con EpicAnimes?",
        )
    if token_set & _THANKS_KEYWORDS:
        return _compose_response("¡Gracias a ti!", "¿Hay algo más en lo que pueda ayudarte en EpicAnimes?")
    if token_set & _HELP_KEYWORDS:
        return _role_help_message(user_role)
    if any(phrase in normalized for phrase in _GOODBYE_KEYWORDS):
        return _compose_response(
            "¡Hasta luego, que tengas un gran día!",
            "Si necesitas algo más de EpicAnimes, aquí estaré.",
        )
    if any(phrase in normalized for phrase in _SMALL_TALK_PHRASES):
        reply = _pick_variant(
            [
                "Todo bien por aquí, listo para ayudarte.",
                "Muy bien, ¿y tú? Cuéntame en qué te apoyo.",
                "Todo tranquilo en EpicAnimes; dime qué necesitas.",
            ],
            seed=question,
        )
        return _compose_response(reply, "¿En qué puedo ayudarte hoy?")
    for keyword in _GREETING_KEYWORDS:
        if cleaned.startswith(keyword) or f" {keyword} " in f" {cleaned} ":
            return _role_greeting(user_role, seed=question)
    short_noise = len(tokens) <= 2 and all(len(token) <= 2 for token in tokens)
    only_repeated = len(set("".join(tokens))) == 1 if tokens else False
    if short_noise or only_repeated:
        return _compose_response(
            "Parece que escribiste pocos caracteres.",
            "Dime tu duda sobre productos, envíos o soporte y te respondo de inmediato.",
        )
    return None


def _question_relates_to_faq(tokens: List[str]) -> bool:
    """Determina si la entrada comparte vocabulario con las FAQ conocidas."""
    if not tokens:
        return False
    filtered = [token for token in tokens if token not in _PRODUCT_STOPWORDS]
    if not filtered:
        return False
    if not _VOCAB:
        try:
            _ensure_semantic_space()
        except Exception:
            return True
    vocab = _VOCAB or {}
    return any(token in vocab for token in filtered)


def _format_price(value) -> str:
    """Devuelve el precio en CLP con formato legible."""
    try:
        amount = Decimal(value)
    except Exception:
        try:
            amount = Decimal(str(value))
        except Exception:
            return str(value)
    text = f"${int(amount.quantize(Decimal('1'))):,} CLP"
    return text.replace(",", ".")


def _recommendation_answer(productos: List) -> dict | None:
    """Entrega una recomendación directa usando los productos disponibles."""
    if not productos:
        return None

    disponibles = [p for p in productos if (p.existencias or 0) > 0]
    candidatos = list(disponibles or productos)

    def _score(prod):
        stock = prod.existencias or 0
        fecha = getattr(prod, "fecha_ingreso", None)
        try:
            fecha_score = fecha.toordinal()
        except Exception:
            fecha_score = 0
        return (1 if stock > 0 else 0, stock, fecha_score, getattr(prod, "id", 0))

    candidatos.sort(key=_score, reverse=True)
    top = candidatos[0]

    respuesta = _compose_response(
        f'Te recomiendo "{top.nombre}" ({top.categoria}) por {_format_price(top.precio)}.',
        f"Hay {max(int(top.existencias or 0), 0)} unidades listas para despacho.",
        f"Revísalo aquí: /producto/{top.id}/.",
    )
    return {"answer": respuesta, "confidence": 0.85}


def _product_answer(question: str, tokens: List[str]) -> dict | None:
    """Busca coincidencias con productos reales para responder consultas específicas."""
    if not tokens:
        return None
    try:
        Producto = apps.get_model("core", "Producto")
    except Exception:
        return None
    productos = list(Producto.objects.all())
    if not productos:
        return None

    token_set = set(tokens)
    wants_recommendation = any(
        token in _RECOMMEND_TERMS or token.startswith("recom")
        for token in token_set
    )
    content_tokens = {tok for tok in token_set if len(tok) > 2 and tok not in _PRODUCT_STOPWORDS}
    meaningful_tokens = {tok for tok in content_tokens if tok not in _RECOMMEND_TERMS and not tok.startswith("recom")}
    if wants_recommendation and not meaningful_tokens:
        recommendation = _recommendation_answer(productos)
        if recommendation:
            return recommendation
    if not content_tokens:
        return None
    matches = []
    price_terms = {"precio", "precios", "cuanto", "vale", "cuesta"}
    stock_terms = {"stock", "disponible", "disponibles", "tienen", "hay"}

    for prod in productos:
        texto = " ".join(part for part in [prod.nombre, prod.descripcion, prod.categoria] if part)
        producto_tokens = {tok for tok in _tokenize(texto) if len(tok) > 2 and tok not in _PRODUCT_STOPWORDS}
        overlap = content_tokens & producto_tokens
        if not overlap:
            continue
        score = len(overlap)
        if token_set & price_terms:
            score += 0.4
        if token_set & stock_terms:
            score += 0.2
        matches.append(
            {
                "producto": prod,
                "score": score,
            }
        )

    if not matches:
        if wants_recommendation:
            return _recommendation_answer(productos)
        return None

    matches.sort(key=lambda item: (item["score"], item["producto"].existencias or 0), reverse=True)
    top = matches[0]["producto"]
    respuesta = _compose_response(
        f'Tenemos "{top.nombre}" ({top.categoria}) por {_format_price(top.precio)}.',
        f"Hay {top.existencias} unidades disponibles." if top.existencias is not None else "Consulta su stock en la ficha del producto.",
        f"Revísalo aquí: /producto/{top.id}/.",
    )
    return {"answer": respuesta, "confidence": 0.9}


def _load_faq_pairs(path: Path) -> Tuple[List[str], List[str]]:
    """Carga los pares de preguntas y respuestas desde el archivo de soporte."""
    questions, answers = [], []
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el archivo de FAQ en {path}")
    raw = path.read_text(encoding="utf-8").strip()
    bloques = [b.strip() for b in raw.split("\n\n") if b.strip()]
    for bloque in bloques:
        lineas = bloque.splitlines()
        pregunta = next((l.replace("Pregunta:", "").strip() for l in lineas if l.startswith("Pregunta:")), "")
        respuesta = next((l.replace("Respuesta:", "").strip() for l in lineas if l.startswith("Respuesta:")), "")
        if pregunta and respuesta:
            questions.append(pregunta)
            answers.append(respuesta)
    if not questions:
        raise ValueError("El archivo de FAQ no contiene pares válidos de preguntas y respuestas.")
    return questions, answers


def _ensure_faq_cache() -> Tuple[List[str], List[str]]:
    """Mantiene en memoria las preguntas frecuentes procesadas."""
    global _FAQ_CACHE
    if _FAQ_CACHE:
        preguntas, respuestas = zip(*_FAQ_CACHE)
        return list(preguntas), list(respuestas)
    preguntas, respuestas = _load_faq_pairs(FAQ_PATH)
    _FAQ_CACHE = list(zip(preguntas, respuestas))
    return preguntas, respuestas


def _build_model(preguntas: List[str], etiquetas: List[int]):
    """Entrena el clasificador basado en TensorFlow a partir de las FAQ."""
    vectorizer = tf.keras.layers.TextVectorization(
        output_mode="int",
        output_sequence_length=48,
        standardize="lower_and_strip_punctuation",
    )
    vectorizer.adapt(preguntas)
    vocab_size = len(vectorizer.get_vocabulary())

    model = tf.keras.Sequential(
        [
            tf.keras.Input(shape=(1,), dtype=tf.string),
            vectorizer,
            tf.keras.layers.Embedding(vocab_size + 1, 64),
            tf.keras.layers.GlobalAveragePooling1D(),
            tf.keras.layers.Dense(64, activation="relu"),
            tf.keras.layers.Dense(len(_ANSWERS), activation="softmax"),
        ]
    )

    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(
        tf.convert_to_tensor(preguntas),
        tf.convert_to_tensor(etiquetas),
        epochs=160,
        verbose=0,
        shuffle=True,
    )
    return model


def _ensure_model():
    """Garantiza que el modelo neuronal esté disponible antes de responder."""
    global _MODEL, _LABELS, _ANSWERS
    if _MODEL is not None:
        return
    if _IMPORT_ERROR is not None or tf is None:
        detalle = f" Detalle: {_IMPORT_ERROR}" if _IMPORT_ERROR else ""
        raise RuntimeError(
            "El asistente virtual no está disponible porque TensorFlow no se cargó correctamente. "
            "Instala una versión compatible (por ejemplo 'pip install tensorflow-cpu==2.15') y reinicia el servidor."
            f"{detalle}"
        ) from _IMPORT_ERROR
    preguntas, respuestas = _ensure_faq_cache()
    _ANSWERS = list(respuestas)
    _LABELS = list(range(len(respuestas)))
    logger.info("Entrenando modelo de chatbot con %d ejemplos", len(preguntas))
    _MODEL = _build_model(preguntas, _LABELS)


def _ensure_semantic_space():
    """Construye la representación semántica usada como respaldo."""
    global _VOCAB, _IDF, _QUESTION_MATRIX, _QUESTION_NORMS
    if _QUESTION_MATRIX is not None and _IDF is not None and _QUESTION_NORMS is not None:
        return

    preguntas, _ = _ensure_faq_cache()
    vocab = {}
    docs_tokens: List[List[str]] = []
    for question in preguntas:
        tokens = _tokenize(question)
        docs_tokens.append(tokens)
        for token in tokens:
            if token not in vocab:
                vocab[token] = len(vocab)

    if not vocab:
        _VOCAB = {}
        _IDF = np.zeros(0)
        _QUESTION_MATRIX = np.zeros((len(preguntas), 0))
        _QUESTION_NORMS = np.zeros(len(preguntas))
        return

    df = np.zeros(len(vocab))
    for tokens in docs_tokens:
        seen = set()
        for token in tokens:
            idx = vocab[token]
            if idx not in seen:
                df[idx] += 1
                seen.add(idx)
    N = len(docs_tokens)
    idf = np.log((N + 1) / (df + 1)) + 1

    matrix = np.zeros((N, len(vocab)))
    for row, tokens in enumerate(docs_tokens):
        if not tokens:
            continue
        counts = {}
        for token in tokens:
            idx = vocab[token]
            counts[idx] = counts.get(idx, 0) + 1
        total = sum(counts.values())
        for idx, count in counts.items():
            matrix[row, idx] = (count / max(total, 1)) * idf[idx]

    norms = np.linalg.norm(matrix, axis=1)

    _VOCAB = vocab
    _IDF = idf
    _QUESTION_MATRIX = matrix
    _QUESTION_NORMS = norms


def _vectorize_text(text: str) -> np.ndarray | None:
    """Transforma una pregunta en un vector TF-IDF alineado al vocabulario."""
    if not _VOCAB or _IDF is None:
        return None
    tokens = _tokenize(text)
    counts = {}
    for token in tokens:
        idx = _VOCAB.get(token)
        if idx is None:
            continue
        counts[idx] = counts.get(idx, 0) + 1
    if not counts:
        return None
    total = sum(counts.values())
    vec = np.zeros(len(_VOCAB))
    for idx, count in counts.items():
        vec[idx] = (count / max(total, 1)) * _IDF[idx]
    return vec


def _semantic_match(pregunta: str) -> dict:
    """Busca la respuesta más similar mediante coincidencia semántica."""
    try:
        _ensure_semantic_space()
        preguntas, respuestas = _ensure_faq_cache()
    except Exception as exc:
        logger.exception("Error al preparar el espacio semántico: %s", exc)
        return {
            "answer": "Por ahora no puedo acceder a las preguntas frecuentes. Escríbenos y te ayudaremos manualmente.",
            "confidence": 0.0,
        }

    if _QUESTION_MATRIX is None or _QUESTION_MATRIX.size == 0:
        return {"answer": DEFAULT_UNKNOWN_RESPONSE, "confidence": 0.0}

    vec = _vectorize_text(pregunta)
    if vec is None or vec.size == 0:
        return {"answer": DEFAULT_UNKNOWN_RESPONSE, "confidence": 0.0}

    vec_norm = np.linalg.norm(vec)
    if vec_norm == 0:
        return {"answer": DEFAULT_UNKNOWN_RESPONSE, "confidence": 0.0}

    sims = _QUESTION_MATRIX @ vec
    norms = _QUESTION_NORMS * vec_norm
    with np.errstate(divide="ignore", invalid="ignore"):
        sims = np.divide(sims, norms, out=np.zeros_like(sims), where=norms != 0)

    best_idx = int(np.argmax(sims))
    best_score = float(sims[best_idx]) if sims.size else 0.0
    if best_score < 0.25:
        return {"answer": DEFAULT_UNKNOWN_RESPONSE, "confidence": best_score}
    answer = _compose_response(respuestas[best_idx])
    return {"answer": answer, "confidence": best_score}


def _fallback_answer(pregunta: str, *, user_role: str | None = None) -> dict:
    """Devuelve una respuesta básica cuando el modelo no puede contestar."""
    question = (pregunta or "").strip()
    if not question:
        return {
            "answer": _compose_response(
                "¿Podrías formular tu pregunta?",
                "Estoy aquí para ayudarte con EpicAnimes.",
            ),
            "confidence": 0.0,
        }
    tokens = _tokenize(question)
    special = _special_response(question, user_role=user_role)
    if special:
        return {"answer": special, "confidence": 0.0}
    product = _product_answer(question, tokens)
    if product:
        return product
    role_answer = _match_rule(question, tokens, user_role, _ROLE_DIALOG_RULES)
    if role_answer:
        return {"answer": role_answer, "confidence": 0.35}
    faq_answer = _match_rule(question, tokens, user_role, _FAQ_RULES)
    if faq_answer:
        return {"answer": faq_answer, "confidence": 0.4}
    if not _question_relates_to_faq(tokens):
        return {"answer": DEFAULT_UNKNOWN_RESPONSE, "confidence": 0.0}
    semantic = _semantic_match(question)
    return semantic


def responder(pregunta: str, user_role: str | None = None) -> dict:
    """Atiende una consulta usando el modelo neuronal y el respaldo semántico."""
    pregunta = (pregunta or "").strip()
    if not pregunta:
        return {"answer": "¿Podrías formular tu pregunta? Estoy aquí para ayudarte.", "confidence": 0.0}
    tokens = _tokenize(pregunta)
    special = _special_response(pregunta, user_role=user_role)
    if special:
        return {"answer": special, "confidence": 0.0}
    product = _product_answer(pregunta, tokens)
    if product:
        return product
    if not _question_relates_to_faq(tokens):
        return {"answer": DEFAULT_UNKNOWN_RESPONSE, "confidence": 0.0}
    try:
        _ensure_model()
        if tf is None:
            raise RuntimeError("TensorFlow no disponible")
        input_tensor = tf.convert_to_tensor([pregunta])
        pred = _MODEL.predict(input_tensor, verbose=0)[0]
        idx = int(np.argmax(pred))
        confianza = float(pred[idx])
        semantic = _semantic_match(pregunta)
        if confianza < 0.55 or semantic["confidence"] >= confianza:
            return semantic
        if semantic["answer"] == DEFAULT_UNKNOWN_RESPONSE and confianza < 0.75:
            return semantic
        return {"answer": _compose_response(_ANSWERS[idx]), "confidence": confianza}
    except RuntimeError as exc:
        logger.warning("TensorFlow no disponible, usando fallback: %s", exc)
        return _fallback_answer(pregunta, user_role=user_role)
    except Exception:
        logger.exception("Error al generar respuesta del chatbot")
        return _fallback_answer(pregunta, user_role=user_role)
