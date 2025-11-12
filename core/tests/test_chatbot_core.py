from django.test import SimpleTestCase

from core import chatbot


class ChatbotCoreTests(SimpleTestCase):
    def test_normalize_text_strips_accents(self):
        self.assertEqual(chatbot._normalize_text("Métricas GLOBALES"), "metricas globales")

    def test_role_help_message_for_admin(self):
        hint = chatbot._role_help_message("administrador")
        self.assertIn("métricas globales", hint.lower())

    def test_match_rule_admin_metrics(self):
        question = "¿Dónde veo las métricas globales?"
        tokens = chatbot._tokenize(question)
        answer = chatbot._match_rule(question, tokens, "administrador", chatbot._ROLE_DIALOG_RULES)
        self.assertIsNotNone(answer)
        self.assertIn("dashboard administrador", answer.lower())

    def test_special_response_help_triggers_role_help(self):
        response = chatbot._special_response("ayuda", user_role="vendedor")
        self.assertIn("dashboard", response.lower())
