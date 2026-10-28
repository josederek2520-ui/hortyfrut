from rest_framework.pagination import PageNumberPagination


class PaginacionDiez(PageNumberPagination):
    """Tamaño fijo compartido por los listados de negocio."""
    page_size = 10
    page_size_query_param = None
