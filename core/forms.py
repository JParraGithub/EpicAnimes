from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from .models import PostulacionVendedor, PerfilCliente


class LoginForm(AuthenticationForm):
    username = forms.CharField(
        label="Usuario",
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "Nombre de usuario"}),
    )
    password = forms.CharField(
        label="Contraseña",
        widget=forms.PasswordInput(attrs={"class": "form-control", "placeholder": "Contraseña"}),
    )


class TwoFactorLoginForm(AuthenticationForm):
    otp = forms.CharField(
        label="Código de verificación",
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "123456", "inputmode": "numeric", "pattern": "\\d{6}"}),
    )

    def clean(self):
        cleaned_data = super().clean()
        user = self.get_user()
        # Requerir OTP si el usuario tiene email (mínimo para enviar código)
        otp = (self.data.get("otp") or "").strip()
        key = f"login_otp:{user.id}"
        expected = cache.get(key)
        if not expected:
            raise ValidationError("Primero solicita el código de verificación y vuelve a intentarlo.")
        if otp != str(expected):
            raise ValidationError("Código de verificación incorrecto o expirado.")
        # Consúmelo al usar
        cache.delete(key)
        return cleaned_data

class RegistroClienteForm(UserCreationForm):
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={"class": "form-control", "placeholder": "Correo electrónico"}),
        label="Correo electrónico",
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
        email = self.cleaned_data["email"].lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Ya existe una cuenta asociada a este correo.")
        return email


class PostulacionVendedorForm(forms.ModelForm):
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
    class Meta:
        model = PerfilCliente
        fields = ["nombre", "email", "telefono", "direccion", "ciudad", "codigo_postal", "pais"]
        labels = {
            "nombre": "Nombre completo",
            "email": "Correo electrónico",
            "telefono": "Teléfono",
            "direccion": "Dirección",
            "ciudad": "Ciudad",
            "codigo_postal": "Código postal",
            "pais": "País",
        }
        widgets = {
            "nombre": forms.TextInput(attrs={"class": "form-control", "placeholder": "Tu nombre"}),
            "email": forms.EmailInput(attrs={"class": "form-control", "placeholder": "tu@correo.com"}),
            "telefono": forms.TextInput(attrs={"class": "form-control", "placeholder": "+56 9 1234 5678"}),
            "direccion": forms.TextInput(attrs={"class": "form-control", "placeholder": "Dirección de entrega"}),
            "ciudad": forms.TextInput(attrs={"class": "form-control", "placeholder": "Ciudad"}),
            "codigo_postal": forms.TextInput(attrs={"class": "form-control", "placeholder": "Código postal"}),
            "pais": forms.TextInput(attrs={"class": "form-control", "placeholder": "País", "value": "Chile"}),
        }
