#!/usr/bin/env python
"""Expone la utilidad de administración de Django para EpicAnimes."""
import os
import sys


def main():
    """Inicializa la utilidad administrativa de Django y ejecuta el comando recibido."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EpicAnimes.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
