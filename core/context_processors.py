"""Context processors usados por las vistas públicas para mostrar datos de usuario."""

from .models import PerfilCliente


def perfil_cliente(request):
    """Expone el perfil del usuario en las plantillas."""
    perfil = None
    if request.user.is_authenticated:
        perfil, _ = PerfilCliente.objects.get_or_create(user=request.user)
    return {"perfil_cliente": perfil}
