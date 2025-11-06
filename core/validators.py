from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _, ngettext


class PasswordComplexityValidator:
    """
    Validador de complejidad para contraseñas.
    Requiere que la contraseña incluya diferentes tipos de caracteres.
    """

    def __init__(self, min_uppercase=1, min_lowercase=1, min_digits=1, min_symbols=1):
        self.min_uppercase = int(min_uppercase)
        self.min_lowercase = int(min_lowercase)
        self.min_digits = int(min_digits)
        self.min_symbols = int(min_symbols)

    def _count_if(self, password, predicate):
        return sum(1 for ch in password if predicate(ch))

    def validate(self, password, user=None):
        errors = []

        if self.min_uppercase and self._count_if(password, str.isupper) < self.min_uppercase:
            errors.append(
                ngettext(
                    "La contraseña debe incluir al menos %(num)d letra mayúscula.",
                    "La contraseña debe incluir al menos %(num)d letras mayúsculas.",
                    self.min_uppercase,
                )
                % {"num": self.min_uppercase}
            )

        if self.min_lowercase and self._count_if(password, str.islower) < self.min_lowercase:
            errors.append(
                ngettext(
                    "La contraseña debe incluir al menos %(num)d letra minúscula.",
                    "La contraseña debe incluir al menos %(num)d letras minúsculas.",
                    self.min_lowercase,
                )
                % {"num": self.min_lowercase}
            )

        if self.min_digits and self._count_if(password, str.isdigit) < self.min_digits:
            errors.append(
                ngettext(
                    "La contraseña debe incluir al menos %(num)d número.",
                    "La contraseña debe incluir al menos %(num)d números.",
                    self.min_digits,
                )
                % {"num": self.min_digits}
            )

        if self.min_symbols and self._count_if(password, lambda c: not c.isalnum()) < self.min_symbols:
            errors.append(
                ngettext(
                    "La contraseña debe incluir al menos %(num)d símbolo.",
                    "La contraseña debe incluir al menos %(num)d símbolos.",
                    self.min_symbols,
                )
                % {"num": self.min_symbols}
            )

        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        fragments = []

        def _fragment(singular, plural, amount):
            return ngettext(singular, plural, amount) % {"num": amount}

        if self.min_uppercase:
            fragments.append(_fragment("%(num)d letra mayúscula", "%(num)d letras mayúsculas", self.min_uppercase))
        if self.min_lowercase:
            fragments.append(_fragment("%(num)d letra minúscula", "%(num)d letras minúsculas", self.min_lowercase))
        if self.min_digits:
            fragments.append(_fragment("%(num)d número", "%(num)d números", self.min_digits))
        if self.min_symbols:
            fragments.append(_fragment("%(num)d símbolo", "%(num)d símbolos", self.min_symbols))

        if not fragments:
            return _("La contraseña no necesita cumplir requisitos adicionales de complejidad.")

        return _("La contraseña debe incluir al menos: %(requisitos)s.") % {
            "requisitos": ", ".join(fragments)
        }
