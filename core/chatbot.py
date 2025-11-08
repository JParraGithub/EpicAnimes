import logging
import re
import unicodedata
from pathlib import Path
from typing import List, Tuple

import numpy as np

try:  # pragma: no cover - dependencia opcional
    import tensorflow as tf
except Exception as exc:  # pragma: no cover - dependencia opcional
    tf = None
    _IMPORT_ERROR = exc
else:  # pragma: no cover
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


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _tokenize(text: str) -> List[str]:
    if not text:
        return []
    lowered = _strip_accents(text.lower())
    return _TOKEN_PATTERN.findall(lowered)


def _load_faq_pairs(path: Path) -> Tuple[List[str], List[str]]:
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
    global _FAQ_CACHE
    if _FAQ_CACHE:
        preguntas, respuestas = zip(*_FAQ_CACHE)
        return list(preguntas), list(respuestas)
    preguntas, respuestas = _load_faq_pairs(FAQ_PATH)
    _FAQ_CACHE = list(zip(preguntas, respuestas))
    return preguntas, respuestas


def _build_model(preguntas: List[str], etiquetas: List[int]):
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


def _vectorize_text(text: str) -> np.ndarray:
    if not _VOCAB or _IDF is None:
        return np.zeros(0)
    tokens = _tokenize(text)
    counts = {}
    for token in tokens:
        idx = _VOCAB.get(token)
        if idx is None:
            continue
        counts[idx] = counts.get(idx, 0) + 1
    if not counts:
        return np.zeros(len(_VOCAB))
    total = sum(counts.values())
    vec = np.zeros(len(_VOCAB))
    for idx, count in counts.items():
        vec[idx] = (count / max(total, 1)) * _IDF[idx]
    return vec


def _semantic_match(pregunta: str) -> dict:
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
        return {"answer": respuestas[0], "confidence": 0.0}

    vec = _vectorize_text(pregunta)
    if vec.size == 0:
        return {"answer": respuestas[0], "confidence": 0.0}

    vec_norm = np.linalg.norm(vec)
    if vec_norm == 0:
        return {"answer": respuestas[0], "confidence": 0.0}

    sims = _QUESTION_MATRIX @ vec
    norms = _QUESTION_NORMS * vec_norm
    with np.errstate(divide="ignore", invalid="ignore"):
        sims = np.divide(sims, norms, out=np.zeros_like(sims), where=norms != 0)

    best_idx = int(np.argmax(sims))
    best_score = float(sims[best_idx]) if sims.size else 0.0
    return {"answer": respuestas[best_idx], "confidence": best_score}


def _fallback_answer(pregunta: str) -> dict:
    if not pregunta:
        return {"answer": "¿Podrías formular tu pregunta? Estoy aquí para ayudarte.", "confidence": 0.0}
    semantic = _semantic_match(pregunta)
    return semantic


def responder(pregunta: str) -> dict:
    pregunta = (pregunta or "").strip()
    if not pregunta:
        return {"answer": "¿Podrías formular tu pregunta? Estoy aquí para ayudarte.", "confidence": 0.0}
    try:
        _ensure_model()
        if tf is None:
            raise RuntimeError("TensorFlow no disponible")
        input_tensor = tf.convert_to_tensor([pregunta])
        pred = _MODEL.predict(input_tensor, verbose=0)[0]
        idx = int(np.argmax(pred))
        confianza = float(pred[idx])
        if confianza < 0.55:
            semantic = _semantic_match(pregunta)
            if semantic["confidence"] >= confianza:
                return semantic
        return {"answer": _ANSWERS[idx], "confidence": confianza}
    except RuntimeError as exc:
        logger.warning("TensorFlow no disponible, usando fallback: %s", exc)
        return _fallback_answer(pregunta)
    except Exception:
        logger.exception("Error al generar respuesta del chatbot")
        return _fallback_answer(pregunta)
