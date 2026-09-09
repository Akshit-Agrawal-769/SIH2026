"""
Modern HTTP test client backed by httpx.ASGITransport and httpx.AsyncClient.
Replaces deprecated starlette.testclient.TestClient to eliminate StarletteDeprecationWarning.
"""
from typing import Any
import anyio
import httpx


class TestClient:
    """Synchronous test client wrapper backed by httpx.ASGITransport and httpx.AsyncClient."""
    __test__ = False

    def __init__(self, app: Any, base_url: str = "http://testserver"):
        self.app = app
        self.base_url = base_url
        self._transport = httpx.ASGITransport(app=app)

    def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        async def _run() -> httpx.Response:
            async with httpx.AsyncClient(transport=self._transport, base_url=self.base_url) as ac:
                return await ac.request(method, url, **kwargs)
        return anyio.run(_run)

    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("PUT", url, **kwargs)

    def delete(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("DELETE", url, **kwargs)

    def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("PATCH", url, **kwargs)

    def options(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("OPTIONS", url, **kwargs)

    def head(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("HEAD", url, **kwargs)

    def __enter__(self) -> "TestClient":
        return self

    def __exit__(self, *args: Any) -> None:
        pass
