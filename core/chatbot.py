import logging
from pathlib import Path
from typing import List, Tuple

import numpy as np

try:
    import tensorflow as tf
except Exception as exc:  # pragma: no cover - dependencia opcional
    tf = None
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


BASE_DIR = Path(__file__).resolve().parent
FAQ_PATH = BASE_DIR / "chatbot_faq.txt"

_MODEL = None
_LABELS: List[str] = []
_ANSWERS: List[str] = []

logger = logging.getLogger(__name__)


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


def _build_model(preguntas: List[str], etiquetas: List[int]):
    vectorizer = tf.keras.layers.TextVectorization(
        output_mode="int",
        output_sequence_length=40,
        standardize="lower_and_strip_punctuation",
    )
    vectorizer.adapt(preguntas)
    vocab_size = len(vectorizer.get_vocabulary())

    model = tf.keras.Sequential(
        [
            tf.keras.Input(shape=(1,), dtype=tf.string),
            vectorizer,
            tf.keras.layers.Embedding(vocab_size + 1, 32),
            tf.keras.layers.GlobalAveragePooling1D(),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dense(len(_ANSWERS), activation="softmax"),
        ]
    )

    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(
        tf.convert_to_tensor(preguntas),
        tf.convert_to_tensor(etiquetas),
        epochs=200,
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
    preguntas, respuestas = _load_faq_pairs(FAQ_PATH)
    _ANSWERS = respuestas
    _LABELS = list(range(len(respuestas)))
    logger.info("Entrenando modelo de chatbot con %d ejemplos", len(preguntas))
    _MODEL = _build_model(preguntas, _LABELS)


def responder(pregunta: str) -> dict:
    _ensure_model()
    if not pregunta or not pregunta.strip():
        return {"answer": "¿Podrías formular tu pregunta? Estoy aquí para ayudarte.", "confidence": 0.0}
    pred = _MODEL.predict([pregunta], verbose=0)[0]
    idx = int(np.argmax(pred))
    confianza = float(pred[idx])
    if confianza < 0.25:
        return {
            "answer": "No estoy seguro de tener la respuesta exacta. Escríbenos por WhatsApp o correo y te ayudaremos a la brevedad.",
            "confidence": confianza,
        }
    return {"answer": _ANSWERS[idx], "confidence": confianza}
