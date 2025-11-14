"""Declara los formularios que se utilizan en autenticación y captación."""

from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.utils import timezone
from .models import PostulacionVendedor, PerfilCliente


class LoginForm(AuthenticationForm):
    """Extiende el formulario nativo para personalizar etiquetas y estilos."""

    username = forms.CharField(
        label="Usuario",
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "Nombre de usuario"}),
    )
    password = forms.CharField(
        label="Contraseña",
        widget=forms.PasswordInput(attrs={"class": "form-control", "placeholder": "Contraseña"}),
    )


class TwoFactorLoginForm(AuthenticationForm):
    """Valida credenciales y un codigo OTP enviado por correo."""

    otp = forms.CharField(
        label="Codigo de verificacion",
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "123456", "inputmode": "numeric", "pattern": "\d{6}"}),
    )

    def clean(self):
        """Confirma que el OTP ingresado coincide con el almacenado en cache."""
        cleaned_data = super().clean()
        user = self.get_user()
        if not user:
            return cleaned_data
        otp = (self.data.get("otp") or "").strip()
        if not otp:
            raise ValidationError("Ingresa el codigo de verificacion enviado a tu correo.")
        key = f"login_otp:{user.id}"
        stored = cache.get(key)
        if not stored:
            raise ValidationError("El codigo de verificacion expiro o no ha sido solicitado. Genera uno nuevo.")
        if isinstance(stored, dict):
            expected = str(stored.get("code") or "")
            expires_at = stored.get("expires_at")
        else:
            expected = str(stored)
            expires_at = None
        if expires_at is not None and timezone.now() > expires_at:
            cache.delete(key)
            raise ValidationError("El codigo de verificacion expiro, solicita uno nuevo.")
        if otp != expected:
            raise ValidationError("Codigo de verificacion incorrecto o expirado.")
        cache.delete(key)
        return cleaned_data
class RegistroClienteForm(UserCreationForm):
    """Crea cuentas de clientes garantizando la unicidad del correo."""

    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={"class": "form-control", "placeholder": "Correo electrónico"}),
        label="Correo electrónico",
    )

    # Aceptación de términos obligatoria para completar el registro
    terms = forms.BooleanField(
        required=True,
        label="Acepto los términos y condiciones",
        error_messages={"required": "Debes aceptar los términos y condiciones."},
        widget=forms.CheckboxInput(),
    )

    class Meta:
        model = User
        fields = ("username", "email")
        widgets = {
            "username": forms.TextInput(attrs={"class": "form-control", "placeholder": "Nombre de usuario"}),
        }
        labels = {
            "username": "Nombre de usuario",
        }

    def clean_email(self):
        """Normaliza el correo y evita duplicados."""
        email = self.cleaned_data["email"].lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Ya existe una cuenta asociada a este correo.")
        return email

    def clean_terms(self):
        value = self.cleaned_data.get("terms")
        if not value:
            raise forms.ValidationError("Debes aceptar los términos y condiciones.")
        return value


class PostulacionVendedorForm(forms.ModelForm):
    """Recoge los antecedentes de quienes desean convertirse en vendedores."""

    class Meta:
        model = PostulacionVendedor
        fields = ["nombre", "email", "telefono", "tienda", "instagram", "mensaje"]
        labels = {
            "nombre": "Nombre completo",
            "email": "Correo electrónico",
            "telefono": "Teléfono",
            "tienda": "Tienda/Marca (opcional)",
            "instagram": "Instagram o web (opcional)",
            "mensaje": "Cuéntanos por qué quieres vender con nosotros",
        }
        widgets = {
            "nombre": forms.TextInput(attrs={"class": "form-control", "placeholder": "Tu nombre"}),
            "email": forms.EmailInput(attrs={"class": "form-control", "placeholder": "tu@correo.com"}),
            "telefono": forms.TextInput(attrs={"class": "form-control", "placeholder": "+56 9 1234 5678"}),
            "tienda": forms.TextInput(attrs={"class": "form-control", "placeholder": "Nombre de tu tienda"}),
            "instagram": forms.TextInput(attrs={"class": "form-control", "placeholder": "https://instagram.com/tu_tienda"}),
            "mensaje": forms.Textarea(attrs={"class": "form-control", "rows": 4}),
        }


class PerfilClienteForm(forms.ModelForm):
    """Permite que el usuario mantenga su información de despacho actualizada."""

    class Meta:
        model = PerfilCliente
        fields = ["nombre", "email", "telefono", "direccion", "ciudad", "codigo_postal", "pais", "foto"]
        labels = {
            "nombre": "Nombre completo",
            "email": "Correo electrónico",
            "telefono": "Teléfono",
            "direccion": "Dirección",
            "ciudad": "Ciudad",
            "codigo_postal": "Código postal",
            "pais": "País",
            "foto": "Fotografía personal",
        }
        widgets = {
            "nombre": forms.TextInput(attrs={"class": "form-control", "placeholder": "Tu nombre"}),
            "email": forms.EmailInput(attrs={"class": "form-control", "placeholder": "tu@correo.com"}),
            "telefono": forms.TextInput(attrs={"class": "form-control", "placeholder": "+56 9 1234 5678"}),
            "direccion": forms.TextInput(attrs={"class": "form-control", "placeholder": "Dirección de entrega"}),
            "ciudad": forms.TextInput(attrs={"class": "form-control", "placeholder": "Ciudad"}),
            "codigo_postal": forms.TextInput(attrs={"class": "form-control", "placeholder": "Código postal"}),
            "pais": forms.TextInput(attrs={"class": "form-control", "placeholder": "País", "value": "Chile"}),
            # Usamos FileInput en lugar de ClearableFileInput para evitar
            # el texto "Actualmente" que rompe el layout personalizado.
            "foto": forms.FileInput(attrs={"class": "form-control-file", "accept": "image/*"}),
        }
